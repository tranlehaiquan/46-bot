import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUtc7Date } from "../db/repositories/events.js";
import type { DueReminder, EventRow, UpcomingEvent } from "../db/repositories/events.js";
import type { UpcomingHoliday } from "../holidays/index.js";
import {
  formatEventReminder,
  formatMorningBriefing,
  formatWeeklyOutlook,
} from "./formatters.js";

function makeFakeEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 1,
    chatId: "chat-1",
    title: "Sinh nhật Ba",
    kind: "birthday",
    calendar: "solar",
    day: 5,
    month: 10,
    year: 1965,
    isLeapMonth: false,
    recurrence: "yearly",
    remindDaysBefore: 3,
    notes: "Tặng áo sơ mi",
    createdBy: "user-1",
    ts: Date.now(),
    ...overrides,
  };
}

describe("Notification Message Formatters", () => {
  describe("formatMorningBriefing", () => {
    it("returns null if no events, holidays, or milestones exist", () => {
      const result = formatMorningBriefing({
        todayEvents: [],
        todayHolidays: [],
        upcomingMilestones: [],
      });
      assert.equal(result, null);
    });

    it("formats morning briefing with today's events, holidays, and upcoming milestones", () => {
      const refDate = createUtc7Date(2026, 10, 5);
      const todayEvent: UpcomingEvent = {
        event: makeFakeEvent({ title: "Sinh nhật Mẹ", notes: "Tặng hoa" }),
        occurrenceDate: refDate,
        occurrenceDateStr: "2026-10-05",
        daysRemaining: 0,
      };

      const todayHoliday: UpcomingHoliday = {
        id: "ngay-giai-phong-thu-do",
        name: "Ngày Giải phóng Thủ đô",
        calendar: "solar",
        originalDate: "10/10 (Dương lịch)",
        occurrenceDate: refDate,
        occurrenceDateStr: "2026-10-05",
        daysRemaining: 0,
        isPublicHoliday: false,
      };

      const upcomingMilestone: UpcomingEvent = {
        event: makeFakeEvent({ id: 2, title: "Giỗ Cụ", calendar: "lunar" }),
        occurrenceDate: createUtc7Date(2026, 10, 8),
        occurrenceDateStr: "2026-10-08",
        daysRemaining: 3,
      };

      const result = formatMorningBriefing({
        todayEvents: [todayEvent],
        todayHolidays: [todayHoliday],
        upcomingMilestones: [upcomingMilestone],
        referenceDate: refDate,
      });

      assert.ok(result);
      assert.match(result, /Chào buổi sáng gia đình!/);
      assert.match(result, /05\/10\/2026/);
      assert.match(result, /Ngày Giải phóng Thủ đô/);
      assert.match(result, /Sinh nhật Mẹ - Tặng hoa/);
      assert.match(result, /Giỗ Cụ \(ÂL\): sau 3 ngày nữa/);
    });
  });

  describe("formatWeeklyOutlook", () => {
    it("returns null if no events or holidays in the coming week", () => {
      const result = formatWeeklyOutlook({
        weekEvents: [],
        weekHolidays: [],
      });
      assert.equal(result, null);
    });

    it("formats weekly outlook summarizing week's events and holidays", () => {
      const refDate = createUtc7Date(2026, 10, 4);
      const ev: UpcomingEvent = {
        event: makeFakeEvent({ title: "Họp phụ huynh" }),
        occurrenceDate: createUtc7Date(2026, 10, 7),
        occurrenceDateStr: "2026-10-07",
        daysRemaining: 3,
      };

      const holiday: UpcomingHoliday = {
        id: "ngay-phu-nu-vn",
        name: "Ngày Phụ nữ Việt Nam",
        calendar: "solar",
        originalDate: "20/10",
        occurrenceDate: createUtc7Date(2026, 10, 10),
        occurrenceDateStr: "2026-10-10",
        daysRemaining: 6,
        isPublicHoliday: false,
      };

      const result = formatWeeklyOutlook({
        weekEvents: [ev],
        weekHolidays: [holiday],
        referenceDate: refDate,
      });

      assert.ok(result);
      assert.match(result, /Điểm tin tuần mới/);
      assert.match(result, /Họp phụ huynh/);
      assert.match(result, /Ngày Phụ nữ Việt Nam/);
    });
  });

  describe("formatEventReminder", () => {
    it("formats day-of event reminder", () => {
      const due: DueReminder = {
        event: makeFakeEvent({ title: "Sinh nhật Chị Lan", notes: "Ghé mua bánh kem" }),
        occurrenceDate: createUtc7Date(2026, 10, 5),
        occurrenceDateStr: "2026-10-05",
        daysRemaining: 0,
        isAdvanceNotice: false,
      };

      const text = formatEventReminder(due);
      assert.match(text, /Nhắc nhở hôm nay/);
      assert.match(text, /Sinh nhật Chị Lan/);
      assert.match(text, /Ghé mua bánh kem/);
    });

    it("formats advance event reminder", () => {
      const due: DueReminder = {
        event: makeFakeEvent({ title: "Giỗ Ông", calendar: "lunar" }),
        occurrenceDate: createUtc7Date(2026, 10, 8),
        occurrenceDateStr: "2026-10-08",
        daysRemaining: 3,
        isAdvanceNotice: true,
      };

      const text = formatEventReminder(due);
      assert.match(text, /Nhắc trước: còn 3 ngày nữa/);
      assert.match(text, /"Giỗ Ông" \(Âm lịch\)/);
    });
  });
});
