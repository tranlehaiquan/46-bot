import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUtc7Date } from "../db/repositories/events.js";
import {
  getNextHolidayOccurrence,
  getUpcomingHolidays,
  VIETNAMESE_HOLIDAYS,
} from "./index.js";

describe("Vietnamese Holidays Catalog & Engine", () => {
  it("includes all 7 official public paid holidays under Vietnamese Labor Law", () => {
    const publicHolidays = VIETNAMESE_HOLIDAYS.filter((h) => h.isPublicHoliday);
    assert.equal(publicHolidays.length, 7);

    const ids = publicHolidays.map((h) => h.id);
    assert.ok(ids.includes("tet-duong-lich"));
    assert.ok(ids.includes("tet-nguyen-dan"));
    assert.ok(ids.includes("gio-to-hung-vuong"));
    assert.ok(ids.includes("ngay-chien-thang"));
    assert.ok(ids.includes("quoc-te-lao-dong"));
    assert.ok(ids.includes("quoc-khanh"));
    assert.ok(ids.includes("ngay-van-hoa-viet-nam"));
  });

  it("calculates accurate solar date for Giỗ Tổ Hùng Vương (10/3 Âm lịch)", () => {
    const gioTo = VIETNAMESE_HOLIDAYS.find((h) => h.id === "gio-to-hung-vuong")!;
    assert.ok(gioTo);

    // In 2026: 10/3 Âm lịch is 2026-04-26 Dương lịch
    // Reference date: 2026-04-01 (before Giỗ Tổ 2026)
    const refDate = createUtc7Date(2026, 4, 1);
    const occ = getNextHolidayOccurrence(gioTo, refDate);

    assert.equal(occ.dateStr, "2026-04-26");
    assert.equal(occ.daysRemaining, 25);
  });

  it("calculates accurate solar date for Tết Nguyên Đán (1/1 Âm lịch)", () => {
    const tet = VIETNAMESE_HOLIDAYS.find((h) => h.id === "tet-nguyen-dan")!;
    assert.ok(tet);

    // In 2026: Mùng 1 Tết Bính Ngọ is 2026-02-17
    const refDate = createUtc7Date(2026, 2, 1);
    const occ = getNextHolidayOccurrence(tet, refDate);

    assert.equal(occ.dateStr, "2026-02-17");
    assert.equal(occ.daysRemaining, 16);
  });

  it("filters holidays with publicOnly option", () => {
    const refDate = createUtc7Date(2026, 1, 1);
    const allHolidays = getUpcomingHolidays({ windowDays: 365, publicOnly: false, referenceDate: refDate });
    const publicOnly = getUpcomingHolidays({ windowDays: 365, publicOnly: true, referenceDate: refDate });

    assert.ok(allHolidays.length > publicOnly.length);
    assert.equal(publicOnly.length, 7);
    assert.ok(publicOnly.every((h) => h.isPublicHoliday));
  });

  it("filters upcoming holidays by windowDays", () => {
    // Reference date: 2026-04-20
    // Upcoming within 15 days: Giỗ Tổ (2026-04-26), 30/4 (2026-04-30), 1/5 (2026-05-01)
    const refDate = createUtc7Date(2026, 4, 20);
    const upcoming = getUpcomingHolidays({ windowDays: 15, publicOnly: true, referenceDate: refDate });

    assert.equal(upcoming.length, 3);
    assert.equal(upcoming[0]?.id, "gio-to-hung-vuong");
    assert.equal(upcoming[1]?.id, "ngay-chien-thang");
    assert.equal(upcoming[2]?.id, "quoc-te-lao-dong");
    assert.ok(upcoming[0].daysRemaining <= 15);
  });
});
