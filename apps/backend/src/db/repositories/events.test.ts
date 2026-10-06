import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { openDatabase, type SqliteDatabase } from "../connection.js";
import { migrate } from "../migrations.js";
import {
  createEventsRepository,
  createUtc7Date,
  getNextOccurrence,
  type EventsRepository,
} from "./events.js";

describe("EventsRepository", () => {
  let db: SqliteDatabase;
  let repo: EventsRepository;

  beforeEach(async () => {
    db = openDatabase(":memory:");
    await migrate(db);
    repo = createEventsRepository(db);
  });

  describe("CRUD operations", () => {
    it("creates and retrieves an event by id", async () => {
      const created = await repo.createEvent({
        chatId: "chat-1",
        title: "Sinh nhật Mẹ",
        kind: "birthday",
        calendar: "solar",
        day: 15,
        month: 5,
        year: 1968,
        recurrence: "yearly",
        remindDaysBefore: 3,
        notes: "Mua hoa tặng mẹ",
        createdBy: "user-1",
      });

      assert.equal(created.id, 1);
      assert.equal(created.title, "Sinh nhật Mẹ");
      assert.equal(created.kind, "birthday");
      assert.equal(created.calendar, "solar");
      assert.equal(created.day, 15);
      assert.equal(created.month, 5);
      assert.equal(created.year, 1968);
      assert.equal(created.recurrence, "yearly");
      assert.equal(created.remindDaysBefore, 3);
      assert.equal(created.notes, "Mua hoa tặng mẹ");
      assert.equal(created.createdBy, "user-1");

      const fetched = await repo.getEventById(created.id);
      assert.deepEqual(fetched, created);
    });

    it("retrieves events by chat id", async () => {
      await repo.createEvent({
        chatId: "chat-1",
        title: "Event 1",
        day: 1,
        month: 1,
        createdBy: "user-1",
      });
      await repo.createEvent({
        chatId: "chat-2",
        title: "Event 2",
        day: 2,
        month: 2,
        createdBy: "user-2",
      });

      const chat1Events = await repo.getEventsByChat("chat-1");
      assert.equal(chat1Events.length, 1);
      assert.equal(chat1Events[0]?.title, "Event 1");
    });

    it("updates an event", async () => {
      const created = await repo.createEvent({
        chatId: "chat-1",
        title: "Họp phụ huynh",
        day: 10,
        month: 10,
        createdBy: "user-1",
      });

      const updated = await repo.updateEvent(created.id, {
        title: "Họp phụ huynh học kỳ 1",
        day: 12,
        month: 10,
        notes: "Mang theo sổ liên lạc",
      });

      assert.ok(updated);
      assert.equal(updated.title, "Họp phụ huynh học kỳ 1");
      assert.equal(updated.day, 12);
      assert.equal(updated.notes, "Mang theo sổ liên lạc");
    });

    it("deletes an event", async () => {
      const created = await repo.createEvent({
        chatId: "chat-1",
        title: "Xóa sự kiện này",
        day: 1,
        month: 1,
        createdBy: "user-1",
      });

      const deleted = await repo.deleteEvent(created.id);
      assert.equal(deleted, true);
      assert.equal(await repo.getEventById(created.id), undefined);

      const deleteAgain = await repo.deleteEvent(created.id);
      assert.equal(deleteAgain, false);
    });
  });

  describe("Next Occurrence Calculations", () => {
    it("calculates next occurrence for solar yearly event (upcoming this year)", async () => {
      // Reference date: 2026-05-01
      const refDate = createUtc7Date(2026, 5, 1);
      const event = await repo.createEvent({
        chatId: "chat-1",
        title: "Sinh nhật",
        calendar: "solar",
        day: 15,
        month: 5,
        recurrence: "yearly",
        createdBy: "user-1",
      });

      const occ = getNextOccurrence(event, refDate);
      assert.ok(occ);
      assert.equal(occ.dateStr, "2026-05-15");
      assert.equal(occ.daysRemaining, 14);
    });

    it("calculates next occurrence for solar yearly event (passed this year -> next year)", async () => {
      // Reference date: 2026-06-01 (May 15 has already passed)
      const refDate = createUtc7Date(2026, 6, 1);
      const event = await repo.createEvent({
        chatId: "chat-1",
        title: "Sinh nhật",
        calendar: "solar",
        day: 15,
        month: 5,
        recurrence: "yearly",
        createdBy: "user-1",
      });

      const occ = getNextOccurrence(event, refDate);
      assert.ok(occ);
      assert.equal(occ.dateStr, "2027-05-15");
      assert.ok(occ.daysRemaining > 300);
    });

    it("calculates next occurrence for solar monthly recurrence", async () => {
      // Reference date: 2026-05-10. Event on day 15 monthly.
      const refDate = createUtc7Date(2026, 5, 10);
      const event = await repo.createEvent({
        chatId: "chat-1",
        title: "Đóng tiền nhà",
        day: 15,
        month: 1, // month doesn't matter for monthly
        recurrence: "monthly",
        createdBy: "user-1",
      });

      const occ1 = getNextOccurrence(event, refDate);
      assert.ok(occ1);
      assert.equal(occ1.dateStr, "2026-05-15");
      assert.equal(occ1.daysRemaining, 5);

      // Passed day 15 (e.g. May 20) -> should be June 15
      const refDate2 = createUtc7Date(2026, 5, 20);
      const occ2 = getNextOccurrence(event, refDate2);
      assert.ok(occ2);
      assert.equal(occ2.dateStr, "2026-06-15");
      assert.equal(occ2.daysRemaining, 26);
    });

    it("calculates next occurrence for lunar yearly event (giỗ / death anniversary)", async () => {
      // Tết 2026 (1/1 lunar) is 2026-02-17 solar.
      // Reference date: 2026-02-10 (7 days before Tết).
      const refDate = createUtc7Date(2026, 2, 10);
      const event = await repo.createEvent({
        chatId: "chat-1",
        title: "Mùng 1 Tết",
        kind: "gio",
        calendar: "lunar",
        day: 1,
        month: 1,
        recurrence: "yearly",
        createdBy: "user-1",
      });

      const occ = getNextOccurrence(event, refDate);
      assert.ok(occ);
      assert.equal(occ.dateStr, "2026-02-17");
      assert.equal(occ.daysRemaining, 7);

      // If reference date is 2026-03-01 (after Tết 2026) -> should find Tết 2027 (2027-02-06)
      const refDateAfter = createUtc7Date(2026, 3, 1);
      const occAfter = getNextOccurrence(event, refDateAfter);
      assert.ok(occAfter);
      assert.equal(occAfter.dateStr, "2027-02-06");
    });

    it("returns null for past one-off solar events", async () => {
      const refDate = createUtc7Date(2026, 10, 4);
      const pastEvent = await repo.createEvent({
        chatId: "chat-1",
        title: "Sự kiện đã qua",
        calendar: "solar",
        day: 1,
        month: 10,
        year: 2026,
        recurrence: "none",
        createdBy: "user-1",
      });

      const occ = getNextOccurrence(pastEvent, refDate);
      assert.equal(occ, null);
    });
  });

  describe("listUpcomingEvents", () => {
    it("returns events sorted chronologically within window", async () => {
      const refDate = createUtc7Date(2026, 10, 1);

      // Event in 5 days (2026-10-06)
      await repo.createEvent({
        chatId: "chat-1",
        title: "Họp lớp",
        day: 6,
        month: 10,
        year: 2026,
        recurrence: "none",
        createdBy: "user-1",
      });

      // Event in 2 days (2026-10-03)
      await repo.createEvent({
        chatId: "chat-1",
        title: "Đi khám răng",
        day: 3,
        month: 10,
        year: 2026,
        recurrence: "none",
        createdBy: "user-1",
      });

      // Event in 60 days (outside 30-day window)
      await repo.createEvent({
        chatId: "chat-1",
        title: "Đi du lịch",
        day: 1,
        month: 12,
        year: 2026,
        recurrence: "none",
        createdBy: "user-1",
      });

      const upcoming = await repo.listUpcomingEvents("chat-1", 30, refDate);
      assert.equal(upcoming.length, 2);
      assert.equal(upcoming[0]?.event.title, "Đi khám răng");
      assert.equal(upcoming[0]?.daysRemaining, 2);
      assert.equal(upcoming[1]?.event.title, "Họp lớp");
      assert.equal(upcoming[1]?.daysRemaining, 5);
    });
  });

  describe("Reminder Tracking & Due Reminders", () => {
    it("tracks sent reminders idempotently", async () => {
      const ev = await repo.createEvent({
        chatId: "chat-1",
        title: "Test Event",
        day: 5,
        month: 10,
        createdBy: "user-1",
      });
      assert.equal(await repo.isReminderSent(ev.id, "2026-10-05"), false);
      await repo.recordReminderSent(ev.id, "2026-10-05");
      assert.equal(await repo.isReminderSent(ev.id, "2026-10-05"), true);
      assert.equal(await repo.isReminderSent(ev.id, "2026-10-06"), false);

      // Duplicate record is ignored without throwing
      await repo.recordReminderSent(ev.id, "2026-10-05");
      assert.equal(await repo.isReminderSent(ev.id, "2026-10-05"), true);
    });

    it("identifies events due for day-of and advance reminders", async () => {
      const refDate = createUtc7Date(2026, 10, 5);

      // Event happening today (day-of)
      const ev1 = await repo.createEvent({
        chatId: "chat-1",
        title: "Sinh nhật Ba",
        day: 5,
        month: 10,
        year: 2026,
        remindDaysBefore: 0,
        createdBy: "user-1",
      });

      // Event happening in 3 days, with remindDaysBefore = 3 (advance alert due today)
      const ev2 = await repo.createEvent({
        chatId: "chat-1",
        title: "Giỗ Cụ",
        calendar: "solar",
        day: 8,
        month: 10,
        year: 2026,
        remindDaysBefore: 3,
        createdBy: "user-1",
      });

      // Event happening in 5 days, with remindDaysBefore = 3 (not due today)
      await repo.createEvent({
        chatId: "chat-1",
        title: "Khám sức khỏe",
        day: 10,
        month: 10,
        year: 2026,
        remindDaysBefore: 3,
        createdBy: "user-1",
      });

      // Event in chat-2
      const ev4 = await repo.createEvent({
        chatId: "chat-2",
        title: "Họp chi bộ",
        day: 5,
        month: 10,
        year: 2026,
        remindDaysBefore: 0,
        createdBy: "user-2",
      });

      // Query for chat-1
      const dueChat1 = await repo.findEventsDueForReminder(refDate, "chat-1");
      assert.equal(dueChat1.length, 2);
      assert.equal(dueChat1[0]?.event.id, ev1.id);
      assert.equal(dueChat1[0]?.isAdvanceNotice, false);
      assert.equal(dueChat1[0]?.daysRemaining, 0);

      assert.equal(dueChat1[1]?.event.id, ev2.id);
      assert.equal(dueChat1[1]?.isAdvanceNotice, true);
      assert.equal(dueChat1[1]?.daysRemaining, 3);

      // Query for all chats
      const dueAll = await repo.findEventsDueForReminder(refDate);
      assert.equal(dueAll.length, 3);
      assert.ok(dueAll.some((d) => d.event.id === ev4.id));
    });
  });

  describe("Timeframe and Range Occurrence Queries", () => {
    it("retrieves one-off, recurring solar, and recurring lunar events for a date range", async () => {
      // 1. One-off solar in range
      await repo.createEvent({
        chatId: "chat-1",
        title: "Đám cưới bạn",
        day: 15,
        month: 10,
        year: 2026,
        recurrence: "none",
        createdBy: "user-1",
      });

      // 2. One-off solar outside range
      await repo.createEvent({
        chatId: "chat-1",
        title: "Sự kiện tháng 11",
        day: 15,
        month: 11,
        year: 2026,
        recurrence: "none",
        createdBy: "user-1",
      });

      // 3. Yearly solar birthday falling in October
      await repo.createEvent({
        chatId: "chat-1",
        title: "Sinh nhật Chị",
        kind: "birthday",
        day: 20,
        month: 10,
        recurrence: "yearly",
        createdBy: "user-1",
      });

      // 4. Yearly lunar giỗ on 1st day of 9th lunar month (1/9 âm lịch in 2026 corresponds to 2026-10-10 dương lịch)
      await repo.createEvent({
        chatId: "chat-1",
        title: "Giỗ Ông Nội",
        kind: "gio",
        calendar: "lunar",
        day: 1,
        month: 9,
        recurrence: "yearly",
        createdBy: "user-1",
      });

      // 5. Weekly event (every Wednesday)
      // 2026-10-07 is Wednesday
      await repo.createEvent({
        chatId: "chat-1",
        title: "Họp tuần",
        day: 7,
        month: 10,
        year: 2026,
        recurrence: "weekly",
        createdBy: "user-1",
      });

      const startDate = createUtc7Date(2026, 10, 1);
      const endDate = createUtc7Date(2026, 10, 31);
      const occurrences = await repo.getEventsForRange("chat-1", startDate, endDate);

      // Verify occurrences in October 2026
      assert.ok(occurrences.length >= 4);

      // Verify "Đám cưới bạn" on 2026-10-15
      const wedding = occurrences.find((o) => o.event.title === "Đám cưới bạn");
      assert.ok(wedding);
      assert.equal(wedding.occurrenceDateStr, "2026-10-15");
      assert.equal(wedding.solarDay, 15);

      // Verify "Sinh nhật Chị" on 2026-10-20
      const birthday = occurrences.find((o) => o.event.title === "Sinh nhật Chị");
      assert.ok(birthday);
      assert.equal(birthday.occurrenceDateStr, "2026-10-20");

      // Verify "Giỗ Ông Nội" on 2026-10-10 (1/9 âm lịch 2026 is 10/10/2026)
      const gio = occurrences.find((o) => o.event.title === "Giỗ Ông Nội");
      assert.ok(gio);
      assert.equal(gio.occurrenceDateStr, "2026-10-10");
      assert.equal(gio.lunarDay, 1);
      assert.equal(gio.lunarMonth, 9);

      // Verify outside event is excluded
      assert.ok(!occurrences.some((o) => o.event.title === "Sự kiện tháng 11"));
    });

    it("retrieves events for a specific week via getEventsForWeek", async () => {
      // 2026-10-05 is Monday, 2026-10-11 is Sunday
      await repo.createEvent({
        chatId: "chat-1",
        title: "Ăn tối thứ Tư",
        day: 7,
        month: 10,
        year: 2026,
        recurrence: "none",
        createdBy: "user-1",
      });
      await repo.createEvent({
        chatId: "chat-1",
        title: "Sự kiện tuần sau",
        day: 14,
        month: 10,
        year: 2026,
        recurrence: "none",
        createdBy: "user-1",
      });

      const refDate = createUtc7Date(2026, 10, 8); // Thursday
      const weekEvents = await repo.getEventsForWeek("chat-1", refDate);

      assert.equal(weekEvents.length, 1);
      assert.equal(weekEvents[0]?.event.title, "Ăn tối thứ Tư");
      assert.equal(weekEvents[0]?.occurrenceDateStr, "2026-10-07");
    });

    it("retrieves events for a month and a full year", async () => {
      await repo.createEvent({
        chatId: "chat-1",
        title: "Tết Dương Lịch",
        day: 1,
        month: 1,
        year: 2026,
        recurrence: "none",
        createdBy: "user-1",
      });
      await repo.createEvent({
        chatId: "chat-1",
        title: "Sinh nhật Ba",
        day: 25,
        month: 12,
        recurrence: "yearly",
        createdBy: "user-1",
      });

      const monthJan = await repo.getEventsForMonth("chat-1", 2026, 1);
      assert.equal(monthJan.length, 1);
      assert.equal(monthJan[0]?.event.title, "Tết Dương Lịch");

      const monthDec = await repo.getEventsForMonth("chat-1", 2026, 12);
      assert.equal(monthDec.length, 1);
      assert.equal(monthDec[0]?.event.title, "Sinh nhật Ba");

      const yearEvents = await repo.getEventsForYear("chat-1", 2026);
      assert.equal(yearEvents.length, 2);
    });
  });
});

