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
  createEvent(input: CreateEventInput): EventRow;
  getEventById(id: number): EventRow | undefined;
  getEventsByChat(chatId: string): EventRow[];
  getAllEvents(): EventRow[];
  updateEvent(id: number, updates: UpdateEventInput): EventRow | undefined;
  deleteEvent(id: number): boolean;
  listUpcomingEvents(chatId: string, windowDays?: number, referenceDate?: Date): UpcomingEvent[];
  getEventsForRange(chatId: string, startDate: Date, endDate: Date): EventOccurrence[];
  getEventsForWeek(chatId: string, referenceDate?: Date): EventOccurrence[];
  getEventsForMonth(chatId: string, year: number, month: number): EventOccurrence[];
  getEventsForYear(chatId: string, year: number): EventOccurrence[];
  isReminderSent(eventId: number, occurrenceDate: string): boolean;
  recordReminderSent(eventId: number, occurrenceDate: string, sentAt?: number): void;
  findEventsDueForReminder(referenceDate?: Date, chatId?: string): DueReminder[];
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

    getEventsForRange(chatId: string, startDate: Date, endDate: Date): EventOccurrence[] {
      const startParts = getUtc7Parts(startDate);
      const endParts = getUtc7Parts(endDate);
      const startMid = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
      const endMid = Date.UTC(endParts.year, endParts.month - 1, endParts.day);

      if (startMid > endMid) {
        return [];
      }

      const events = repo.getEventsByChat(chatId);
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

    getEventsForWeek(chatId: string, referenceDate: Date = new Date()): EventOccurrence[] {
      const start = getStartOfWeekUtc7(referenceDate);
      const end = getEndOfWeekUtc7(referenceDate);
      return repo.getEventsForRange(chatId, start, end);
    },

    getEventsForMonth(chatId: string, year: number, month: number): EventOccurrence[] {
      const start = createUtc7Date(year, month, 1);
      const end = createUtc7Date(year, month, getDaysInSolarMonth(year, month));
      return repo.getEventsForRange(chatId, start, end);
    },

    getEventsForYear(chatId: string, year: number): EventOccurrence[] {
      const start = createUtc7Date(year, 1, 1);
      const end = createUtc7Date(year, 12, 31);
      return repo.getEventsForRange(chatId, start, end);
    },
    getAllEvents(): EventRow[] {
      const rows = db.prepare("SELECT * FROM events ORDER BY id ASC").all();
      return rows.map(mapEventRow);
    },

    isReminderSent(eventId: number, occurrenceDate: string): boolean {
      const row = db
        .prepare("SELECT 1 FROM reminders_sent WHERE event_id = ? AND occurrence_date = ? LIMIT 1")
        .get(eventId, occurrenceDate);
      return Boolean(row);
    },

    recordReminderSent(eventId: number, occurrenceDate: string, sentAt = Date.now()): void {
      db.prepare("INSERT OR IGNORE INTO reminders_sent (event_id, occurrence_date, sent_at) VALUES (?, ?, ?)").run(
        eventId,
        occurrenceDate,
        sentAt,
      );
    },

    findEventsDueForReminder(referenceDate = new Date(), chatId?: string): DueReminder[] {
      const events = chatId ? repo.getEventsByChat(chatId) : repo.getAllEvents();
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
