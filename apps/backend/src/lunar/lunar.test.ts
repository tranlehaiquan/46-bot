import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDaysInLunarMonth,
  getLeapMonth,
  lunarToSolar,
  solarToLunar,
} from "./index.js";

describe("Vietnamese Lunar Calendar Engine", () => {
  describe("Tết Nguyên Đán (Lunar New Year) conversions", () => {
    const tetDates = [
      { lunarYear: 2020, solarDay: 25, solarMonth: 1, solarYear: 2020, name: "Canh Tý" },
      { lunarYear: 2023, solarDay: 22, solarMonth: 1, solarYear: 2023, name: "Quý Mão" },
      { lunarYear: 2024, solarDay: 10, solarMonth: 2, solarYear: 2024, name: "Giáp Thìn" },
      { lunarYear: 2025, solarDay: 29, solarMonth: 1, solarYear: 2025, name: "Ất Tỵ" },
      { lunarYear: 2026, solarDay: 17, solarMonth: 2, solarYear: 2026, name: "Bính Ngọ" },
      { lunarYear: 2027, solarDay: 6, solarMonth: 2, solarYear: 2027, name: "Đinh Mùi" },
      { lunarYear: 2028, solarDay: 26, solarMonth: 1, solarYear: 2028, name: "Mậu Thân" },
    ];

    for (const { lunarYear, solarDay, solarMonth, solarYear, name } of tetDates) {
      it(`accurately converts Tết ${lunarYear} (${name}) between lunar and solar`, () => {
        // Lunar 1/1 -> Solar
        const solar = lunarToSolar(1, 1, lunarYear, false);
        assert.deepEqual(solar, {
          day: solarDay,
          month: solarMonth,
          year: solarYear,
        });

        // Solar -> Lunar 1/1
        const lunar = solarToLunar(solarDay, solarMonth, solarYear);
        assert.deepEqual(lunar, {
          day: 1,
          month: 1,
          year: lunarYear,
          isLeap: false,
        });
      });
    }
  });

  describe("Leap month (Tháng nhuận) identification and conversion", () => {
    it("identifies leap years and leap months correctly", () => {
      assert.equal(getLeapMonth(2020), 4);
      assert.equal(getLeapMonth(2021), 0);
      assert.equal(getLeapMonth(2022), 0);
      assert.equal(getLeapMonth(2023), 2);
      assert.equal(getLeapMonth(2024), 0);
      assert.equal(getLeapMonth(2025), 6);
      assert.equal(getLeapMonth(2026), 0);
      assert.equal(getLeapMonth(2027), 0);
      assert.equal(getLeapMonth(2028), 5);
    });

    it("correctly converts 2023 regular month 2 and leap month 2", () => {
      // 1/2/2023 regular lunar -> solar 20/02/2023
      const regularSolar = lunarToSolar(1, 2, 2023, false);
      assert.deepEqual(regularSolar, { day: 20, month: 2, year: 2023 });
      assert.deepEqual(solarToLunar(20, 2, 2023), { day: 1, month: 2, year: 2023, isLeap: false });

      // 1/2/2023 leap lunar -> solar 22/03/2023
      const leapSolar = lunarToSolar(1, 2, 2023, true);
      assert.deepEqual(leapSolar, { day: 22, month: 3, year: 2023 });
      assert.deepEqual(solarToLunar(22, 3, 2023), { day: 1, month: 2, year: 2023, isLeap: true });
    });

    it("correctly converts 2025 regular month 6 and leap month 6", () => {
      // 1/6/2025 regular lunar -> solar 25/06/2025
      const regularSolar = lunarToSolar(1, 6, 2025, false);
      assert.deepEqual(regularSolar, { day: 25, month: 6, year: 2025 });
      assert.deepEqual(solarToLunar(25, 6, 2025), { day: 1, month: 6, year: 2025, isLeap: false });

      // 1/6/2025 leap lunar -> solar 25/07/2025
      const leapSolar = lunarToSolar(1, 6, 2025, true);
      assert.deepEqual(leapSolar, { day: 25, month: 7, year: 2025 });
      assert.deepEqual(solarToLunar(25, 7, 2025), { day: 1, month: 6, year: 2025, isLeap: true });
    });
  });

  describe("Edge cases and day clamping", () => {
    it("reports correct number of days for lunar months (29 or 30)", () => {
      // Month 12 of lunar year 2024 has 29 days
      assert.equal(getDaysInLunarMonth(12, 2024), 29);
      // Month 1 of lunar year 2025 has 30 days
      assert.equal(getDaysInLunarMonth(1, 2025), 30);
      // Non-existent leap month returns 0
      assert.equal(getDaysInLunarMonth(5, 2024, true), 0);
    });

    it("clamps day 30 to day 29 when month has only 29 days (e.g. 29 Tết 2024)", () => {
      // Lunar 29/12/2024 is solar 28/01/2025
      const day29 = lunarToSolar(29, 12, 2024, false);
      assert.deepEqual(day29, { day: 28, month: 1, year: 2025 });

      // Lunar 30/12/2024 should clamp to 29 and still be 28/01/2025, not spill over to 29/01/2025 (Mùng 1 Tết)
      const day30 = lunarToSolar(30, 12, 2024, false);
      assert.deepEqual(day30, { day: 28, month: 1, year: 2025 });
    });

    it("falls back to regular month if leap month is not present in that year", () => {
      // 2024 has no leap month. If someone asks for 1/5/2024 leap, it falls back to 1/5/2024 regular
      const regular = lunarToSolar(1, 5, 2024, false);
      const invalidLeap = lunarToSolar(1, 5, 2024, true);
      assert.deepEqual(invalidLeap, regular);
    });
  });

  describe("Mid-Autumn Festival (Tết Trung Thu - 15/8 âm lịch)", () => {
    it("converts 15/8 lunar accurately for 2024 and 2025", () => {
      // 2024: 15/8 lunar -> solar 17/09/2024
      const solar2024 = lunarToSolar(15, 8, 2024, false);
      assert.deepEqual(solar2024, { day: 17, month: 9, year: 2024 });
      assert.deepEqual(solarToLunar(17, 9, 2024), { day: 15, month: 8, year: 2024, isLeap: false });

      // 2025: 15/8 lunar -> solar 06/10/2025
      const solar2025 = lunarToSolar(15, 8, 2025, false);
      assert.deepEqual(solar2025, { day: 6, month: 10, year: 2025 });
      assert.deepEqual(solarToLunar(6, 10, 2025), { day: 15, month: 8, year: 2025, isLeap: false });
    });
  });
});
