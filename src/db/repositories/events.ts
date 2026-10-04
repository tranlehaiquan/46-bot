import type { SqliteDatabase } from "../connection.js";
import { lunarToSolar } from "../../lunar/index.js";

export type EventKind = "event" | "reminder" | "birthday" | "anniversary" | "gio" | "appointment";
export type EventCalendar = "solar" | "lunar";
export type EventRecurrence = "none" | "yearly" | "monthly" | "weekly" | "daily";

export type EventRow = {
  id: number;
  chatId: string;
  title: string;
  kind: EventKind;
  calendar: EventCalendar;
  day: number;
  month: number;
  year: number | null;
  isLeapMonth: boolean;
  recurrence: EventRecurrence;
  remindDaysBefore: number;
  notes: string | null;
  createdBy: string;
  ts: number;
};

export type CreateEventInput = {
  chatId: string;
  title: string;
  kind?: EventKind;
  calendar?: EventCalendar;
  day: number;
  month: number;
  year?: number | null;
  isLeapMonth?: boolean;
  recurrence?: EventRecurrence;
  remindDaysBefore?: number;
  notes?: string | null;
  createdBy: string;
};

export type UpdateEventInput = {
  title?: string;
  kind?: EventKind;
  calendar?: EventCalendar;
  day?: number;
  month?: number;
  year?: number | null;
  isLeapMonth?: boolean;
  recurrence?: EventRecurrence;
  remindDaysBefore?: number;
  notes?: string | null;
};

export type UpcomingEvent = {
  event: EventRow;
  occurrenceDate: Date;
  occurrenceDateStr: string;
  daysRemaining: number;
};

export interface EventsRepository {
  createEvent(input: CreateEventInput): EventRow;
  getEventById(id: number): EventRow | undefined;
  getEventsByChat(chatId: string): EventRow[];
  updateEvent(id: number, updates: UpdateEventInput): EventRow | undefined;
  deleteEvent(id: number): boolean;
  listUpcomingEvents(chatId: string, windowDays?: number, referenceDate?: Date): UpcomingEvent[];
}

export function getUtc7Parts(date: Date): { year: number; month: number; day: number } {
  const utcMs = date.getTime();
  const vnDate = new Date(utcMs + 7 * 60 * 60 * 1000);
  return {
    year: vnDate.getUTCFullYear(),
    month: vnDate.getUTCMonth() + 1,
    day: vnDate.getUTCDate(),
  };
}

export function getDaysInSolarMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function createUtc7Date(year: number, month: number, day: number): Date {
  const safeDay = Math.min(Math.max(1, day), getDaysInSolarMonth(year, month));
  const utcMs = Date.UTC(year, month - 1, safeDay) - 7 * 60 * 60 * 1000;
  return new Date(utcMs);
}

export function diffDays(targetDate: Date, refDate: Date): number {
  const targetParts = getUtc7Parts(targetDate);
  const refParts = getUtc7Parts(refDate);
  const targetMidnight = Date.UTC(targetParts.year, targetParts.month - 1, targetParts.day);
  const refMidnight = Date.UTC(refParts.year, refParts.month - 1, refParts.day);
  return Math.round((targetMidnight - refMidnight) / (24 * 60 * 60 * 1000));
}

export function formatUtc7DateStr(date: Date): string {
  const parts = getUtc7Parts(date);
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  return `${parts.year}-${mm}-${dd}`;
}

function getUtc7DayOfWeek(date: Date): number {
  const parts = getUtc7Parts(date);
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return d.getUTCDay();
}

export function getNextOccurrence(
  event: EventRow,
  referenceDate: Date = new Date(),
): { date: Date; dateStr: string; daysRemaining: number } | null {
  const refParts = getUtc7Parts(referenceDate);

  if (event.calendar === "lunar") {
    if (event.recurrence === "none") {
      const targetLunarYear = event.year ?? refParts.year;
      const solar = lunarToSolar(event.day, event.month, targetLunarYear, event.isLeapMonth);
      const targetDate = createUtc7Date(solar.year, solar.month, solar.day);
      const daysRemaining = diffDays(targetDate, referenceDate);
      if (daysRemaining < 0) {
        return null;
      }
      return {
        date: targetDate,
        dateStr: formatUtc7DateStr(targetDate),
        daysRemaining,
      };
    }

    // Yearly or recurring lunar event
    const candidateYears = [
      refParts.year - 1,
      refParts.year,
      refParts.year + 1,
      refParts.year + 2,
    ];

    let bestOccurrence: { date: Date; dateStr: string; daysRemaining: number } | null = null;

    for (const candYear of candidateYears) {
      const solar = lunarToSolar(event.day, event.month, candYear, event.isLeapMonth);
      const targetDate = createUtc7Date(solar.year, solar.month, solar.day);
      const days = diffDays(targetDate, referenceDate);
      if (days >= 0) {
        if (!bestOccurrence || days < bestOccurrence.daysRemaining) {
          bestOccurrence = {
            date: targetDate,
            dateStr: formatUtc7DateStr(targetDate),
            daysRemaining: days,
          };
        }
      }
    }

    return bestOccurrence;
  }

  // Solar events
  if (event.recurrence === "none") {
    const targetYear = event.year ?? refParts.year;
    const targetDate = createUtc7Date(targetYear, event.month, event.day);
    const days = diffDays(targetDate, referenceDate);
    if (days < 0) {
      return null;
    }
    return {
      date: targetDate,
      dateStr: formatUtc7DateStr(targetDate),
      daysRemaining: days,
    };
  }

  if (event.recurrence === "yearly") {
    const targetThisYear = createUtc7Date(refParts.year, event.month, event.day);
    const daysThisYear = diffDays(targetThisYear, referenceDate);
    if (daysThisYear >= 0) {
      return {
        date: targetThisYear,
        dateStr: formatUtc7DateStr(targetThisYear),
        daysRemaining: daysThisYear,
      };
    }
    const targetNextYear = createUtc7Date(refParts.year + 1, event.month, event.day);
    const daysNextYear = diffDays(targetNextYear, referenceDate);
    return {
      date: targetNextYear,
      dateStr: formatUtc7DateStr(targetNextYear),
      daysRemaining: daysNextYear,
    };
  }

  if (event.recurrence === "monthly") {
    const targetThisMonth = createUtc7Date(refParts.year, refParts.month, event.day);
    const daysThisMonth = diffDays(targetThisMonth, referenceDate);
    if (daysThisMonth >= 0) {
      return {
        date: targetThisMonth,
        dateStr: formatUtc7DateStr(targetThisMonth),
        daysRemaining: daysThisMonth,
      };
    }
    let nextMonth = refParts.month + 1;
    let nextYear = refParts.year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const targetNextMonth = createUtc7Date(nextYear, nextMonth, event.day);
    return {
      date: targetNextMonth,
      dateStr: formatUtc7DateStr(targetNextMonth),
      daysRemaining: diffDays(targetNextMonth, referenceDate),
    };
  }

  if (event.recurrence === "weekly") {
    const baseDate = createUtc7Date(event.year ?? refParts.year, event.month, event.day);
    const targetDayOfWeek = getUtc7DayOfWeek(baseDate);
    const currentDayOfWeek = getUtc7DayOfWeek(referenceDate);
    const dayOffset = (targetDayOfWeek - currentDayOfWeek + 7) % 7;
    const targetDate = createUtc7Date(refParts.year, refParts.month, refParts.day + dayOffset);
    return {
      date: targetDate,
      dateStr: formatUtc7DateStr(targetDate),
      daysRemaining: dayOffset,
    };
  }

  if (event.recurrence === "daily") {
    const targetDate = createUtc7Date(refParts.year, refParts.month, refParts.day);
    return {
      date: targetDate,
      dateStr: formatUtc7DateStr(targetDate),
      daysRemaining: 0,
    };
  }

  return null;
}

function mapEventRow(row: any): EventRow {
  return {
    id: row.id,
    chatId: row.chat_id,
    title: row.title,
    kind: row.kind as EventKind,
    calendar: row.calendar as EventCalendar,
    day: row.day,
    month: row.month,
    year: row.year ?? null,
    isLeapMonth: row.is_leap_month === 1,
    recurrence: row.recurrence as EventRecurrence,
    remindDaysBefore: row.remind_days_before,
    notes: row.notes ?? null,
    createdBy: row.created_by,
    ts: row.ts,
  };
}

export function createEventsRepository(db: SqliteDatabase): EventsRepository {
  const insertStmt = db.prepare(`
    INSERT INTO events (
      chat_id, title, kind, calendar, day, month, year,
      is_leap_month, recurrence, remind_days_before, notes, created_by, ts
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const getByIdStmt = db.prepare(`
    SELECT id, chat_id, title, kind, calendar, day, month, year,
           is_leap_month, recurrence, remind_days_before, notes, created_by, ts
    FROM events
    WHERE id = ?
  `);

  const getByChatStmt = db.prepare(`
    SELECT id, chat_id, title, kind, calendar, day, month, year,
           is_leap_month, recurrence, remind_days_before, notes, created_by, ts
    FROM events
    WHERE chat_id = ?
    ORDER BY id ASC
  `);

  const deleteByIdStmt = db.prepare(`
    DELETE FROM events
    WHERE id = ?
  `);

  const repo: EventsRepository = {
    createEvent(input: CreateEventInput): EventRow {
      const now = Date.now();
      const kind = input.kind ?? "event";
      const calendar = input.calendar ?? "solar";
      const recurrence = input.recurrence ?? "none";
      const remindDaysBefore = input.remindDaysBefore ?? 0;
      const isLeap = input.isLeapMonth ? 1 : 0;
      const year = input.year ?? null;
      const notes = input.notes ?? null;

      const result = insertStmt.run(
        input.chatId,
        input.title.trim(),
        kind,
        calendar,
        input.day,
        input.month,
        year,
        isLeap,
        recurrence,
        remindDaysBefore,
        notes,
        input.createdBy,
        now,
      );

      return {
        id: Number(result.lastInsertRowid),
        chatId: input.chatId,
        title: input.title.trim(),
        kind,
        calendar,
        day: input.day,
        month: input.month,
        year,
        isLeapMonth: Boolean(input.isLeapMonth),
        recurrence,
        remindDaysBefore,
        notes,
        createdBy: input.createdBy,
        ts: now,
      };
    },

    getEventById(id: number): EventRow | undefined {
      const row = getByIdStmt.get(id);
      return row ? mapEventRow(row) : undefined;
    },

    getEventsByChat(chatId: string): EventRow[] {
      const rows = getByChatStmt.all(chatId);
      return rows.map(mapEventRow);
    },

    updateEvent(id: number, updates: UpdateEventInput): EventRow | undefined {
      const existing = repo.getEventById(id);
      if (!existing) {
        return undefined;
      }

      const title = updates.title !== undefined ? updates.title.trim() : existing.title;
      const kind = updates.kind !== undefined ? updates.kind : existing.kind;
      const calendar = updates.calendar !== undefined ? updates.calendar : existing.calendar;
      const day = updates.day !== undefined ? updates.day : existing.day;
      const month = updates.month !== undefined ? updates.month : existing.month;
      const year = updates.year !== undefined ? updates.year : existing.year;
      const isLeap = updates.isLeapMonth !== undefined ? (updates.isLeapMonth ? 1 : 0) : (existing.isLeapMonth ? 1 : 0);
      const recurrence = updates.recurrence !== undefined ? updates.recurrence : existing.recurrence;
      const remindDaysBefore = updates.remindDaysBefore !== undefined ? updates.remindDaysBefore : existing.remindDaysBefore;
      const notes = updates.notes !== undefined ? updates.notes : existing.notes;

      db.prepare(`
        UPDATE events
        SET title = ?, kind = ?, calendar = ?, day = ?, month = ?, year = ?,
            is_leap_month = ?, recurrence = ?, remind_days_before = ?, notes = ?
        WHERE id = ?
      `).run(
        title,
        kind,
        calendar,
        day,
        month,
        year,
        isLeap,
        recurrence,
        remindDaysBefore,
        notes,
        id,
      );

      return repo.getEventById(id);
    },

    deleteEvent(id: number): boolean {
      const result = deleteByIdStmt.run(id);
      return result.changes > 0;
    },

    listUpcomingEvents(chatId: string, windowDays = 30, referenceDate = new Date()): UpcomingEvent[] {
      const events = repo.getEventsByChat(chatId);
      const upcoming: UpcomingEvent[] = [];

      for (const event of events) {
        const occ = getNextOccurrence(event, referenceDate);
        if (occ && occ.daysRemaining <= windowDays) {
          upcoming.push({
            event,
            occurrenceDate: occ.date,
            occurrenceDateStr: occ.dateStr,
            daysRemaining: occ.daysRemaining,
          });
        }
      }

      // Sort chronologically by days remaining ASC, then id ASC
      upcoming.sort((a, b) => {
        if (a.daysRemaining !== b.daysRemaining) {
          return a.daysRemaining - b.daysRemaining;
        }
        return a.event.id - b.event.id;
      });

      return upcoming;
    },
  };

  return repo;
}
