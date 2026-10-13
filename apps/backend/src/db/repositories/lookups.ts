import { and, asc, desc, eq } from "drizzle-orm";
import { createDrizzleDb, type SqliteDatabase } from "../connection.js";
import { scheduledLookupRuns, scheduledLookups } from "../schema/index.js";
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

function toLookupRow(row: typeof scheduledLookups.$inferSelect): ScheduledLookupRow {
  return {
    id: row.id,
    chatId: row.chatId,
    instruction: row.instruction,
    recurrence: row.recurrence as LookupRecurrence,
    hour: row.hour,
    minute: row.minute,
    weekday: row.weekday ?? null,
    dayOfMonth: row.dayOfMonth ?? null,
    active: row.active === 1,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRunRow(row: typeof scheduledLookupRuns.$inferSelect): ScheduledLookupRunRow {
  return {
    id: row.id,
    lookupId: row.lookupId,
    fireDate: row.fireDate,
    status: row.status as RunStatus,
    attemptCount: row.attemptCount,
    lastError: row.lastError ?? null,
    sentAt: row.sentAt ?? null,
    startedAt: row.startedAt,
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
  const orm = createDrizzleDb(db);
  const repo: LookupRepository = {
    async createLookup(input: CreateLookupInput): Promise<ScheduledLookupRow> {
      const now = Date.now();
      const [row] = await orm
        .insert(scheduledLookups)
        .values({
          chatId: input.chatId,
          instruction: input.instruction.trim(),
          recurrence: input.recurrence,
          hour: input.hour,
          minute: input.minute,
          weekday: input.weekday !== undefined ? input.weekday : null,
          dayOfMonth: input.dayOfMonth !== undefined ? input.dayOfMonth : null,
          active: input.active !== undefined ? (input.active ? 1 : 0) : 1,
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return toLookupRow(row);
    },

    async getLookupById(id: number): Promise<ScheduledLookupRow | undefined> {
      const [row] = await orm.select().from(scheduledLookups).where(eq(scheduledLookups.id, id)).limit(1);
      return row ? toLookupRow(row) : undefined;
    },

    async listLookups(chatId?: string): Promise<ScheduledLookupWithLastRun[]> {
      const rows = chatId
        ? await orm.select().from(scheduledLookups).where(eq(scheduledLookups.chatId, chatId)).orderBy(asc(scheduledLookups.id))
        : await orm.select().from(scheduledLookups).orderBy(asc(scheduledLookups.id));

      const lookups = rows.map(toLookupRow);
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
      const active = updates.active !== undefined ? updates.active : existing.active;
      const updatedAt = Date.now();

      await orm
        .update(scheduledLookups)
        .set({
          instruction,
          recurrence,
          hour,
          minute,
          weekday,
          dayOfMonth,
          active: active ? 1 : 0,
          updatedAt,
        })
        .where(eq(scheduledLookups.id, id));

      return repo.getLookupById(id);
    },

    async cancelLookup(id: number): Promise<boolean> {
      const deleted = await orm.delete(scheduledLookups).where(eq(scheduledLookups.id, id)).returning();
      return deleted.length > 0;
    },

    async findDueLookups(referenceDate = new Date()): Promise<ScheduledLookupRow[]> {
      const { dateStr } = getVnTime(referenceDate);
      const activeLookups = (await orm.select().from(scheduledLookups).where(eq(scheduledLookups.active, 1))).map(toLookupRow);
      const due: ScheduledLookupRow[] = [];

      for (const lookup of activeLookups) {
        if (!isScheduleMatch(lookup, referenceDate)) continue;
        if (!isTimeDue(lookup, referenceDate)) continue;

        const [runRow] = await orm
          .select()
          .from(scheduledLookupRuns)
          .where(and(eq(scheduledLookupRuns.lookupId, lookup.id), eq(scheduledLookupRuns.fireDate, dateStr)))
          .limit(1);
        const run = runRow ? toRunRow(runRow) : undefined;

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
      return orm.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(scheduledLookupRuns)
          .where(and(eq(scheduledLookupRuns.lookupId, lookupId), eq(scheduledLookupRuns.fireDate, fireDate)))
          .limit(1);

        if (!existing) {
          const [inserted] = await tx
            .insert(scheduledLookupRuns)
            .values({
              lookupId,
              fireDate,
              status: "running",
              attemptCount: 1,
              lastError: null,
              sentAt: null,
              startedAt: nowMs,
            })
            .returning();
          return { claimed: true as const, run: toRunRow(inserted) };
        }

        const run = toRunRow(existing);
        if (run.status === "sent" || run.status === "failed") {
          return { claimed: false as const, run, reason: "already_completed" };
        }

        if (run.status === "running") {
          if (run.attemptCount >= 3) {
            await tx.update(scheduledLookupRuns).set({ status: "failed" }).where(eq(scheduledLookupRuns.id, run.id));
            return { claimed: false as const, run: { ...run, status: "failed" }, reason: "max_attempts" };
          }

          const tenMinutesMs = 10 * 60 * 1000;
          if (nowMs - run.startedAt >= tenMinutesMs || run.startedAt === 0) {
            const newCount = run.attemptCount + 1;
            const [updated] = await tx
              .update(scheduledLookupRuns)
              .set({ status: "running", attemptCount: newCount, startedAt: nowMs })
              .where(eq(scheduledLookupRuns.id, run.id))
              .returning();
            return { claimed: true as const, run: toRunRow(updated) };
          }

          return { claimed: false as const, run, reason: "in_progress" };
        }

        return { claimed: false as const, run, reason: "unknown" };
      });
    },

    async recordRunSuccess(runId: number, sentAt = Date.now()): Promise<void> {
      await orm.update(scheduledLookupRuns).set({ status: "sent", sentAt }).where(eq(scheduledLookupRuns.id, runId));
    },

    async recordRunFailure(runId: number, error: string): Promise<void> {
      const [row] = await orm.select().from(scheduledLookupRuns).where(eq(scheduledLookupRuns.id, runId)).limit(1);
      if (!row) return;

      if (row.attemptCount >= 3) {
        await orm.update(scheduledLookupRuns).set({ status: "failed", lastError: error }).where(eq(scheduledLookupRuns.id, runId));
      } else {
        await orm
          .update(scheduledLookupRuns)
          .set({ lastError: error, startedAt: 0 })
          .where(eq(scheduledLookupRuns.id, runId));
      }
    },

    async getLatestRun(lookupId: number): Promise<ScheduledLookupRunRow | undefined> {
      const [row] = await orm
        .select()
        .from(scheduledLookupRuns)
        .where(eq(scheduledLookupRuns.lookupId, lookupId))
        .orderBy(desc(scheduledLookupRuns.id))
        .limit(1);
      return row ? toRunRow(row) : undefined;
    },

    async getRunsForLookup(lookupId: number): Promise<ScheduledLookupRunRow[]> {
      return (
        await orm
          .select()
          .from(scheduledLookupRuns)
          .where(eq(scheduledLookupRuns.lookupId, lookupId))
          .orderBy(asc(scheduledLookupRuns.id))
      ).map(toRunRow);
    },
  };

  return repo;
}
