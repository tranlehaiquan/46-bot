import type { SqliteDatabase } from "../connection.js";
import { lunarToSolar, solarToLunar } from "../../lunar/index.js";

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

export type DueReminder = {
  event: EventRow;
  occurrenceDate: Date;
  occurrenceDateStr: string;
  daysRemaining: number;
  isAdvanceNotice: boolean;
};

export type EventOccurrence = {
  event: EventRow;
  occurrenceDate: Date;
  occurrenceDateStr: string;
  dayOfWeek: number;
  solarDay: number;
  solarMonth: number;
  solarYear: number;
  lunarDay: number;
  lunarMonth: number;
  lunarYear: number;
  isLunarLeap: boolean;
};

export interface EventsRepository {
  createEvent(input: CreateEventInput): Promise<EventRow>;
  getEventById(id: number): Promise<EventRow | undefined>;
  getEventsByChat(chatId: string): Promise<EventRow[]>;
  getAllEvents(): Promise<EventRow[]>;
  updateEvent(id: number, updates: UpdateEventInput): Promise<EventRow | undefined>;
  deleteEvent(id: number): Promise<boolean>;
  listUpcomingEvents(chatId: string, windowDays?: number, referenceDate?: Date): Promise<UpcomingEvent[]>;
  getEventsForRange(chatId: string, startDate: Date, endDate: Date): Promise<EventOccurrence[]>;
  getEventsForWeek(chatId: string, referenceDate?: Date): Promise<EventOccurrence[]>;
  getEventsForMonth(chatId: string, year: number, month: number): Promise<EventOccurrence[]>;
  getEventsForYear(chatId: string, year: number): Promise<EventOccurrence[]>;
  isReminderSent(eventId: number, occurrenceDate: string): Promise<boolean>;
  recordReminderSent(eventId: number, occurrenceDate: string, sentAt?: number): Promise<void>;
  findEventsDueForReminder(referenceDate?: Date, chatId?: string): Promise<DueReminder[]>;
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

export function getUtc7DayOfWeek(date: Date): number {
  const parts = getUtc7Parts(date);
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return d.getUTCDay();
}

export function getStartOfWeekUtc7(date: Date): Date {
  const parts = getUtc7Parts(date);
  const dow = getUtc7DayOfWeek(date);
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return createUtc7Date(parts.year, parts.month, parts.day + diffToMonday);
}

export function getEndOfWeekUtc7(date: Date): Date {
  const monday = getStartOfWeekUtc7(date);
  const mParts = getUtc7Parts(monday);
  return createUtc7Date(mParts.year, mParts.month, mParts.day + 6);
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
    id: Number(row.id),
    chatId: String(row.chat_id ?? row.chatId),
    title: String(row.title),
    kind: row.kind as EventKind,
    calendar: row.calendar as EventCalendar,
    day: Number(row.day),
    month: Number(row.month),
    year: row.year !== null && row.year !== undefined ? Number(row.year) : null,
    isLeapMonth: Number(row.is_leap_month ?? row.isLeapMonth) === 1,
    recurrence: row.recurrence as EventRecurrence,
    remindDaysBefore: Number(row.remind_days_before ?? row.remindDaysBefore),
    notes: row.notes !== null && row.notes !== undefined ? String(row.notes) : null,
    createdBy: String(row.created_by ?? row.createdBy),
    ts: Number(row.ts),
  };
}

export function createEventsRepository(db: SqliteDatabase): EventsRepository {
  const repo: EventsRepository = {
    async createEvent(input: CreateEventInput): Promise<EventRow> {
      const now = Date.now();
      const kind = input.kind ?? "event";
      const calendar = input.calendar ?? "solar";
      const recurrence = input.recurrence ?? "none";
      const remindDaysBefore = input.remindDaysBefore ?? 0;
      const isLeap = input.isLeapMonth ? 1 : 0;
      const year = input.year ?? null;
      const notes = input.notes ?? null;

      const result = await db.execute({
        sql: `INSERT INTO events (
          chat_id, title, kind, calendar, day, month, year,
          is_leap_month, recurrence, remind_days_before, notes, created_by, ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
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
        ],
      });

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

    async getEventById(id: number): Promise<EventRow | undefined> {
      const res = await db.execute({
        sql: `SELECT id, chat_id as chatId, title, kind, calendar, day, month, year,
                     is_leap_month as isLeapMonth, recurrence, remind_days_before as remindDaysBefore,
                     notes, created_by as createdBy, ts
              FROM events
              WHERE id = ?`,
        args: [id],
      });
      return res.rows[0] ? mapEventRow(res.rows[0]) : undefined;
    },

    async getEventsByChat(chatId: string): Promise<EventRow[]> {
      const res = await db.execute({
        sql: `SELECT id, chat_id as chatId, title, kind, calendar, day, month, year,
                     is_leap_month as isLeapMonth, recurrence, remind_days_before as remindDaysBefore,
                     notes, created_by as createdBy, ts
              FROM events
              WHERE chat_id = ?
              ORDER BY id ASC`,
        args: [chatId],
      });
      return res.rows.map(mapEventRow);
    },

    async updateEvent(id: number, updates: UpdateEventInput): Promise<EventRow | undefined> {
      const existing = await repo.getEventById(id);
      if (!existing) {
        return undefined;
      }

      const title = updates.title !== undefined ? updates.title.trim() : existing.title;
      const kind = updates.kind !== undefined ? updates.kind : existing.kind;
      const calendar = updates.calendar !== undefined ? updates.calendar : existing.calendar;
      const day = updates.day !== undefined ? updates.day : existing.day;
      const month = updates.month !== undefined ? updates.month : existing.month;
      const year = updates.year !== undefined ? updates.year : existing.year;
      const isLeap = updates.isLeapMonth !== undefined ? (updates.isLeapMonth ? 1 : 0) : existing.isLeapMonth ? 1 : 0;
      const recurrence = updates.recurrence !== undefined ? updates.recurrence : existing.recurrence;
      const remindDaysBefore =
        updates.remindDaysBefore !== undefined ? updates.remindDaysBefore : existing.remindDaysBefore;
      const notes = updates.notes !== undefined ? updates.notes : existing.notes;

      await db.execute({
        sql: `UPDATE events
              SET title = ?, kind = ?, calendar = ?, day = ?, month = ?, year = ?,
                  is_leap_month = ?, recurrence = ?, remind_days_before = ?, notes = ?
              WHERE id = ?`,
        args: [title, kind, calendar, day, month, year, isLeap, recurrence, remindDaysBefore, notes, id],
      });

      return repo.getEventById(id);
    },

    async deleteEvent(id: number): Promise<boolean> {
      const res = await db.execute({
        sql: `DELETE FROM events WHERE id = ?`,
        args: [id],
      });
      return res.rowsAffected > 0;
    },

    async listUpcomingEvents(chatId: string, windowDays = 30, referenceDate = new Date()): Promise<UpcomingEvent[]> {
      const events = await repo.getEventsByChat(chatId);
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

    async getEventsForRange(chatId: string, startDate: Date, endDate: Date): Promise<EventOccurrence[]> {
      const startParts = getUtc7Parts(startDate);
      const endParts = getUtc7Parts(endDate);
      const startMid = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
      const endMid = Date.UTC(endParts.year, endParts.month - 1, endParts.day);

      if (startMid > endMid) {
        return [];
      }

      const events = await repo.getEventsByChat(chatId);
      const occurrences: EventOccurrence[] = [];
      const seenKey = new Set<string>();

      const addOccurrence = (event: EventRow, date: Date) => {
        const dateStr = formatUtc7DateStr(date);
        const key = `${event.id}_${dateStr}`;
        if (seenKey.has(key)) return;
        seenKey.add(key);

        const parts = getUtc7Parts(date);
        const lunar = solarToLunar(parts.day, parts.month, parts.year);

        occurrences.push({
          event,
          occurrenceDate: date,
          occurrenceDateStr: dateStr,
          dayOfWeek: getUtc7DayOfWeek(date),
          solarDay: parts.day,
          solarMonth: parts.month,
          solarYear: parts.year,
          lunarDay: lunar.day,
          lunarMonth: lunar.month,
          lunarYear: lunar.year,
          isLunarLeap: lunar.isLeap,
        });
      };

      for (const event of events) {
        if (event.calendar === "lunar") {
          let candYears: number[] = [];
          if (event.recurrence === "none" && event.year !== null) {
            candYears = [event.year];
          } else {
            for (let y = startParts.year - 1; y <= endParts.year + 1; y++) {
              candYears.push(y);
            }
          }

          for (const candYear of candYears) {
            const solar = lunarToSolar(event.day, event.month, candYear, event.isLeapMonth);
            const targetMid = Date.UTC(solar.year, solar.month - 1, solar.day);
            if (targetMid >= startMid && targetMid <= endMid) {
              addOccurrence(event, createUtc7Date(solar.year, solar.month, solar.day));
            }
          }
        } else {
          // Solar events
          if (event.recurrence === "none") {
            if (event.year !== null) {
              const targetMid = Date.UTC(event.year, event.month - 1, event.day);
              if (targetMid >= startMid && targetMid <= endMid) {
                addOccurrence(event, createUtc7Date(event.year, event.month, event.day));
              }
            } else {
              for (let y = startParts.year; y <= endParts.year; y++) {
                const targetMid = Date.UTC(y, event.month - 1, event.day);
                if (targetMid >= startMid && targetMid <= endMid) {
                  addOccurrence(event, createUtc7Date(y, event.month, event.day));
                }
              }
            }
          } else if (event.recurrence === "yearly") {
            for (let y = startParts.year; y <= endParts.year; y++) {
              const targetMid = Date.UTC(y, event.month - 1, event.day);
              if (targetMid >= startMid && targetMid <= endMid) {
                addOccurrence(event, createUtc7Date(y, event.month, event.day));
              }
            }
          } else if (event.recurrence === "monthly") {
            for (let y = startParts.year; y <= endParts.year; y++) {
              const mStart = y === startParts.year ? startParts.month : 1;
              const mEnd = y === endParts.year ? endParts.month : 12;
              for (let m = mStart; m <= mEnd; m++) {
                const daysInM = getDaysInSolarMonth(y, m);
                const day = Math.min(event.day, daysInM);
                const targetMid = Date.UTC(y, m - 1, day);
                if (targetMid >= startMid && targetMid <= endMid) {
                  addOccurrence(event, createUtc7Date(y, m, day));
                }
              }
            }
          } else if (event.recurrence === "weekly") {
            const baseDate = createUtc7Date(event.year ?? startParts.year, event.month, event.day);
            const targetDow = getUtc7DayOfWeek(baseDate);
            for (let t = startMid; t <= endMid; t += 24 * 60 * 60 * 1000) {
              const cur = new Date(t);
              if (getUtc7DayOfWeek(cur) === targetDow) {
                const parts = getUtc7Parts(cur);
                addOccurrence(event, createUtc7Date(parts.year, parts.month, parts.day));
              }
            }
          } else if (event.recurrence === "daily") {
            for (let t = startMid; t <= endMid; t += 24 * 60 * 60 * 1000) {
              const cur = new Date(t);
              const parts = getUtc7Parts(cur);
              addOccurrence(event, createUtc7Date(parts.year, parts.month, parts.day));
            }
          }
        }
      }

      occurrences.sort((a, b) => {
        const timeDiff = a.occurrenceDate.getTime() - b.occurrenceDate.getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.event.id - b.event.id;
      });

      return occurrences;
    },

    async getEventsForWeek(chatId: string, referenceDate: Date = new Date()): Promise<EventOccurrence[]> {
      const start = getStartOfWeekUtc7(referenceDate);
      const end = getEndOfWeekUtc7(referenceDate);
      return repo.getEventsForRange(chatId, start, end);
    },

    async getEventsForMonth(chatId: string, year: number, month: number): Promise<EventOccurrence[]> {
      const start = createUtc7Date(year, month, 1);
      const end = createUtc7Date(year, month, getDaysInSolarMonth(year, month));
      return repo.getEventsForRange(chatId, start, end);
    },

    async getEventsForYear(chatId: string, year: number): Promise<EventOccurrence[]> {
      const start = createUtc7Date(year, 1, 1);
      const end = createUtc7Date(year, 12, 31);
      return repo.getEventsForRange(chatId, start, end);
    },

    async getAllEvents(): Promise<EventRow[]> {
      const res = await db.execute({
        sql: `SELECT id, chat_id as chatId, title, kind, calendar, day, month, year,
                     is_leap_month as isLeapMonth, recurrence, remind_days_before as remindDaysBefore,
                     notes, created_by as createdBy, ts
              FROM events
              ORDER BY id ASC`,
        args: [],
      });
      return res.rows.map(mapEventRow);
    },

    async isReminderSent(eventId: number, occurrenceDate: string): Promise<boolean> {
      const res = await db.execute({
        sql: "SELECT 1 FROM reminders_sent WHERE event_id = ? AND occurrence_date = ? LIMIT 1",
        args: [eventId, occurrenceDate],
      });
      return res.rows.length > 0;
    },

    async recordReminderSent(eventId: number, occurrenceDate: string, sentAt = Date.now()): Promise<void> {
      await db.execute({
        sql: "INSERT OR IGNORE INTO reminders_sent (event_id, occurrence_date, sent_at) VALUES (?, ?, ?)",
        args: [eventId, occurrenceDate, sentAt],
      });
    },

    async findEventsDueForReminder(referenceDate = new Date(), chatId?: string): Promise<DueReminder[]> {
      const events = chatId ? await repo.getEventsByChat(chatId) : await repo.getAllEvents();
      const due: DueReminder[] = [];

      for (const event of events) {
        const occ = getNextOccurrence(event, referenceDate);
        if (!occ) continue;

        const isDayOf = occ.daysRemaining === 0;
        const isAdvance = event.remindDaysBefore > 0 && occ.daysRemaining === event.remindDaysBefore;

        if (isDayOf || isAdvance) {
          due.push({
            event,
            occurrenceDate: occ.date,
            occurrenceDateStr: occ.dateStr,
            daysRemaining: occ.daysRemaining,
            isAdvanceNotice: isAdvance && !isDayOf,
          });
        }
      }

      return due;
    },
  };

  return repo;
}
