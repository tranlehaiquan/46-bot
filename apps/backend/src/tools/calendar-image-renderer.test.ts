import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateCalendarSvg,
  renderCalendarPng,
  saveCalendarImage,
} from "./calendar-image-renderer.js";
import { createUtc7Date, type EventOccurrence } from "../db/repositories/events.js";
import sharp from "sharp";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function createMockOccurrence(overrides: Partial<EventOccurrence>): EventOccurrence {
  const occDate = overrides.occurrenceDate ?? createUtc7Date(2026, 10, 15);
  return {
    event: {
      id: 1,
      chatId: "test-chat",
      title: "Sinh nhật bạn",
      kind: "birthday",
      calendar: "solar",
      day: 15,
      month: 10,
      year: null,
      isLeapMonth: false,
      recurrence: "yearly",
      remindDaysBefore: 1,
      notes: "Ăn lẩu",
      createdBy: "test",
      ts: Date.now(),
    },
    occurrenceDate: occDate,
    occurrenceDateStr: "2026-10-15",
    dayOfWeek: 4, // Thursday
    solarDay: 15,
    solarMonth: 10,
    solarYear: 2026,
    lunarDay: 5,
    lunarMonth: 9,
    lunarYear: 2026,
    isLunarLeap: false,
    ...overrides,
  };
}

describe("CalendarImageRenderer", () => {
  const startDate = createUtc7Date(2026, 10, 1);
  const endDate = createUtc7Date(2026, 10, 31);

  describe("generateCalendarSvg", () => {
    it("generates valid SVG for weekly scope with and without events", () => {
      const weekStart = createUtc7Date(2026, 10, 5); // Monday
      const weekEnd = createUtc7Date(2026, 10, 11); // Sunday

      const events: EventOccurrence[] = [
        createMockOccurrence({
          occurrenceDate: createUtc7Date(2026, 10, 7),
          occurrenceDateStr: "2026-10-07",
          event: {
            id: 1,
            chatId: "test-chat",
            title: "Họp nhóm",
            kind: "appointment",
            calendar: "solar",
            day: 7,
            month: 10,
            year: 2026,
            isLeapMonth: false,
            recurrence: "none",
            remindDaysBefore: 0,
            notes: "Online Zoom",
            createdBy: "test",
            ts: Date.now(),
          },
        }),
      ];

      const svg = generateCalendarSvg({
        scope: "week",
        chatId: "test-chat",
        startDate: weekStart,
        endDate: weekEnd,
        events,
      });

      assert.ok(svg.startsWith("<svg"));
      assert.ok(svg.includes("LỊCH SỰ KIỆN TUẦN"));
      assert.ok(svg.includes("Họp nhóm"));
      assert.ok(svg.includes("Không có sự kiện")); // for days with no events
    });

    it("generates valid SVG for monthly scope with events", () => {
      const events: EventOccurrence[] = [
        createMockOccurrence({
          event: {
            id: 1,
            chatId: "test-chat",
            title: "Giỗ Cụ",
            kind: "gio",
            calendar: "lunar",
            day: 1,
            month: 9,
            year: null,
            isLeapMonth: false,
            recurrence: "yearly",
            remindDaysBefore: 2,
            notes: null,
            createdBy: "test",
            ts: Date.now(),
          },
          occurrenceDateStr: "2026-10-10",
          solarDay: 10,
          solarMonth: 10,
          lunarDay: 1,
          lunarMonth: 9,
        }),
      ];

      const svg = generateCalendarSvg({
        scope: "month",
        chatId: "test-chat",
        startDate,
        endDate,
        events,
      });

      assert.ok(svg.startsWith("<svg"));
      assert.ok(svg.includes("LỊCH SỰ KIỆN THÁNG 10/2026"));
      assert.ok(svg.includes("Giỗ Cụ"));
      assert.ok(svg.includes("ÂL: 1/9"));
    });

    it("generates valid SVG for monthly scope when empty", () => {
      const svg = generateCalendarSvg({
        scope: "month",
        chatId: "test-chat",
        startDate,
        endDate,
        events: [],
      });

      assert.ok(svg.startsWith("<svg"));
      assert.ok(svg.includes("Không có sự kiện"));
    });

    it("generates valid SVG for yearly scope", () => {
      const yearStart = createUtc7Date(2026, 1, 1);
      const yearEnd = createUtc7Date(2026, 12, 31);
      const events: EventOccurrence[] = [
        createMockOccurrence({
          occurrenceDateStr: "2026-05-15",
          solarMonth: 5,
          solarDay: 15,
        }),
      ];

      const svg = generateCalendarSvg({
        scope: "year",
        chatId: "test-chat",
        startDate: yearStart,
        endDate: yearEnd,
        events,
      });

      assert.ok(svg.startsWith("<svg"));
      assert.ok(svg.includes("TỔNG HỢP SỰ KIỆN NĂM 2026"));
      assert.ok(svg.includes("THÁNG 5"));
      assert.ok(svg.includes("Sinh nhật bạn"));
    });
  });

  describe("renderCalendarPng & saveCalendarImage", () => {
    it("rasterizes SVG into a valid PNG buffer", async () => {
      const pngBuffer = await renderCalendarPng({
        scope: "month",
        chatId: "test-chat",
        startDate,
        endDate,
        events: [createMockOccurrence({})],
      });

      assert.ok(Buffer.isBuffer(pngBuffer));
      assert.ok(pngBuffer.length > 100);

      // Verify PNG magic bytes
      const metadata = await sharp(pngBuffer).metadata();
      assert.equal(metadata.format, "png");
      assert.equal(metadata.width, 850);
      assert.ok((metadata.height ?? 0) > 100);
    });

    it("saves image file to disk correctly", async () => {
      const tmpDir = path.join(os.tmpdir(), "family-bot-test-" + Date.now());
      try {
        const result = await saveCalendarImage({
          scope: "week",
          chatId: "group-123",
          startDate,
          endDate,
          events: [],
          outputDir: tmpDir,
        });

        assert.ok(result.filename.startsWith("events_group-123_week_"));
        assert.ok(result.filePath.endsWith(".png"));

        const exists = await fs.stat(result.filePath);
        assert.ok(exists.isFile());
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
