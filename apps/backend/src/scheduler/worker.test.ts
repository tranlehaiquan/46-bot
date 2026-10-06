import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { processJob, createSchedulerWorker } from "./worker.js";

describe("BullMQ Worker job processor", () => {
  it("processes morning briefing job successfully", async () => {
    const sentMessages: Array<{ chatId: string; text: string }> = [];
    const mockZalo = {
      sendMessage: async (chatId: string, text: string) => {
        sentMessages.push({ chatId, text });
      },
    };

    const mockEventsRepo = {
      listUpcomingEvents: () => [
        {
          event: { id: 1, chatId: "chat-1", title: "Sinh nhật Mẹ", kind: "birthday", calendar: "solar" },
          occurrenceDate: new Date(),
          occurrenceDateStr: "2026-10-06",
          daysRemaining: 0,
        },
      ],
      isReminderSent: () => false,
      recordReminderSent: () => {},
      findEventsDueForReminder: () => [],
    };

    const deps: any = {
      config: { familyChatIds: ["chat-1"] },
      eventsRepo: mockEventsRepo,
      zalo: mockZalo,
      clock: { now: () => new Date("2026-10-06T07:00:00+07:00") },
    };

    const job: any = { name: "morning-briefing", data: {} };
    await processJob(job, deps);

    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].chatId, "chat-1");
    assert.match(sentMessages[0].text, /Chào buổi sáng/);
  });

  it("processes event reminders job and marks sent", async () => {
    const sentMessages: Array<{ chatId: string; text: string }> = [];
    const recordedReminders: any[] = [];

    const mockZalo = {
      sendMessage: async (chatId: string, text: string) => {
        sentMessages.push({ chatId, text });
      },
    };

    const mockEventsRepo = {
      findEventsDueForReminder: () => [
        {
          event: { id: 2, chatId: "chat-1", title: "Khám sức khỏe", notes: null, calendar: "solar" },
          occurrenceDate: new Date(),
          occurrenceDateStr: "2026-10-06",
          daysRemaining: 0,
          isAdvanceNotice: false,
        },
      ],
      isReminderSent: () => false,
      recordReminderSent: (eventId: number, dateStr: string) => {
        recordedReminders.push({ eventId, dateStr });
      },
    };

    const deps: any = {
      config: { familyChatIds: ["chat-1"] },
      eventsRepo: mockEventsRepo,
      zalo: mockZalo,
      clock: { now: () => new Date("2026-10-06T08:00:00+07:00") },
    };

    const job: any = { name: "event-reminders", data: {} };
    await processJob(job, deps);

    assert.equal(sentMessages.length, 1);
    assert.equal(recordedReminders.length, 1);
    assert.equal(recordedReminders[0].eventId, 2);
    assert.match(sentMessages[0].text, /Khám sức khỏe/);
  });

  it("creates worker with configured concurrency and rate limiter", () => {
    const mockRedis = {
      options: {},
      on: () => {},
    };

    const deps: any = {
      config: { schedulerConcurrency: 8 },
      clock: { now: () => new Date() },
    };

    const worker = createSchedulerWorker(mockRedis as any, deps, "test-queue");
    assert.equal(worker.opts.concurrency, 8);
    assert.deepEqual(worker.opts.limiter, { max: 10, duration: 2000 });
    worker.close();
  });
});
