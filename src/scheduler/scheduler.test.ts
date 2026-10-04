import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { loadConfig } from "../config.js";
import { openDatabase, type SqliteDatabase } from "../db/connection.js";
import { migrate } from "../db/migrations.js";
import { createEventsRepository, createUtc7Date, type EventsRepository } from "../db/repositories/events.js";
import type { ZaloClient } from "../zalo-client.js";
import { createScheduler, type Clock } from "./index.js";

function fakeZalo() {
  const sends: Array<{ chatId: string; text: string }> = [];
  const client: ZaloClient & { sends: typeof sends } = {
    sends,
    async sendMessage(chatId: string, text: string) {
      sends.push({ chatId, text });
    },
    async getWebhookInfo() {
      return { url: "" };
    },
    async setWebhook() {
      return { outcome: "ok" };
    },
    async testWebhook() {
      return { outcome: "ok" };
    },
  };
  return client;
}

function makeClock(initialDate: Date): Clock & { setDate(d: Date): void; advanceMs(ms: number): void } {
  let current = new Date(initialDate.getTime());
  return {
    now: () => new Date(current.getTime()),
    setDate: (d: Date) => {
      current = new Date(d.getTime());
    },
    advanceMs: (ms: number) => {
      current = new Date(current.getTime() + ms);
    },
  };
}

describe("Background Scheduler Engine", () => {
  let db: SqliteDatabase;
  let repo: EventsRepository;
  let zalo: ReturnType<typeof fakeZalo>;

  beforeEach(() => {
    db = openDatabase(":memory:");
    migrate(db);
    repo = createEventsRepository(db);
    zalo = fakeZalo();
  });

  it("triggers 07:00 morning briefing for configured channels and isolates events per chat", async () => {
    // 2026-10-05 07:00:00 (UTC+7) -> UTC is 2026-10-05 00:00:00
    const morningTime = new Date(Date.UTC(2026, 9, 5, 0, 0, 0));
    const clock = makeClock(morningTime);

    // Chat A has an event today
    repo.createEvent({
      chatId: "chat-A",
      title: "Sinh nhật Mẹ",
      day: 5,
      month: 10,
      year: 1968,
      recurrence: "yearly",
      kind: "birthday",
      createdBy: "user-1",
    });

    // Chat B has an event in 3 days
    repo.createEvent({
      chatId: "chat-B",
      title: "Kỷ niệm ngày cưới",
      day: 8,
      month: 10,
      year: 2020,
      recurrence: "yearly",
      kind: "anniversary",
      createdBy: "user-2",
    });

    const config = loadConfig({
      ZALO_BOT_TOKEN: "dummy-token",
      FAMILY_CHAT_IDS: "chat-A, chat-B",
      WEBHOOK_URL: "https://example.com/webhooks/zalo",
      WEBHOOK_SECRET: "12345678",
      MODE: "webhook",
      PORT: "3000",
      GEMINI_API_KEY: "key",
    });

    const scheduler = createScheduler({
      config,
      eventsRepo: repo,
      zalo,
      clock,
    });

    await scheduler.tick();

    // Both channels received their respective briefings
    assert.equal(zalo.sends.length, 2);

    const sendA = zalo.sends.find((s) => s.chatId === "chat-A");
    assert.ok(sendA);
    assert.match(sendA.text, /Sinh nhật Mẹ/);
    assert.equal(sendA.text.includes("Kỷ niệm ngày cưới"), false); // Chat B's event is not leaked to Chat A!

    const sendB = zalo.sends.find((s) => s.chatId === "chat-B");
    assert.ok(sendB);
    assert.match(sendB.text, /Kỷ niệm ngày cưới/);
    assert.equal(sendB.text.includes("Sinh nhật Mẹ"), false); // Chat A's event is not leaked to Chat B!
  });

  it("triggers 08:00 event reminders strictly to the event origin chat", async () => {
    // 2026-10-05 08:00:00 (UTC+7) -> UTC is 2026-10-05 01:00:00
    const reminderTime = new Date(Date.UTC(2026, 9, 5, 1, 0, 0));
    const clock = makeClock(reminderTime);

    // Event in chat-A happening today
    const ev1 = repo.createEvent({
      chatId: "chat-A",
      title: "Họp phụ huynh",
      day: 5,
      month: 10,
      year: 2026,
      remindDaysBefore: 0,
      createdBy: "user-1",
    });

    // Advance reminder in chat-B happening in 3 days (remindDaysBefore = 3)
    const ev2 = repo.createEvent({
      chatId: "chat-B",
      title: "Giỗ Ông Cụ",
      calendar: "solar",
      day: 8,
      month: 10,
      year: 2026,
      remindDaysBefore: 3,
      createdBy: "user-2",
    });

    const config = loadConfig({
      ZALO_BOT_TOKEN: "dummy-token",
      FAMILY_CHAT_IDS: "chat-A, chat-B",
      WEBHOOK_URL: "https://example.com/webhooks/zalo",
      WEBHOOK_SECRET: "12345678",
      MODE: "webhook",
      PORT: "3000",
      GEMINI_API_KEY: "key",
    });

    const scheduler = createScheduler({
      config,
      eventsRepo: repo,
      zalo,
      clock,
    });

    await scheduler.tick();

    assert.equal(zalo.sends.length, 2);

    const sendA = zalo.sends.find((s) => s.chatId === "chat-A");
    assert.ok(sendA);
    assert.match(sendA.text, /Nhắc nhở hôm nay/);
    assert.match(sendA.text, /Họp phụ huynh/);

    const sendB = zalo.sends.find((s) => s.chatId === "chat-B");
    assert.ok(sendB);
    assert.match(sendB.text, /Nhắc trước: còn 3 ngày nữa/);
    assert.match(sendB.text, /Giỗ Ông Cụ/);

    // Verify recorded in SQLite reminders_sent
    assert.equal(repo.isReminderSent(ev1.id, "2026-10-05"), true);
    assert.equal(repo.isReminderSent(ev2.id, "2026-10-08"), true);
  });

  it("does not duplicate reminder sends across multiple ticks or scheduler restarts (idempotency)", async () => {
    const reminderTime = new Date(Date.UTC(2026, 9, 5, 1, 0, 0));
    const clock = makeClock(reminderTime);

    repo.createEvent({
      chatId: "chat-A",
      title: "Khám định kỳ",
      day: 5,
      month: 10,
      year: 2026,
      remindDaysBefore: 0,
      createdBy: "user-1",
    });

    const config = loadConfig({
      ZALO_BOT_TOKEN: "dummy-token",
      FAMILY_CHAT_IDS: "chat-A",
      WEBHOOK_URL: "https://example.com/webhooks/zalo",
      WEBHOOK_SECRET: "12345678",
      MODE: "webhook",
      PORT: "3000",
      GEMINI_API_KEY: "key",
    });

    const scheduler1 = createScheduler({
      config,
      eventsRepo: repo,
      zalo,
      clock,
    });

    // First tick
    await scheduler1.tick();
    assert.equal(zalo.sends.length, 1);

    // Second tick at same minute
    await scheduler1.tick();
    assert.equal(zalo.sends.length, 1);

    // Restart process (new scheduler instance) with clock at 08:15 (within catch-up window)
    clock.advanceMs(15 * 60 * 1000);
    const scheduler2 = createScheduler({
      config,
      eventsRepo: repo,
      zalo,
      clock,
    });

    await scheduler2.runCatchUp();
    // Reminder is strictly not duplicated because it's recorded in reminders_sent
    const reminderSends = zalo.sends.filter((s) => s.text.includes("Nhắc nhở"));
    assert.equal(reminderSends.length, 1);
  });

  it("delivers event reminders to event origin chat even when FAMILY_CHAT_IDS is empty", async () => {
    const reminderTime = new Date(Date.UTC(2026, 9, 5, 1, 0, 0));
    const clock = makeClock(reminderTime);

    repo.createEvent({
      chatId: "group-discovered-xyz",
      title: "Lễ hội làng",
      day: 5,
      month: 10,
      year: 2026,
      remindDaysBefore: 0,
      createdBy: "user-1",
    });

    const config = loadConfig({
      ZALO_BOT_TOKEN: "dummy-token",
      FAMILY_CHAT_IDS: "", // empty discovery mode
      WEBHOOK_URL: "https://example.com/webhooks/zalo",
      WEBHOOK_SECRET: "12345678",
      MODE: "webhook",
      PORT: "3000",
      GEMINI_API_KEY: "key",
    });

    const scheduler = createScheduler({
      config,
      eventsRepo: repo,
      zalo,
      clock,
    });

    await scheduler.tick();

    // Event reminder was sent to origin chat group-discovered-xyz
    assert.equal(zalo.sends.length, 1);
    assert.equal(zalo.sends[0]?.chatId, "group-discovered-xyz");
    assert.match(zalo.sends[0]?.text ?? "", /Lễ hội làng/);
  });

  it("triggers Sunday 20:00 weekly summary", async () => {
    // 2026-10-04 is Sunday. 20:00 (UTC+7) -> UTC is 2026-10-04 13:00:00
    const sundayEvening = new Date(Date.UTC(2026, 9, 4, 13, 0, 0));
    const clock = makeClock(sundayEvening);

    repo.createEvent({
      chatId: "chat-family",
      title: "Sinh nhật bé Na",
      day: 8,
      month: 10,
      year: 2026,
      createdBy: "user-1",
    });

    const config = loadConfig({
      ZALO_BOT_TOKEN: "dummy-token",
      FAMILY_CHAT_IDS: "chat-family",
      WEBHOOK_URL: "https://example.com/webhooks/zalo",
      WEBHOOK_SECRET: "12345678",
      MODE: "webhook",
      PORT: "3000",
      GEMINI_API_KEY: "key",
    });

    const scheduler = createScheduler({
      config,
      eventsRepo: repo,
      zalo,
      clock,
    });

    await scheduler.tick();

    assert.equal(zalo.sends.length, 1);
    assert.equal(zalo.sends[0]?.chatId, "chat-family");
    assert.match(zalo.sends[0]?.text ?? "", /Điểm tin tuần mới/);
    assert.match(zalo.sends[0]?.text ?? "", /Sinh nhật bé Na/);
  });

  it("catches up missed reminders on startup within 2 hours", async () => {
    // 08:30 (UTC+7) -> missed 08:00 reminder
    const catchUpTime = new Date(Date.UTC(2026, 9, 5, 1, 30, 0));
    const clock = makeClock(catchUpTime);

    repo.createEvent({
      chatId: "chat-A",
      title: "Đi họp",
      day: 5,
      month: 10,
      year: 2026,
      remindDaysBefore: 0,
      createdBy: "user-1",
    });

    const config = loadConfig({
      ZALO_BOT_TOKEN: "dummy-token",
      FAMILY_CHAT_IDS: "chat-A",
      WEBHOOK_URL: "https://example.com/webhooks/zalo",
      WEBHOOK_SECRET: "12345678",
      MODE: "webhook",
      PORT: "3000",
      GEMINI_API_KEY: "key",
    });

    const scheduler = createScheduler({
      config,
      eventsRepo: repo,
      zalo,
      clock,
    });

    await scheduler.runCatchUp();

    const reminderSend = zalo.sends.find((s) => s.text.includes("Nhắc nhở"));
    assert.ok(reminderSend);
    assert.equal(reminderSend.chatId, "chat-A");
    assert.match(reminderSend.text, /Đi họp/);
  });
});
