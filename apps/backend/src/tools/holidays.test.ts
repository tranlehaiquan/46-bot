import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrations.js";
import { createEventsRepository } from "../db/repositories/events.js";
import { createHolidayTools } from "./holidays.js";

describe("Holiday tools", () => {
  it("executes holiday_list_upcoming with filtering", async () => {
    const tools = createHolidayTools();

    // Query all upcoming holidays
    const resAll = (await tools.holiday_list_upcoming.execute?.(
      { windowDays: 365, publicOnly: false },
      {} as any,
    )) as any;
    assert.ok(resAll);
    assert.equal(resAll.success, true);
    assert.ok(resAll.total > 6);

    // Query public holidays only
    const resPublic = (await tools.holiday_list_upcoming.execute?.(
      { windowDays: 365, publicOnly: true },
      {} as any,
    )) as any;
    assert.ok(resPublic);
    assert.equal(resPublic.success, true);
    assert.equal(resPublic.total, 7);
  });

  it("imports public holidays idempotently into events repository", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createEventsRepository(db);
      const tools = createHolidayTools(repo, { chatId: "chat-holiday", senderName: "Admin" });

      // First import (public holidays only)
      const importRes = (await tools.holiday_import.execute?.(
        { includeTraditional: false },
        {} as any,
      )) as any;

      assert.ok(importRes);
      assert.equal(importRes.success, true);
      assert.equal(importRes.addedCount, 7);

      const events = await repo.getEventsByChat("chat-holiday");
      assert.equal(events.length, 7);

      // Verify specific holidays are present
      const titles = events.map((e) => e.title);
      assert.ok(titles.includes("Tết Dương lịch"));
      assert.ok(titles.includes("Tết Nguyên Đán"));
      assert.ok(titles.includes("Giỗ Tổ Hùng Vương"));
      assert.ok(titles.includes("Ngày Chiến thắng (30/4)"));
      assert.ok(titles.includes("Ngày Quốc tế Lao động (1/5)"));
      assert.ok(titles.includes("Ngày Quốc khánh (2/9)"));
      assert.ok(titles.includes("Ngày Văn hóa Việt Nam (24/11)"));

      // Second import: should be idempotent and add 0 new events
      const secondImportRes = (await tools.holiday_import.execute?.(
        { includeTraditional: false },
        {} as any,
      )) as any;
      assert.equal(secondImportRes.addedCount, 0);
      assert.equal((await repo.getEventsByChat("chat-holiday")).length, 7);

      // Third import with includeTraditional = true: should add the cultural festivals and family days
      const thirdImportRes = (await tools.holiday_import.execute?.(
        { includeTraditional: true },
        {} as any,
      )) as any;
      assert.ok(thirdImportRes.addedCount > 0);
      assert.equal(thirdImportRes.addedCount, 11); // 11 non-public celebrations
      assert.equal((await repo.getEventsByChat("chat-holiday")).length, 18);
    } finally {
      closeDatabase(db);
    }
  });

  it("handles missing repository gracefully", async () => {
    const tools = createHolidayTools();
    const res = (await tools.holiday_import.execute?.(
      { includeTraditional: false },
      {} as any,
    )) as any;
    assert.equal(res.success, false);
  });
});
