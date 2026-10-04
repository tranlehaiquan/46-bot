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

  beforeEach(() => {
    db = openDatabase(":memory:");
    migrate(db);
    repo = createEventsRepository(db);
  });

  describe("CRUD operations", () => {
    it("creates and retrieves an event by id", () => {
      const created = repo.createEvent({
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

      const fetched = repo.getEventById(created.id);
      assert.deepEqual(fetched, created);
    });

    it("retrieves events by chat id", () => {
      repo.createEvent({
        chatId: "chat-1",
        title: "Event 1",
        day: 1,
        month: 1,
        createdBy: "user-1",
      });
      repo.createEvent({
        chatId: "chat-2",
        title: "Event 2",
        day: 2,
        month: 2,
        createdBy: "user-2",
      });

      const chat1Events = repo.getEventsByChat("chat-1");
      assert.equal(chat1Events.length, 1);
      assert.equal(chat1Events[0]?.title, "Event 1");
    });

    it("updates an event", () => {
      const created = repo.createEvent({
        chatId: "chat-1",
        title: "Họp phụ huynh",
        day: 10,
        month: 10,
        createdBy: "user-1",
      });

      const updated = repo.updateEvent(created.id, {
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

    it("deletes an event", () => {
      const created = repo.createEvent({
        chatId: "chat-1",
        title: "Xóa sự kiện này",
        day: 1,
        month: 1,
        createdBy: "user-1",
      });

      const deleted = repo.deleteEvent(created.id);
      assert.equal(deleted, true);
      assert.equal(repo.getEventById(created.id), undefined);

      const deleteAgain = repo.deleteEvent(created.id);
      assert.equal(deleteAgain, false);
    });
  });

  describe("Next Occurrence Calculations", () => {
    it("calculates next occurrence for solar yearly event (upcoming this year)", () => {
      // Reference date: 2026-05-01
      const refDate = createUtc7Date(2026, 5, 1);
      const event = repo.createEvent({
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

    it("calculates next occurrence for solar yearly event (passed this year -> next year)", () => {
      // Reference date: 2026-06-01 (May 15 has already passed)
      const refDate = createUtc7Date(2026, 6, 1);
      const event = repo.createEvent({
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

    it("calculates next occurrence for solar monthly recurrence", () => {
      // Reference date: 2026-05-10. Event on day 15 monthly.
      const refDate = createUtc7Date(2026, 5, 10);
      const event = repo.createEvent({
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

    it("calculates next occurrence for lunar yearly event (giỗ / death anniversary)", () => {
      // Tết 2026 (1/1 lunar) is 2026-02-17 solar.
      // Reference date: 2026-02-10 (7 days before Tết).
      const refDate = createUtc7Date(2026, 2, 10);
      const event = repo.createEvent({
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

    it("returns null for past one-off solar events", () => {
      const refDate = createUtc7Date(2026, 10, 4);
      const pastEvent = repo.createEvent({
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
    it("returns events sorted chronologically within window", () => {
      const refDate = createUtc7Date(2026, 10, 1);

      // Event in 5 days (2026-10-06)
      repo.createEvent({
        chatId: "chat-1",
        title: "Họp lớp",
        day: 6,
        month: 10,
        year: 2026,
        recurrence: "none",
        createdBy: "user-1",
      });

      // Event in 2 days (2026-10-03)
      repo.createEvent({
        chatId: "chat-1",
        title: "Đi khám răng",
        day: 3,
        month: 10,
        year: 2026,
        recurrence: "none",
        createdBy: "user-1",
      });

      // Event in 60 days (outside 30-day window)
      repo.createEvent({
        chatId: "chat-1",
        title: "Đi du lịch",
        day: 1,
        month: 12,
        year: 2026,
        recurrence: "none",
        createdBy: "user-1",
      });

      const upcoming = repo.listUpcomingEvents("chat-1", 30, refDate);
      assert.equal(upcoming.length, 2);
      assert.equal(upcoming[0]?.event.title, "Đi khám răng");
      assert.equal(upcoming[0]?.daysRemaining, 2);
      assert.equal(upcoming[1]?.event.title, "Họp lớp");
      assert.equal(upcoming[1]?.daysRemaining, 5);
    });
  });
});
