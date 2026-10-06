import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "./db/connection.js";
import { migrate } from "./db/migrations.js";
import { createChannelRepository } from "./db/repositories/channels.js";
import { buildServer } from "./server.js";
import { WorkQueue } from "./queue.js";
import { createLogger } from "./logger.js";
import { getPendingApprovalMessage, CANNED_REPLY } from "./delivery.js";
import type { ZaloClient } from "./zalo-client.js";
import type { AppConfig } from "./config.js";

const token = "bot-token-test";
const secret = "webhook-secret-123456";

function mockConfig(familyChatIds: string[] = []): AppConfig {
  return {
    zaloBotToken: token,
    familyChatId: familyChatIds[0] ?? "",
    familyChatIds,
    webhookUrl: "https://family.example/webhooks/zalo",
    webhookSecret: secret,
    mode: "webhook",
    port: 3000,
    dbPath: ":memory:",
    botId: "bot-46",
    adminPassword: "admin-test-pass",
    llmProvider: "deepseek",
    llmApiKey: "test-key",
    llmModel: "deepseek-chat",
    geminiModel: "gemini-3.8-flash",
    deepseekModel: "deepseek-chat",
  };
}

function fakeZalo(): ZaloClient & {
  sends: Array<{ chatId: string; text: string }>;
  actions: Array<{ chatId: string; action: string }>;
} {
  const sends: Array<{ chatId: string; text: string }> = [];
  const actions: Array<{ chatId: string; action: string }> = [];
  return {
    sends,
    actions,
    getWebhookInfo: async () => ({ url: "https://family.example/webhooks/zalo" }),
    setWebhook: async () => ({ outcome: "ok" }),
    testWebhook: async () => ({ outcome: "ok" }),
    sendMessage: async (chatId, text) => {
      sends.push({ chatId, text });
    },
    sendChatAction: async (chatId, action) => {
      actions.push({ chatId, action });
    },
  };
}

function deliveryPayload(overrides: {
  chatId: string;
  chatType?: "GROUP" | "PRIVATE";
  text: string;
  messageId: string;
  senderId?: string;
  senderName?: string;
  mentions?: Array<{ uid: string }>;
}) {
  return {
    ok: true,
    result: {
      event_name: "message.text.received",
      message: {
        from: {
          id: overrides.senderId ?? "user-1",
          display_name: overrides.senderName ?? "Alice",
          is_bot: false,
        },
        chat: {
          id: overrides.chatId,
          chat_type: overrides.chatType ?? "GROUP",
        },
        text: overrides.text,
        message_id: overrides.messageId,
        mentions: overrides.mentions,
      },
    },
  };
}

describe("Channel Delivery & Runtime Gating", () => {
  it("auto-discovers new channels into pending and replies with pending notice when addressed", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const channelRepo = createChannelRepository(db);
      const zalo = fakeZalo();
      const queue = new WorkQueue();
      const config = mockConfig([]);

      const app = buildServer({
        config,
        log: createLogger(),
        zalo,
        queue,
        channelRepo,
      });

      // 1. Group message without mention -> should record channel, but remain silent
      const silentDelivery = deliveryPayload({
        chatId: "group-auto-1",
        chatType: "GROUP",
        messageId: "msg-silent-1",
        text: "hello group without mention",
      });

      const res1 = await app.inject({
        method: "POST",
        url: "/webhooks/zalo",
        headers: {
          "content-type": "application/json",
          "x-bot-api-secret-token": secret,
        },
        payload: JSON.stringify(silentDelivery),
      });
      assert.equal(res1.statusCode, 200);
      await queue.drain();

      // Verify channel was created with pending status
      const ch1 = await channelRepo.getChannel("group-auto-1");
      assert.ok(ch1);
      assert.equal(ch1.status, "pending");
      assert.equal(zalo.sends.length, 0);

      // 2. Mention in the pending group -> should reply with pending approval notice
      const mentionDelivery = deliveryPayload({
        chatId: "group-auto-1",
        chatType: "GROUP",
        messageId: "msg-mention-1",
        text: "@bot-46 help me please",
        mentions: [{ uid: "bot-46" }],
      });

      const res2 = await app.inject({
        method: "POST",
        url: "/webhooks/zalo",
        headers: {
          "content-type": "application/json",
          "x-bot-api-secret-token": secret,
        },
        payload: JSON.stringify(mentionDelivery),
      });
      assert.equal(res2.statusCode, 200);
      await queue.drain();

      assert.equal(zalo.sends.length, 1);
      assert.equal(zalo.sends[0].chatId, "group-auto-1");
      assert.equal(zalo.sends[0].text, getPendingApprovalMessage("group-auto-1"));

      await app.close();
    } finally {
      closeDatabase(db);
    }
  });

  it("handles transition from pending to active and allows conversations", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const channelRepo = createChannelRepository(db);
      const zalo = fakeZalo();
      const queue = new WorkQueue();
      const config = mockConfig([]);

      const app = buildServer({
        config,
        log: createLogger(),
        zalo,
        queue,
        channelRepo,
      });

      // Initially channel is created as active by admin
      await channelRepo.upsertDiscovery({
        chatId: "group-active-1",
        name: "Gia Đình 46",
        chatType: "GROUP",
        status: "active",
      });

      const mentionDelivery = deliveryPayload({
        chatId: "group-active-1",
        chatType: "GROUP",
        messageId: "msg-act-1",
        text: "@bot-46 chào bạn",
        mentions: [{ uid: "bot-46" }],
      });

      const res = await app.inject({
        method: "POST",
        url: "/webhooks/zalo",
        headers: {
          "content-type": "application/json",
          "x-bot-api-secret-token": secret,
        },
        payload: JSON.stringify(mentionDelivery),
      });
      assert.equal(res.statusCode, 200);
      await queue.drain();

      // Since no llmClient is attached in this minimal test, should send CANNED_REPLY
      assert.equal(zalo.sends.length, 1);
      assert.equal(zalo.sends[0].chatId, "group-active-1");
      assert.equal(zalo.sends[0].text, CANNED_REPLY);

      await app.close();
    } finally {
      closeDatabase(db);
    }
  });

  it("completely silences disabled channels", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const channelRepo = createChannelRepository(db);
      const zalo = fakeZalo();
      const queue = new WorkQueue();
      const config = mockConfig([]);

      const app = buildServer({
        config,
        log: createLogger(),
        zalo,
        queue,
        channelRepo,
      });

      // Channel is disabled
      await channelRepo.upsertDiscovery({
        chatId: "group-disabled-1",
        name: "Disabled Group",
        chatType: "GROUP",
        status: "disabled",
      });

      const mentionDelivery = deliveryPayload({
        chatId: "group-disabled-1",
        chatType: "GROUP",
        messageId: "msg-dis-1",
        text: "@bot-46 are you there?",
        mentions: [{ uid: "bot-46" }],
      });

      const res = await app.inject({
        method: "POST",
        url: "/webhooks/zalo",
        headers: {
          "content-type": "application/json",
          "x-bot-api-secret-token": secret,
        },
        payload: JSON.stringify(mentionDelivery),
      });
      assert.equal(res.statusCode, 200);
      await queue.drain();

      assert.equal(zalo.sends.length, 0);

      await app.close();
    } finally {
      closeDatabase(db);
    }
  });

  it("completes full end-to-end lifecycle: discovery -> pending notice -> admin approval -> active conversation", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const channelRepo = createChannelRepository(db);
      const zalo = fakeZalo();
      const queue = new WorkQueue();
      const config = mockConfig([]);

      const app = buildServer({
        config,
        log: createLogger(),
        zalo,
        queue,
        channelRepo,
      });

      // Step 1: User addresses bot in an unknown group
      const mentionDelivery = deliveryPayload({
        chatId: "group-e2e-99",
        chatType: "GROUP",
        messageId: "msg-e2e-1",
        text: "@bot-46 xin chào bot",
        senderName: "Bố",
        mentions: [{ uid: "bot-46" }],
      });

      const res1 = await app.inject({
        method: "POST",
        url: "/webhooks/zalo",
        headers: {
          "content-type": "application/json",
          "x-bot-api-secret-token": secret,
        },
        payload: JSON.stringify(mentionDelivery),
      });
      assert.equal(res1.statusCode, 200);
      await queue.drain();

      // Step 2: Channel is recorded as pending, and bot replied with pending notice
      const channelBefore = await channelRepo.getChannel("group-e2e-99");
      assert.ok(channelBefore);
      assert.equal(channelBefore.status, "pending");
      assert.equal(zalo.sends.length, 1);
      assert.equal(zalo.sends[0].text, getPendingApprovalMessage("group-e2e-99"));

      // Step 3: Admin logs in
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/admin/login",
        payload: JSON.stringify({ password: "admin-test-pass" }),
      });
      assert.equal(loginRes.statusCode, 200);
      const { token: adminToken } = JSON.parse(loginRes.body);

      // Step 4: Admin approves the channel
      const approveRes = await app.inject({
        method: "PATCH",
        url: "/api/admin/channels/group-e2e-99",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: JSON.stringify({ status: "active", name: "Gia Đình Hạnh Phúc" }),
      });
      assert.equal(approveRes.statusCode, 200);
      assert.equal((await channelRepo.getChannel("group-e2e-99"))?.status, "active");

      // Step 5: User sends a new message to the bot
      const convoDelivery = deliveryPayload({
        chatId: "group-e2e-99",
        chatType: "GROUP",
        messageId: "msg-e2e-2",
        text: "@bot-46 hôm nay ăn gì?",
        mentions: [{ uid: "bot-46" }],
      });

      const res2 = await app.inject({
        method: "POST",
        url: "/webhooks/zalo",
        headers: {
          "content-type": "application/json",
          "x-bot-api-secret-token": secret,
        },
        payload: JSON.stringify(convoDelivery),
      });
      assert.equal(res2.statusCode, 200);
      await queue.drain();

      // Bot sent: 1) pending notice, 2) activation announcement, 3) normal reply
      assert.equal(zalo.sends.length, 3);
      assert.equal(zalo.sends[2].chatId, "group-e2e-99");
      assert.equal(zalo.sends[2].text, CANNED_REPLY);

      await app.close();
    } finally {
      closeDatabase(db);
    }
  });
});
