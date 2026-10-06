import type { SqliteDatabase } from "../connection.js";
import { formatUtc7DateStr, getDaysInSolarMonth, getUtc7Parts } from "./events.js";

export type LookupRecurrence = "daily" | "weekly" | "monthly";
export type RunStatus = "running" | "sent" | "failed";

export type ScheduledLookupRow = {
  id: number;
  chatId: string;
  instruction: string;
  recurrence: LookupRecurrence;
  hour: number;
  minute: number;
  weekday: number | null;
  dayOfMonth: number | null;
  active: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type CreateLookupInput = {
  chatId: string;
  instruction: string;
  recurrence: LookupRecurrence;
  hour: number;
  minute: number;
  weekday?: number | null;
  dayOfMonth?: number | null;
  active?: boolean;
  createdBy: string;
};

export type UpdateLookupInput = {
  instruction?: string;
  recurrence?: LookupRecurrence;
  hour?: number;
  minute?: number;
  weekday?: number | null;
  dayOfMonth?: number | null;
  active?: boolean;
};

export type ScheduledLookupRunRow = {
  id: number;
  lookupId: number;
  fireDate: string;
  status: RunStatus;
  attemptCount: number;
  lastError: string | null;
  sentAt: number | null;
  startedAt: number;
};

export type ScheduledLookupWithLastRun = ScheduledLookupRow & {
  lastRun?: ScheduledLookupRunRow;
};

export type ClaimRunResult =
  | { claimed: true; run: ScheduledLookupRunRow }
  | { claimed: false; run?: ScheduledLookupRunRow; reason: string };

export interface LookupRepository {
  createLookup(input: CreateLookupInput): Promise<ScheduledLookupRow>;
  getLookupById(id: number): Promise<ScheduledLookupRow | undefined>;
  listLookups(chatId?: string): Promise<ScheduledLookupWithLastRun[]>;
  updateLookup(id: number, updates: UpdateLookupInput): Promise<ScheduledLookupRow | undefined>;
  cancelLookup(id: number): Promise<boolean>;
  findDueLookups(referenceDate?: Date): Promise<ScheduledLookupRow[]>;
  claimRun(lookupId: number, fireDate: string, nowMs?: number): Promise<ClaimRunResult>;
  recordRunSuccess(runId: number, sentAt?: number): Promise<void>;
  recordRunFailure(runId: number, error: string): Promise<void>;
  getLatestRun(lookupId: number): Promise<ScheduledLookupRunRow | undefined>;
  getRunsForLookup(lookupId: number): Promise<ScheduledLookupRunRow[]>;
}

function mapLookupRow(raw: any): ScheduledLookupRow {
  return {
    id: Number(raw.id),
    chatId: String(raw.chat_id ?? raw.chatId),
    instruction: String(raw.instruction),
    recurrence: raw.recurrence as LookupRecurrence,
    hour: Number(raw.hour),
    minute: Number(raw.minute),
    weekday: raw.weekday !== null && raw.weekday !== undefined ? Number(raw.weekday) : null,
    dayOfMonth:
      (raw.day_of_month ?? raw.dayOfMonth) !== null && (raw.day_of_month ?? raw.dayOfMonth) !== undefined
        ? Number(raw.day_of_month ?? raw.dayOfMonth)
        : null,
    active: Boolean(raw.active),
    createdBy: String(raw.created_by ?? raw.createdBy),
    createdAt: Number(raw.created_at ?? raw.createdAt),
    updatedAt: Number(raw.updated_at ?? raw.updatedAt),
  };
}

function mapRunRow(raw: any): ScheduledLookupRunRow {
  return {
    id: Number(raw.id),
    lookupId: Number(raw.lookup_id ?? raw.lookupId),
    fireDate: String(raw.fire_date ?? raw.fireDate),
    status: raw.status as RunStatus,
    attemptCount: Number(raw.attempt_count ?? raw.attemptCount),
    lastError: (raw.last_error ?? raw.lastError) ? String(raw.last_error ?? raw.lastError) : null,
    sentAt:
      (raw.sent_at ?? raw.sentAt) !== null && (raw.sent_at ?? raw.sentAt) !== undefined
        ? Number(raw.sent_at ?? raw.sentAt)
        : null,
    startedAt: Number(raw.started_at ?? raw.startedAt),
  };
}

export function getVnTime(date: Date) {
  const parts = getUtc7Parts(date);
  const dateStr = formatUtc7DateStr(date);
  const vnMs = date.getTime() + 7 * 60 * 60 * 1000;
  const vnDate = new Date(vnMs);
  const hour = vnDate.getUTCHours();
  const minute = vnDate.getUTCMinutes();
  const dayOfWeek = vnDate.getUTCDay(); // 0 = Sunday
  return { parts, dateStr, hour, minute, dayOfWeek };
}

export function isScheduleMatch(
  lookup: { recurrence: LookupRecurrence; weekday: number | null; dayOfMonth: number | null },
  referenceDate: Date,
): boolean {
  const { parts, dayOfWeek } = getVnTime(referenceDate);

  if (lookup.recurrence === "daily") {
    return true;
  }

  if (lookup.recurrence === "weekly") {
    return lookup.weekday !== null && lookup.weekday === dayOfWeek;
  }

  if (lookup.recurrence === "monthly") {
    if (lookup.dayOfMonth === null) return false;
    const daysInMonth = getDaysInSolarMonth(parts.year, parts.month);
    const clampedTargetDay = Math.min(lookup.dayOfMonth, daysInMonth);
    return parts.day === clampedTargetDay;
  }

  return false;
}

export function isTimeDue(
  lookup: { hour: number; minute: number },
  referenceDate: Date,
): boolean {
  const { hour, minute } = getVnTime(referenceDate);
  if (hour > lookup.hour) return true;
  if (hour === lookup.hour && minute >= lookup.minute) return true;
  return false;
}

export function createLookupRepository(db: SqliteDatabase): LookupRepository {
  const repo: LookupRepository = {
    async createLookup(input: CreateLookupInput): Promise<ScheduledLookupRow> {
      const now = Date.now();
      const active = input.active !== undefined ? (input.active ? 1 : 0) : 1;
      const weekday = input.weekday !== undefined ? input.weekday : null;
      const dayOfMonth = input.dayOfMonth !== undefined ? input.dayOfMonth : null;

      const info = await db.execute({
        sql: `INSERT INTO scheduled_lookups (
          chat_id, instruction, recurrence, hour, minute, weekday, day_of_month, active, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          input.chatId,
          input.instruction.trim(),
          input.recurrence,
          input.hour,
          input.minute,
          weekday,
          dayOfMonth,
          active,
          input.createdBy,
          now,
          now,
        ],
      });

      const id = Number(info.lastInsertRowid);
      const created = await repo.getLookupById(id);
      return created!;
    },

    async getLookupById(id: number): Promise<ScheduledLookupRow | undefined> {
      const res = await db.execute({
        sql: "SELECT * FROM scheduled_lookups WHERE id = ?",
        args: [id],
      });
      return res.rows[0] ? mapLookupRow(res.rows[0]) : undefined;
    },

    async listLookups(chatId?: string): Promise<ScheduledLookupWithLastRun[]> {
      const res = chatId
        ? await db.execute({
            sql: "SELECT * FROM scheduled_lookups WHERE chat_id = ? ORDER BY id ASC",
            args: [chatId],
          })
        : await db.execute({
            sql: "SELECT * FROM scheduled_lookups ORDER BY id ASC",
            args: [],
          });

      const lookups = res.rows.map(mapLookupRow);
      return Promise.all(
        lookups.map(async (lookup) => {
          const lastRun = await repo.getLatestRun(lookup.id);
          return {
            ...lookup,
            lastRun,
          };
        }),
      );
    },

    async updateLookup(id: number, updates: UpdateLookupInput): Promise<ScheduledLookupRow | undefined> {
      const existing = await repo.getLookupById(id);
      if (!existing) return undefined;

      const instruction = updates.instruction !== undefined ? updates.instruction.trim() : existing.instruction;
      const recurrence = updates.recurrence !== undefined ? updates.recurrence : existing.recurrence;
      const hour = updates.hour !== undefined ? updates.hour : existing.hour;
      const minute = updates.minute !== undefined ? updates.minute : existing.minute;
      const weekday = updates.weekday !== undefined ? updates.weekday : existing.weekday;
      const dayOfMonth = updates.dayOfMonth !== undefined ? updates.dayOfMonth : existing.dayOfMonth;
      const active = updates.active !== undefined ? (updates.active ? 1 : 0) : existing.active ? 1 : 0;
      const updatedAt = Date.now();

      await db.execute({
        sql: `UPDATE scheduled_lookups
              SET instruction = ?, recurrence = ?, hour = ?, minute = ?, weekday = ?, day_of_month = ?, active = ?, updated_at = ?
              WHERE id = ?`,
        args: [instruction, recurrence, hour, minute, weekday, dayOfMonth, active, updatedAt, id],
      });

      return repo.getLookupById(id);
    },

    async cancelLookup(id: number): Promise<boolean> {
      const res = await db.execute({
        sql: "DELETE FROM scheduled_lookups WHERE id = ?",
        args: [id],
      });
      return res.rowsAffected > 0;
    },

    async findDueLookups(referenceDate = new Date()): Promise<ScheduledLookupRow[]> {
      const { dateStr } = getVnTime(referenceDate);
      const res = await db.execute({
        sql: "SELECT * FROM scheduled_lookups WHERE active = 1",
        args: [],
      });
      const activeLookups = res.rows.map(mapLookupRow);
      const due: ScheduledLookupRow[] = [];

      for (const lookup of activeLookups) {
        if (!isScheduleMatch(lookup, referenceDate)) continue;
        if (!isTimeDue(lookup, referenceDate)) continue;

        const runRes = await db.execute({
          sql: "SELECT * FROM scheduled_lookup_runs WHERE lookup_id = ? AND fire_date = ?",
          args: [lookup.id, dateStr],
        });
        const run = runRes.rows[0] ? mapRunRow(runRes.rows[0]) : undefined;

        if (!run) {
          due.push(lookup);
          continue;
        }

        if (run.status === "sent" || run.status === "failed") {
          continue;
        }

        if (run.status === "running") {
          if (run.attemptCount >= 3) {
            continue;
          }
          const nowMs = referenceDate.getTime();
          const tenMinutesMs = 10 * 60 * 1000;
          if (nowMs - run.startedAt >= tenMinutesMs || run.startedAt === 0) {
            due.push(lookup);
          }
        }
      }

      return due;
    },

    async claimRun(lookupId: number, fireDate: string, nowMs = Date.now()): Promise<ClaimRunResult> {
      const tx = await db.transaction("write");
      try {
        const existingRes = await tx.execute({
          sql: "SELECT * FROM scheduled_lookup_runs WHERE lookup_id = ? AND fire_date = ?",
          args: [lookupId, fireDate],
        });

        if (!existingRes.rows[0]) {
          const insertRes = await tx.execute({
            sql: `INSERT INTO scheduled_lookup_runs (lookup_id, fire_date, status, attempt_count, last_error, sent_at, started_at)
                  VALUES (?, ?, 'running', 1, NULL, NULL, ?)`,
            args: [lookupId, fireDate, nowMs],
          });
          const newRunId = Number(insertRes.lastInsertRowid);
          const runRes = await tx.execute({
            sql: "SELECT * FROM scheduled_lookup_runs WHERE id = ?",
            args: [newRunId],
          });
          await tx.commit();
          const run = mapRunRow(runRes.rows[0]);
          return { claimed: true, run };
        }

        const run = mapRunRow(existingRes.rows[0]);
        if (run.status === "sent" || run.status === "failed") {
          await tx.commit();
          return { claimed: false, run, reason: "already_completed" };
        }

        if (run.status === "running") {
          if (run.attemptCount >= 3) {
            await tx.execute({
              sql: "UPDATE scheduled_lookup_runs SET status = 'failed' WHERE id = ?",
              args: [run.id],
            });
            await tx.commit();
            return { claimed: false, run: { ...run, status: "failed" }, reason: "max_attempts" };
          }

          const tenMinutesMs = 10 * 60 * 1000;
          if (nowMs - run.startedAt >= tenMinutesMs || run.startedAt === 0) {
            // Reclaim crashed attempt
            const newCount = run.attemptCount + 1;
            await tx.execute({
              sql: `UPDATE scheduled_lookup_runs
                    SET status = 'running', attempt_count = ?, started_at = ?
                    WHERE id = ?`,
              args: [newCount, nowMs, run.id],
            });

            const updatedRes = await tx.execute({
              sql: "SELECT * FROM scheduled_lookup_runs WHERE id = ?",
              args: [run.id],
            });
            await tx.commit();
            const updated = mapRunRow(updatedRes.rows[0]);
            return { claimed: true, run: updated };
          }

          await tx.commit();
          return { claimed: false, run, reason: "in_progress" };
        }

        await tx.commit();
        return { claimed: false, run, reason: "unknown" };
      } catch (err) {
        await tx.rollback();
        throw err;
      }
    },

    async recordRunSuccess(runId: number, sentAt = Date.now()): Promise<void> {
      await db.execute({
        sql: `UPDATE scheduled_lookup_runs
              SET status = 'sent', sent_at = ?
              WHERE id = ?`,
        args: [sentAt, runId],
      });
    },

    async recordRunFailure(runId: number, error: string): Promise<void> {
      const res = await db.execute({
        sql: "SELECT * FROM scheduled_lookup_runs WHERE id = ?",
        args: [runId],
      });
      const row = res.rows[0];
      if (!row) return;

      const attemptCount = Number(row.attempt_count ?? row.attemptCount);
      if (attemptCount >= 3) {
        await db.execute({
          sql: `UPDATE scheduled_lookup_runs
                SET status = 'failed', last_error = ?
                WHERE id = ?`,
          args: [error, runId],
        });
      } else {
        await db.execute({
          sql: `UPDATE scheduled_lookup_runs
                SET last_error = ?, started_at = 0
                WHERE id = ?`,
          args: [error, runId],
        });
      }
    },

    async getLatestRun(lookupId: number): Promise<ScheduledLookupRunRow | undefined> {
      const res = await db.execute({
        sql: "SELECT * FROM scheduled_lookup_runs WHERE lookup_id = ? ORDER BY id DESC LIMIT 1",
        args: [lookupId],
      });
      return res.rows[0] ? mapRunRow(res.rows[0]) : undefined;
    },

    async getRunsForLookup(lookupId: number): Promise<ScheduledLookupRunRow[]> {
      const res = await db.execute({
        sql: "SELECT * FROM scheduled_lookup_runs WHERE lookup_id = ? ORDER BY id ASC",
        args: [lookupId],
      });
      return res.rows.map(mapRunRow);
    },
  };

  return repo;
}
