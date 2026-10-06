import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { registerRepeatableJobs, enqueueLookupJob, enqueueEventReminderJob } from "./queue.js";

describe("BullMQ Queue & Repeatable Jobs", () => {
  it("registers morning briefing, event reminders, weekly outlook, and due lookups with Asia/Ho_Chi_Minh timezone", async () => {
    const upsertCalls: Array<{ id: string; pattern: string; tz?: string; name?: string }> = [];
    const mockQueue = {
      upsertJobScheduler: async (id: string, repeatOpts: any, template: any) => {
        upsertCalls.push({
          id,
          pattern: repeatOpts.pattern,
          tz: repeatOpts.tz,
          name: template?.name,
        });
      },
    };

    await registerRepeatableJobs(mockQueue as any);

    assert.equal(upsertCalls.length, 4);

    const morning = upsertCalls.find((c) => c.name === "morning-briefing");
    assert.ok(morning);
    assert.equal(morning.pattern, "0 7 * * *");
    assert.equal(morning.tz, "Asia/Ho_Chi_Minh");

    const reminders = upsertCalls.find((c) => c.name === "event-reminders");
    assert.ok(reminders);
    assert.equal(reminders.pattern, "0 8 * * *");
    assert.equal(reminders.tz, "Asia/Ho_Chi_Minh");

    const weekly = upsertCalls.find((c) => c.name === "weekly-summary");
    assert.ok(weekly);
    assert.equal(weekly.pattern, "0 20 * * 0");
    assert.equal(weekly.tz, "Asia/Ho_Chi_Minh");

    const tick = upsertCalls.find((c) => c.name === "due-lookups-tick");
    assert.ok(tick);
    assert.equal(tick.pattern, "* * * * *");
    assert.equal(tick.tz, "Asia/Ho_Chi_Minh");
  });

  it("enqueues lookup job with deterministic jobId for deduplication", async () => {
    const addCalls: any[] = [];
    const mockQueue = {
      add: async (name: string, data: any, opts: any) => {
        addCalls.push({ name, data, opts });
      },
    };

    await enqueueLookupJob(mockQueue as any, { lookupId: 42, dateStr: "2026-10-06" });
    assert.equal(addCalls.length, 1);
    assert.equal(addCalls[0].name, "scheduled-lookup");
    assert.equal(addCalls[0].opts.jobId, "lookup:42:2026-10-06");
  });

  it("enqueues event reminder job with deterministic jobId", async () => {
    const addCalls: any[] = [];
    const mockQueue = {
      add: async (name: string, data: any, opts: any) => {
        addCalls.push({ name, data, opts });
      },
    };

    await enqueueEventReminderJob(mockQueue as any, { eventId: 101, occurrenceDateStr: "2026-10-06" });
    assert.equal(addCalls.length, 1);
    assert.equal(addCalls[0].name, "event-reminder");
    assert.equal(addCalls[0].opts.jobId, "reminder:101:2026-10-06");
  });
});
