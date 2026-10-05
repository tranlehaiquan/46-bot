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
  createLookup(input: CreateLookupInput): ScheduledLookupRow;
  getLookupById(id: number): ScheduledLookupRow | undefined;
  listLookups(chatId?: string): ScheduledLookupWithLastRun[];
  updateLookup(id: number, updates: UpdateLookupInput): ScheduledLookupRow | undefined;
  cancelLookup(id: number): boolean;
  findDueLookups(referenceDate?: Date): ScheduledLookupRow[];
  claimRun(lookupId: number, fireDate: string, nowMs?: number): ClaimRunResult;
  recordRunSuccess(runId: number, sentAt?: number): void;
  recordRunFailure(runId: number, error: string): void;
  getLatestRun(lookupId: number): ScheduledLookupRunRow | undefined;
  getRunsForLookup(lookupId: number): ScheduledLookupRunRow[];
}

type RawLookupRow = {
  id: number;
  chat_id: string;
  instruction: string;
  recurrence: string;
  hour: number;
  minute: number;
  weekday: number | null;
  day_of_month: number | null;
  active: number;
  created_by: string;
  created_at: number;
  updated_at: number;
};

type RawRunRow = {
  id: number;
  lookup_id: number;
  fire_date: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  sent_at: number | null;
  started_at: number;
};

function mapLookupRow(raw: RawLookupRow): ScheduledLookupRow {
  return {
    id: raw.id,
    chatId: raw.chat_id,
    instruction: raw.instruction,
    recurrence: raw.recurrence as LookupRecurrence,
    hour: raw.hour,
    minute: raw.minute,
    weekday: raw.weekday,
    dayOfMonth: raw.day_of_month,
    active: Boolean(raw.active),
    createdBy: raw.created_by,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function mapRunRow(raw: RawRunRow): ScheduledLookupRunRow {
  return {
    id: raw.id,
    lookupId: raw.lookup_id,
    fireDate: raw.fire_date,
    status: raw.status as RunStatus,
    attemptCount: raw.attempt_count,
    lastError: raw.last_error,
    sentAt: raw.sent_at,
    startedAt: raw.started_at,
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
  const insertLookupStmt = db.prepare(`
    INSERT INTO scheduled_lookups (
      chat_id, instruction, recurrence, hour, minute, weekday, day_of_month, active, created_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const getByIdStmt = db.prepare("SELECT * FROM scheduled_lookups WHERE id = ?");
  const deleteByIdStmt = db.prepare("DELETE FROM scheduled_lookups WHERE id = ?");

  const repo: LookupRepository = {
    createLookup(input: CreateLookupInput): ScheduledLookupRow {
      const now = Date.now();
      const active = input.active !== undefined ? (input.active ? 1 : 0) : 1;
      const weekday = input.weekday !== undefined ? input.weekday : null;
      const dayOfMonth = input.dayOfMonth !== undefined ? input.dayOfMonth : null;

      const info = insertLookupStmt.run(
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
      );

      const id = Number(info.lastInsertRowid);
      return repo.getLookupById(id)!;
    },

    getLookupById(id: number): ScheduledLookupRow | undefined {
      const row = getByIdStmt.get(id) as RawLookupRow | undefined;
      return row ? mapLookupRow(row) : undefined;
    },

    listLookups(chatId?: string): ScheduledLookupWithLastRun[] {
      const lookups = chatId
        ? (db.prepare("SELECT * FROM scheduled_lookups WHERE chat_id = ? ORDER BY id ASC").all(chatId) as RawLookupRow[])
        : (db.prepare("SELECT * FROM scheduled_lookups ORDER BY id ASC").all() as RawLookupRow[]);

      return lookups.map((raw) => {
        const lookup = mapLookupRow(raw);
        const lastRun = repo.getLatestRun(lookup.id);
        return {
          ...lookup,
          lastRun,
        };
      });
    },

    updateLookup(id: number, updates: UpdateLookupInput): ScheduledLookupRow | undefined {
      const existing = repo.getLookupById(id);
      if (!existing) return undefined;

      const instruction = updates.instruction !== undefined ? updates.instruction.trim() : existing.instruction;
      const recurrence = updates.recurrence !== undefined ? updates.recurrence : existing.recurrence;
      const hour = updates.hour !== undefined ? updates.hour : existing.hour;
      const minute = updates.minute !== undefined ? updates.minute : existing.minute;
      const weekday = updates.weekday !== undefined ? updates.weekday : existing.weekday;
      const dayOfMonth = updates.dayOfMonth !== undefined ? updates.dayOfMonth : existing.dayOfMonth;
      const active = updates.active !== undefined ? (updates.active ? 1 : 0) : (existing.active ? 1 : 0);
      const updatedAt = Date.now();

      db.prepare(`
        UPDATE scheduled_lookups
        SET instruction = ?, recurrence = ?, hour = ?, minute = ?, weekday = ?, day_of_month = ?, active = ?, updated_at = ?
        WHERE id = ?
      `).run(instruction, recurrence, hour, minute, weekday, dayOfMonth, active, updatedAt, id);

      return repo.getLookupById(id);
    },

    cancelLookup(id: number): boolean {
      const result = deleteByIdStmt.run(id);
      return result.changes > 0;
    },

    findDueLookups(referenceDate = new Date()): ScheduledLookupRow[] {
      const { dateStr } = getVnTime(referenceDate);
      const activeLookups = db
        .prepare("SELECT * FROM scheduled_lookups WHERE active = 1")
        .all() as RawLookupRow[];

      const due: ScheduledLookupRow[] = [];

      for (const raw of activeLookups) {
        const lookup = mapLookupRow(raw);
        if (!isScheduleMatch(lookup, referenceDate)) continue;
        if (!isTimeDue(lookup, referenceDate)) continue;

        const run = db
          .prepare("SELECT * FROM scheduled_lookup_runs WHERE lookup_id = ? AND fire_date = ?")
          .get(lookup.id, dateStr) as RawRunRow | undefined;

        if (!run) {
          due.push(lookup);
          continue;
        }

        if (run.status === "sent" || run.status === "failed") {
          continue;
        }

        if (run.status === "running") {
          if (run.attempt_count >= 3) {
            continue;
          }
          const nowMs = referenceDate.getTime();
          const tenMinutesMs = 10 * 60 * 1000;
          if (nowMs - run.started_at >= tenMinutesMs || run.started_at === 0) {
            due.push(lookup);
          }
        }
      }

      return due;
    },

    claimRun(lookupId: number, fireDate: string, nowMs = Date.now()): ClaimRunResult {
      return db.transaction((): ClaimRunResult => {
        const existing = db
          .prepare("SELECT * FROM scheduled_lookup_runs WHERE lookup_id = ? AND fire_date = ?")
          .get(lookupId, fireDate) as RawRunRow | undefined;

        if (!existing) {
          const insertStmt = db.prepare(`
            INSERT INTO scheduled_lookup_runs (lookup_id, fire_date, status, attempt_count, last_error, sent_at, started_at)
            VALUES (?, ?, 'running', 1, NULL, NULL, ?)
          `);
          const info = insertStmt.run(lookupId, fireDate, nowMs);
          const newRunId = Number(info.lastInsertRowid);
          const run = mapRunRow(
            db.prepare("SELECT * FROM scheduled_lookup_runs WHERE id = ?").get(newRunId) as RawRunRow,
          );
          return { claimed: true, run };
        }

        const run = mapRunRow(existing);
        if (run.status === "sent" || run.status === "failed") {
          return { claimed: false, run, reason: "already_completed" };
        }

        if (run.status === "running") {
          if (run.attemptCount >= 3) {
            db.prepare("UPDATE scheduled_lookup_runs SET status = 'failed' WHERE id = ?").run(run.id);
            return { claimed: false, run: { ...run, status: "failed" }, reason: "max_attempts" };
          }

          const tenMinutesMs = 10 * 60 * 1000;
          if (nowMs - run.startedAt >= tenMinutesMs || run.startedAt === 0) {
            // Reclaim crashed attempt
            const newCount = run.attemptCount + 1;
            db.prepare(`
              UPDATE scheduled_lookup_runs
              SET status = 'running', attempt_count = ?, started_at = ?
              WHERE id = ?
            `).run(newCount, nowMs, run.id);

            const updated = mapRunRow(
              db.prepare("SELECT * FROM scheduled_lookup_runs WHERE id = ?").get(run.id) as RawRunRow,
            );
            return { claimed: true, run: updated };
          }

          return { claimed: false, run, reason: "in_progress" };
        }

        return { claimed: false, run, reason: "unknown" };
      })();
    },

    recordRunSuccess(runId: number, sentAt = Date.now()): void {
      db.prepare(`
        UPDATE scheduled_lookup_runs
        SET status = 'sent', sent_at = ?
        WHERE id = ?
      `).run(sentAt, runId);
    },

    recordRunFailure(runId: number, error: string): void {
      const row = db.prepare("SELECT * FROM scheduled_lookup_runs WHERE id = ?").get(runId) as RawRunRow | undefined;
      if (!row) return;

      if (row.attempt_count >= 3) {
        db.prepare(`
          UPDATE scheduled_lookup_runs
          SET status = 'failed', last_error = ?
          WHERE id = ?
        `).run(error, runId);
      } else {
        db.prepare(`
          UPDATE scheduled_lookup_runs
          SET last_error = ?, started_at = 0
          WHERE id = ?
        `).run(error, runId);
      }
    },

    getLatestRun(lookupId: number): ScheduledLookupRunRow | undefined {
      const row = db
        .prepare("SELECT * FROM scheduled_lookup_runs WHERE lookup_id = ? ORDER BY id DESC LIMIT 1")
        .get(lookupId) as RawRunRow | undefined;
      return row ? mapRunRow(row) : undefined;
    },

    getRunsForLookup(lookupId: number): ScheduledLookupRunRow[] {
      const rows = db
        .prepare("SELECT * FROM scheduled_lookup_runs WHERE lookup_id = ? ORDER BY id ASC")
        .all(lookupId) as RawRunRow[];
      return rows.map(mapRunRow);
    },
  };

  return repo;
}
