import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "../connection.js";
import { migrate } from "../migrations.js";
import { createLookupRepository, isScheduleMatch } from "./lookups.js";

describe("LookupRepository", () => {
  function setup() {
    const db = openDatabase(":memory:");
    migrate(db);
    const repo = createLookupRepository(db);
    return { db, repo };
  }

  it("creates, retrieves, updates, cancels, and lists lookups", () => {
    const { db, repo } = setup();
    try {
      const created = repo.createLookup({
        chatId: "chat-1",
        instruction: "Báo giá vàng SJC",
        recurrence: "daily",
        hour: 8,
        minute: 30,
        createdBy: "user-1",
      });

      assert.equal(created.chatId, "chat-1");
      assert.equal(created.instruction, "Báo giá vàng SJC");
      assert.equal(created.recurrence, "daily");
      assert.equal(created.hour, 8);
      assert.equal(created.minute, 30);
      assert.equal(created.active, true);
      assert.equal(created.weekday, null);
      assert.equal(created.dayOfMonth, null);

      const fetched = repo.getLookupById(created.id);
      assert.deepEqual(fetched, created);

      // Update lookup
      const updated = repo.updateLookup(created.id, {
        active: false,
        hour: 9,
        minute: 0,
      });
      assert.equal(updated?.active, false);
      assert.equal(updated?.hour, 9);
      assert.equal(updated?.minute, 0);

      // List lookups
      const list = repo.listLookups("chat-1");
      assert.equal(list.length, 1);
      assert.equal(list[0].id, created.id);

      // Cancel lookup
      const cancelled = repo.cancelLookup(created.id);
      assert.equal(cancelled, true);
      assert.equal(repo.getLookupById(created.id), undefined);
      assert.equal(repo.listLookups("chat-1").length, 0);
    } finally {
      closeDatabase(db);
    }
  });

  describe("Schedule matching & February day-31 clamp", () => {
    it("matches daily recurrence on every day", () => {
      const lookup = { recurrence: "daily" as const, weekday: null, dayOfMonth: null };
      assert.equal(isScheduleMatch(lookup, new Date("2026-10-05T07:00:00+07:00")), true);
      assert.equal(isScheduleMatch(lookup, new Date("2026-10-06T07:00:00+07:00")), true);
    });

    it("matches weekly recurrence only on specified weekday", () => {
      // 2026-10-05 is Monday (weekday 1 in JS getUTCDay() when +07:00)
      // 2026-10-04 is Sunday (weekday 0)
      const weeklyMonday = { recurrence: "weekly" as const, weekday: 1, dayOfMonth: null };
      const weeklySunday = { recurrence: "weekly" as const, weekday: 0, dayOfMonth: null };

      const mondayDate = new Date("2026-10-05T07:00:00+07:00");
      const sundayDate = new Date("2026-10-04T07:00:00+07:00");

      assert.equal(isScheduleMatch(weeklyMonday, mondayDate), true);
      assert.equal(isScheduleMatch(weeklyMonday, sundayDate), false);

      assert.equal(isScheduleMatch(weeklySunday, sundayDate), true);
      assert.equal(isScheduleMatch(weeklySunday, mondayDate), false);
    });

    it("matches monthly recurrence on exact day of month", () => {
      const monthly15 = { recurrence: "monthly" as const, weekday: null, dayOfMonth: 15 };

      assert.equal(isScheduleMatch(monthly15, new Date("2026-10-15T07:00:00+07:00")), true);
      assert.equal(isScheduleMatch(monthly15, new Date("2026-10-16T07:00:00+07:00")), false);
    });

    it("clamps day 31 to last day of February (28 in non-leap, 29 in leap)", () => {
      const monthly31 = { recurrence: "monthly" as const, weekday: null, dayOfMonth: 31 };

      // 2026 is non-leap year (February has 28 days)
      const feb27 = new Date("2026-02-27T07:00:00+07:00");
      const feb28 = new Date("2026-02-28T07:00:00+07:00");
      assert.equal(isScheduleMatch(monthly31, feb27), false);
      assert.equal(isScheduleMatch(monthly31, feb28), true);

      // 2028 is leap year (February has 29 days)
      const leapFeb28 = new Date("2028-02-28T07:00:00+07:00");
      const leapFeb29 = new Date("2028-02-29T07:00:00+07:00");
      assert.equal(isScheduleMatch(monthly31, leapFeb28), false);
      assert.equal(isScheduleMatch(monthly31, leapFeb29), true);

      // In month with 31 days (e.g. March), it matches 31 and not 30
      const mar30 = new Date("2026-03-30T07:00:00+07:00");
      const mar31 = new Date("2026-03-31T07:00:00+07:00");
      assert.equal(isScheduleMatch(monthly31, mar30), false);
      assert.equal(isScheduleMatch(monthly31, mar31), true);

      // In month with 30 days (e.g. April), day 31 clamps to April 30
      const apr29 = new Date("2026-04-29T07:00:00+07:00");
      const apr30 = new Date("2026-04-30T07:00:00+07:00");
      assert.equal(isScheduleMatch(monthly31, apr29), false);
      assert.equal(isScheduleMatch(monthly31, apr30), true);
    });
  });

  describe("Due query and run claims", () => {
    it("returns due lookups according to time and date", () => {
      const { db, repo } = setup();
      try {
        const lookup = repo.createLookup({
          chatId: "chat-1",
          instruction: "Thời tiết sáng",
          recurrence: "daily",
          hour: 7,
          minute: 0,
          createdBy: "user-1",
        });

        // 06:59 -> not due yet
        const beforeTime = new Date("2026-10-05T06:59:00+07:00");
        assert.equal(repo.findDueLookups(beforeTime).length, 0);

        // 07:00 -> due!
        const exactTime = new Date("2026-10-05T07:00:00+07:00");
        const dueList = repo.findDueLookups(exactTime);
        assert.equal(dueList.length, 1);
        assert.equal(dueList[0].id, lookup.id);

        // 10:30 on same day -> still due because not yet sent or running
        const laterTime = new Date("2026-10-05T10:30:00+07:00");
        assert.equal(repo.findDueLookups(laterTime).length, 1);
      } finally {
        closeDatabase(db);
      }
    });

    it("handles unique claim, attempt counting, and reclaiming running rows older than 10 minutes", () => {
      const { db, repo } = setup();
      try {
        const lookup = repo.createLookup({
          chatId: "chat-1",
          instruction: "Tin tức buổi sáng",
          recurrence: "daily",
          hour: 7,
          minute: 0,
          createdBy: "user-1",
        });

        const fireDate = "2026-10-05";
        const t0 = 1000000;

        // 1. Initial claim succeeds
        const claim1 = repo.claimRun(lookup.id, fireDate, t0);
        assert.equal(claim1.claimed, true);
        if (!claim1.claimed) throw new Error("Expected claim to succeed");
        assert.equal(claim1.run.status, "running");
        assert.equal(claim1.run.attemptCount, 1);
        assert.equal(claim1.run.startedAt, t0);

        // 2. Immediate second claim fails (in progress)
        const claim2 = repo.claimRun(lookup.id, fireDate, t0 + 1000);
        assert.equal(claim2.claimed, false);
        assert.equal(claim2.reason, "in_progress");

        // 3. 5 minutes later, still in progress (< 10 minutes)
        const t5m = t0 + 5 * 60 * 1000;
        const claim3 = repo.claimRun(lookup.id, fireDate, t5m);
        assert.equal(claim3.claimed, false);
        assert.equal(claim3.reason, "in_progress");

        // 4. 11 minutes later (crashed attempt), reclaim succeeds with attemptCount = 2
        const t11m = t0 + 11 * 60 * 1000;
        const claim4 = repo.claimRun(lookup.id, fireDate, t11m);
        assert.equal(claim4.claimed, true);
        if (!claim4.claimed) throw new Error("Expected reclaim to succeed");
        assert.equal(claim4.run.attemptCount, 2);
        assert.equal(claim4.run.status, "running");
        assert.equal(claim4.run.startedAt, t11m);

        // 5. Another 11 minutes later, attemptCount = 3
        const t22m = t11m + 11 * 60 * 1000;
        const claim5 = repo.claimRun(lookup.id, fireDate, t22m);
        assert.equal(claim5.claimed, true);
        if (!claim5.claimed) throw new Error("Expected reclaim to succeed");
        assert.equal(claim5.run.attemptCount, 3);

        // 6. Another 11 minutes later, attemptCount reaches limit (3) -> marked failed
        const t33m = t22m + 11 * 60 * 1000;
        const claim6 = repo.claimRun(lookup.id, fireDate, t33m);
        assert.equal(claim6.claimed, false);
        assert.equal(claim6.reason, "max_attempts");

        const latest = repo.getLatestRun(lookup.id);
        assert.equal(latest?.status, "failed");
      } finally {
        closeDatabase(db);
      }
    });

    it("records success and failure correctly", () => {
      const { db, repo } = setup();
      try {
        const lookup = repo.createLookup({
          chatId: "chat-1",
          instruction: "Giá vàng",
          recurrence: "daily",
          hour: 7,
          minute: 0,
          createdBy: "user-1",
        });

        const fireDate = "2026-10-05";
        const claim = repo.claimRun(lookup.id, fireDate);
        assert.equal(claim.claimed, true);
        if (!claim.claimed) throw new Error("Expected claim to succeed");

        repo.recordRunSuccess(claim.run.id, 123456789);
        const afterSuccess = repo.getLatestRun(lookup.id);
        assert.equal(afterSuccess?.status, "sent");
        assert.equal(afterSuccess?.sentAt, 123456789);

        // Once sent, cannot be claimed again
        const retry = repo.claimRun(lookup.id, fireDate);
        assert.equal(retry.claimed, false);
        assert.equal(retry.reason, "already_completed");
      } finally {
        closeDatabase(db);
      }
    });

    it("resets started_at on non-final failure allowing immediate retry on next tick", () => {
      const { db, repo } = setup();
      try {
        const lookup = repo.createLookup({
          chatId: "chat-1",
          instruction: "Giá vàng",
          recurrence: "daily",
          hour: 7,
          minute: 0,
          createdBy: "user-1",
        });

        const fireDate = "2026-10-05";
        const t0 = 1000000;
        const claim = repo.claimRun(lookup.id, fireDate, t0);
        assert.equal(claim.claimed, true);
        if (!claim.claimed) throw new Error("Claim failed");

        // Record non-final failure (attempt 1)
        repo.recordRunFailure(claim.run.id, "Network timeout");
        const runAfterFail = repo.getLatestRun(lookup.id);
        assert.equal(runAfterFail?.lastError, "Network timeout");
        assert.equal(runAfterFail?.startedAt, 0);

        // Next tick (e.g. 1 minute later) can immediately reclaim for attempt 2!
        const nextTick = repo.claimRun(lookup.id, fireDate, t0 + 60 * 1000);
        assert.equal(nextTick.claimed, true);
        if (!nextTick.claimed) throw new Error("Next tick claim failed");
        assert.equal(nextTick.run.attemptCount, 2);
      } finally {
        closeDatabase(db);
      }
    });
  });
});
