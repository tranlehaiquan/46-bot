import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { loadConfig } from "../config.js";
import { openDatabase, type SqliteDatabase } from "../db/connection.js";
import { migrate } from "../db/migrations.js";
import { createChannelRepository, type ChannelRepository } from "../db/repositories/channels.js";
import { createEventsRepository, createUtc7Date, type EventsRepository } from "../db/repositories/events.js";
import { createLookupRepository, type LookupRepository } from "../db/repositories/lookups.js";
import type { LlmClient } from "../llm/client.js";
import type { ZaloClient } from "../zalo-client.js";
import { createScheduler, startScheduler, type Clock } from "./index.js";

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

function fakeLlm(options?: { replyText?: string; failTimes?: number }) {
  const calls: Array<{
    systemPrompt?: string;
    history: any[];
    incomingMessage: { senderId: string; senderName: string; content: string };
    tools?: any;
  }> = [];

  let failuresLeft = options?.failTimes ?? 0;

  const client: LlmClient & { calls: typeof calls } = {
    calls,
    async generateReply(params) {
      calls.push(params);
      if (failuresLeft > 0) {
        failuresLeft--;
        throw new Error("LLM failure");
      }
      return options?.replyText ?? "Hôm nay trời nắng đẹp 28 độ.";
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
  let channelRepo: ChannelRepository;
  let lookupsRepo: LookupRepository;
  let zalo: ReturnType<typeof fakeZalo>;

  beforeEach(() => {
    db = openDatabase(":memory:");
    migrate(db);
    repo = createEventsRepository(db);
    channelRepo = createChannelRepository(db);
    lookupsRepo = createLookupRepository(db);
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

  it("2.1 sends one plain-text message on fire day, sends on later same-day tick after restart, and does not duplicate once sent", async () => {
    // 2026-10-05 07:00:00 (UTC+7) -> UTC is 2026-10-05 00:00:00
    const fireTime = new Date(Date.UTC(2026, 9, 5, 0, 0, 0));
    const clock = makeClock(fireTime);

    channelRepo.upsertDiscovery({ chatId: "chat-lookup", name: "Family", chatType: "GROUP", status: "active" });

    const lookup = lookupsRepo.createLookup({
      chatId: "chat-lookup",
      instruction: "Thời tiết TP.HCM",
      recurrence: "daily",
      hour: 7,
      minute: 0,
      createdBy: "user-1",
    });

    const config = loadConfig({
      ZALO_BOT_TOKEN: "dummy-token",
      FAMILY_CHAT_IDS: "chat-lookup",
      WEBHOOK_URL: "https://example.com/webhooks/zalo",
      WEBHOOK_SECRET: "12345678",
      MODE: "webhook",
      PORT: "3000",
      GEMINI_API_KEY: "key",
    });

    const llm = fakeLlm({ replyText: "Trời nắng ráo 30 độ." });

    const scheduler = createScheduler({
      config,
      eventsRepo: repo,
      lookupsRepo,
      channelsRepo: channelRepo,
      llm,
      zalo,
      clock,
    });

    // 1. Tick at 07:00 -> sends one plain-text message
    await scheduler.tick();
    assert.equal(zalo.sends.length, 1);
    assert.equal(zalo.sends[0]?.chatId, "chat-lookup");
    assert.equal(zalo.sends[0]?.text, "Trời nắng ráo 30 độ.");

    const latestRun = lookupsRepo.getLatestRun(lookup.id);
    assert.equal(latestRun?.status, "sent");

    // 2. Later same-day tick at 07:05 -> does NOT send a second message after sent
    clock.advanceMs(5 * 60 * 1000);
    await scheduler.tick();
    assert.equal(zalo.sends.length, 1);

    // 3. Restart later same-day when lookup was NOT yet sent:
    // Create another lookup for chat-2 that was scheduled at 07:00
    const lookup2 = lookupsRepo.createLookup({
      chatId: "chat-lookup-2",
      instruction: "Báo giá vàng",
      recurrence: "daily",
      hour: 7,
      minute: 0,
      createdBy: "user-1",
    });
    channelRepo.upsertDiscovery({ chatId: "chat-lookup-2", name: "Family 2", chatType: "GROUP", status: "active" });

    // New scheduler instance simulates a restart at 10:30 later that same day
    const restartTime = new Date(Date.UTC(2026, 9, 5, 3, 30, 0)); // 10:30 UTC+7
    const restartClock = makeClock(restartTime);
    const restartedScheduler = createScheduler({
      config,
      eventsRepo: repo,
      lookupsRepo,
      channelsRepo: channelRepo,
      llm,
      zalo,
      clock: restartClock,
    });

    await restartedScheduler.tick();
    // chat-lookup-2 receives its missed occurrence on later same-day tick after restart!
    const send2 = zalo.sends.find((s) => s.chatId === "chat-lookup-2");
    assert.ok(send2);
    // and chat-lookup was NOT duplicated!
    const sendsForChat1 = zalo.sends.filter((s) => s.chatId === "chat-lookup");
    assert.equal(sendsForChat1.length, 1);
  });

  it("2.2 calls the model with only weather_check, web_search, and holiday_list_upcoming, no chat history, and the saved instruction wrapped as user data", async () => {
    const fireTime = new Date(Date.UTC(2026, 9, 5, 0, 0, 0));
    const clock = makeClock(fireTime);

    channelRepo.upsertDiscovery({ chatId: "chat-tools", name: "Family", chatType: "GROUP", status: "active" });

    lookupsRepo.createLookup({
      chatId: "chat-tools",
      instruction: "Thời tiết TP.HCM và tin tức mới nhất",
      recurrence: "daily",
      hour: 7,
      minute: 0,
      createdBy: "user-test",
    });

    const config = loadConfig({
      ZALO_BOT_TOKEN: "dummy-token",
      FAMILY_CHAT_IDS: "chat-tools",
      WEBHOOK_URL: "https://example.com/webhooks/zalo",
      WEBHOOK_SECRET: "12345678",
      MODE: "webhook",
      PORT: "3000",
      GEMINI_API_KEY: "key",
      TAVILY_API_KEY: "tavily-test-key",
    });

    const llm = fakeLlm({ replyText: "Báo cáo buổi sáng hoàn tất." });

    const scheduler = createScheduler({
      config,
      eventsRepo: repo,
      lookupsRepo,
      channelsRepo: channelRepo,
      llm,
      zalo,
      clock,
    });

    await scheduler.tick();

    assert.equal(llm.calls.length, 1);
    const call = llm.calls[0];

    // Assert tools: only weather_check, web_search, and holiday_list_upcoming
    assert.ok(call.tools);
    const toolNames = Object.keys(call.tools).sort();
    assert.deepEqual(toolNames, ["holiday_list_upcoming", "weather_check", "web_search"]);

    // Assert no write tools (e.g. holiday_import, event_add, remember)
    assert.equal("holiday_import" in call.tools, false);
    assert.equal("event_add" in call.tools, false);
    assert.equal("remember" in call.tools, false);

    // Assert no chat history
    assert.deepEqual(call.history, []);

    // Assert saved instruction passed as user data
    assert.equal(call.incomingMessage.content, "Thời tiết TP.HCM và tin tức mới nhất");
    assert.equal(call.incomingMessage.senderId, "user-test");
  });

  it("2.3 skips pending and disabled channels without inserting a run, and delivers once active later that local day", async () => {
    const morningTime = new Date(Date.UTC(2026, 9, 5, 0, 0, 0)); // 07:00 UTC+7
    const clock = makeClock(morningTime);

    // Pending channel
    channelRepo.upsertDiscovery({ chatId: "chat-pending", name: "Pending Group", chatType: "GROUP", status: "pending" });
    const pendingLookup = lookupsRepo.createLookup({
      chatId: "chat-pending",
      instruction: "Thời tiết",
      recurrence: "daily",
      hour: 7,
      minute: 0,
      createdBy: "user-1",
    });

    // Disabled channel
    channelRepo.upsertDiscovery({ chatId: "chat-disabled", name: "Disabled Group", chatType: "GROUP", status: "disabled" });
    const disabledLookup = lookupsRepo.createLookup({
      chatId: "chat-disabled",
      instruction: "Giá vàng",
      recurrence: "daily",
      hour: 7,
      minute: 0,
      createdBy: "user-2",
    });

    const config = loadConfig({
      ZALO_BOT_TOKEN: "dummy-token",
      FAMILY_CHAT_IDS: "chat-pending, chat-disabled",
      WEBHOOK_URL: "https://example.com/webhooks/zalo",
      WEBHOOK_SECRET: "12345678",
      MODE: "webhook",
      PORT: "3000",
      GEMINI_API_KEY: "key",
    });

    const llm = fakeLlm();

    const scheduler = createScheduler({
      config,
      eventsRepo: repo,
      lookupsRepo,
      channelsRepo: channelRepo,
      llm,
      zalo,
      clock,
    });

    // Tick at 07:00 -> both skipped without inserting a run
    await scheduler.tick();
    assert.equal(zalo.sends.length, 0);
    assert.equal(lookupsRepo.getLatestRun(pendingLookup.id), undefined);
    assert.equal(lookupsRepo.getLatestRun(disabledLookup.id), undefined);

    // Later that local day (11:00 UTC+7), channel-pending becomes active
    clock.advanceMs(4 * 60 * 60 * 1000);
    channelRepo.updateStatus("chat-pending", "active");

    await scheduler.tick();

    // Now delivered to chat-pending!
    assert.equal(zalo.sends.length, 1);
    assert.equal(zalo.sends[0]?.chatId, "chat-pending");
    assert.equal(lookupsRepo.getLatestRun(pendingLookup.id)?.status, "sent");
    // chat-disabled still received nothing
    assert.equal(lookupsRepo.getLatestRun(disabledLookup.id), undefined);
  });

  it("2.4 retries a failed run up to 3 times on the same local day, then stores failed and the error without calling sendMessage", async () => {
    const fireTime = new Date(Date.UTC(2026, 9, 5, 0, 0, 0)); // 07:00 UTC+7
    const clock = makeClock(fireTime);

    channelRepo.upsertDiscovery({ chatId: "chat-retry", name: "Family", chatType: "GROUP", status: "active" });
    const lookup = lookupsRepo.createLookup({
      chatId: "chat-retry",
      instruction: "Giá USD hôm nay",
      recurrence: "daily",
      hour: 7,
      minute: 0,
      createdBy: "user-1",
    });

    const config = loadConfig({
      ZALO_BOT_TOKEN: "dummy-token",
      FAMILY_CHAT_IDS: "chat-retry",
      WEBHOOK_URL: "https://example.com/webhooks/zalo",
      WEBHOOK_SECRET: "12345678",
      MODE: "webhook",
      PORT: "3000",
      GEMINI_API_KEY: "key",
    });

    // LLM will fail every time
    const llm = fakeLlm({ failTimes: 5 });

    const scheduler = createScheduler({
      config,
      eventsRepo: repo,
      lookupsRepo,
      channelsRepo: channelRepo,
      llm,
      zalo,
      clock,
    });

    // Attempt 1 at 07:00
    await scheduler.tick();
    assert.equal(zalo.sends.length, 0); // silent in chat!
    let run = lookupsRepo.getLatestRun(lookup.id);
    assert.equal(run?.attemptCount, 1);
    assert.equal(run?.lastError, "LLM failure");

    // Attempt 2 at 07:01
    clock.advanceMs(60 * 1000);
    await scheduler.tick();
    assert.equal(zalo.sends.length, 0); // still silent
    run = lookupsRepo.getLatestRun(lookup.id);
    assert.equal(run?.attemptCount, 2);

    // Attempt 3 at 07:02
    clock.advanceMs(60 * 1000);
    await scheduler.tick();
    assert.equal(zalo.sends.length, 0); // still silent
    run = lookupsRepo.getLatestRun(lookup.id);
    assert.equal(run?.attemptCount, 3);
    assert.equal(run?.status, "failed");
    assert.equal(run?.lastError, "LLM failure");

    // Attempt 4 at 07:03: max attempts reached, stays failed, no further call
    clock.advanceMs(60 * 1000);
    await scheduler.tick();
    assert.equal(zalo.sends.length, 0);
    run = lookupsRepo.getLatestRun(lookup.id);
    assert.equal(run?.status, "failed");
  });

  it("startScheduler starts in-memory scheduler when redisUrl is unset", async () => {
    const zalo = fakeZalo();
    const clock = makeClock(new Date("2026-10-06T07:00:00+07:00"));
    const config = loadConfig({
      ZALO_BOT_TOKEN: "token",
      FAMILY_CHAT_IDS: "chat1",
      WEBHOOK_URL: "https://example.com/webhook",
      WEBHOOK_SECRET: "secret123",
      MODE: "webhook",
      PORT: "3000",
      GEMINI_API_KEY: "key",
    });

    const instance = startScheduler({
      config,
      eventsRepo: repo,
      zalo,
      clock,
    });

    assert.ok(instance);
    await instance.stop();
  });

  it("startScheduler gracefully falls back to in-memory when redis connection fails", async () => {
    const zalo = fakeZalo();
    const clock = makeClock(new Date("2026-10-06T07:00:00+07:00"));
    const config = loadConfig({
      ZALO_BOT_TOKEN: "token",
      FAMILY_CHAT_IDS: "chat1",
      WEBHOOK_URL: "https://example.com/webhook",
      WEBHOOK_SECRET: "secret123",
      MODE: "webhook",
      PORT: "3000",
      GEMINI_API_KEY: "key",
      REDIS_URL: "redis://127.0.0.1:54321", // unreachable
    });

    const logs: unknown[] = [];
    const mockLog = {
      info: (obj: unknown) => logs.push(obj),
      warn: (obj: unknown) => logs.push(obj),
      error: (obj: unknown) => logs.push(obj),
    };

    const instance = startScheduler({
      config,
      eventsRepo: repo,
      zalo,
      log: mockLog as any,
      clock,
    });

    assert.ok(instance);
    await instance.stop();
  });
});

