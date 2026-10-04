import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrations.js";
import { createChannelRepository } from "../db/repositories/channels.js";
import { createMessageRepository } from "../db/message-repo.js";
import { createEventsRepository } from "../db/repositories/events.js";
import { createMemoryRepository } from "../db/repositories/memory.js";
import { buildServer } from "../server.js";
import { createLogger } from "../logger.js";
import type { ZaloClient } from "../zalo-client.js";
import type { AppConfig } from "../config.js";
import { getChannelActivatedMessage } from "../delivery.js";

const token = "bot-token-test";
const secret = "webhook-secret-123456";
const adminPassword = "super-secret-admin-pass";

function mockConfig(): AppConfig {
  return {
    zaloBotToken: token,
    familyChatId: "group-1",
    familyChatIds: ["group-1"],
    webhookUrl: "https://family.example/webhooks/zalo",
    webhookSecret: secret,
    mode: "webhook",
    port: 3000,
    dbPath: ":memory:",
    botId: "bot-46",
    adminPassword,
    llmProvider: "deepseek",
    llmApiKey: "test-key",
    llmModel: "deepseek-chat",
    geminiModel: "gemini-3.8-flash",
    deepseekModel: "deepseek-chat",
  };
}

function fakeZalo(): ZaloClient & {
  sends: Array<{ chatId: string; text: string }>;
} {
  const sends: Array<{ chatId: string; text: string }> = [];
  return {
    sends,
    getWebhookInfo: async () => ({ url: "https://family.example/webhooks/zalo" }),
    setWebhook: async () => ({ outcome: "ok" }),
    testWebhook: async () => ({ outcome: "ok" }),
    sendMessage: async (chatId, text) => {
      sends.push({ chatId, text });
    },
  };
}

describe("Admin REST API", () => {
  it("authenticates admin and rejects unauthorized access", async () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const app = buildServer({
        config: mockConfig(),
        log: createLogger(),
        zalo: fakeZalo(),
      });

      // 1. Login with wrong password
      const wrongRes = await app.inject({
        method: "POST",
        url: "/api/admin/login",
        payload: JSON.stringify({ password: "wrong-password" }),
      });
      assert.equal(wrongRes.statusCode, 401);

      // 2. Login with correct password
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/admin/login",
        payload: JSON.stringify({ password: adminPassword }),
      });
      assert.equal(loginRes.statusCode, 200);
      const loginBody = JSON.parse(loginRes.body) as { ok: boolean; token: string };
      assert.equal(loginBody.ok, true);
      assert.ok(loginBody.token);

      // 3. Access protected route without token -> 401
      const noAuthRes = await app.inject({
        method: "GET",
        url: "/api/admin/channels",
      });
      assert.equal(noAuthRes.statusCode, 401);

      // 4. Access protected route with token -> 200
      const authedRes = await app.inject({
        method: "GET",
        url: "/api/admin/channels",
        headers: {
          authorization: `Bearer ${loginBody.token}`,
        },
      });
      assert.equal(authedRes.statusCode, 200);

      await app.close();
    } finally {
      closeDatabase(db);
    }
  });

  it("manages channels lifecycle via API", async () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const channelRepo = createChannelRepository(db);
      const messageRepo = createMessageRepository(db);
      const zalo = fakeZalo();
      channelRepo.upsertDiscovery({
        chatId: "group-100",
        name: "Discovery Group",
        chatType: "GROUP",
        status: "pending",
      });

      const app = buildServer({
        config: mockConfig(),
        log: createLogger(),
        zalo,
        channelRepo,
        messageRepo,
      });

      // List all
      const listRes = await app.inject({
        method: "GET",
        url: "/api/admin/channels",
        headers: { authorization: `Bearer ${adminPassword}` },
      });
      assert.equal(listRes.statusCode, 200);
      const listBody = JSON.parse(listRes.body);
      assert.equal(listBody.channels.length, 1);
      assert.equal(listBody.channels[0].chatId, "group-100");
      assert.equal(listBody.channels[0].status, "pending");

      // Update status to active and rename
      const patchRes = await app.inject({
        method: "PATCH",
        url: "/api/admin/channels/group-100",
        headers: { authorization: `Bearer ${adminPassword}` },
        payload: JSON.stringify({ status: "active", name: "Official Group" }),
      });
      assert.equal(patchRes.statusCode, 200);
      const patchBody = JSON.parse(patchRes.body);
      assert.equal(patchBody.ok, true);
      assert.equal(patchBody.channel.status, "active");
      assert.equal(patchBody.channel.name, "Official Group");
      assert.deepEqual(zalo.sends, [{ chatId: "group-100", text: getChannelActivatedMessage() }]);
      assert.equal(messageRepo.getRecent("group-100")[0].content, getChannelActivatedMessage());

      // Other transitions, including an unchanged active status, do not repeat the message.
      const repeatPatchRes = await app.inject({
        method: "PATCH",
        url: "/api/admin/channels/group-100",
        headers: { authorization: `Bearer ${adminPassword}` },
        payload: JSON.stringify({ status: "active" }),
      });
      assert.equal(repeatPatchRes.statusCode, 200);
      assert.equal(zalo.sends.length, 1);

      await app.close();
    } finally {
      closeDatabase(db);
    }
  });

  it("manages messages, sending direct messages, and viewing history", async () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const messageRepo = createMessageRepository(db);
      const zalo = fakeZalo();

      messageRepo.insert({
        chatId: "group-200",
        senderId: "u-1",
        senderName: "User 1",
        role: "user",
        content: "Hello bot!",
      });

      const app = buildServer({
        config: mockConfig(),
        log: createLogger(),
        zalo,
        messageRepo,
      });

      // Get messages
      const getRes = await app.inject({
        method: "GET",
        url: "/api/admin/channels/group-200/messages",
        headers: { authorization: `Bearer ${adminPassword}` },
      });
      assert.equal(getRes.statusCode, 200);
      const getBody = JSON.parse(getRes.body);
      assert.equal(getBody.messages.length, 1);
      assert.equal(getBody.messages[0].content, "Hello bot!");

      // Send message via admin
      const sendRes = await app.inject({
        method: "POST",
        url: "/api/admin/channels/group-200/messages",
        headers: { authorization: `Bearer ${adminPassword}` },
        payload: JSON.stringify({ content: "Direct reply from admin" }),
      });
      assert.equal(sendRes.statusCode, 200);
      assert.equal(zalo.sends.length, 1);
      assert.equal(zalo.sends[0].text, "Direct reply from admin");

      // Verify message is saved to repo
      const recent = messageRepo.getRecent("group-200");
      assert.equal(recent.length, 2);
      assert.equal(recent[1].content, "Direct reply from admin");
      assert.equal(recent[1].role, "assistant");

      await app.close();
    } finally {
      closeDatabase(db);
    }
  });

  it("manages channel events and reminders", async () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const eventsRepo = createEventsRepository(db);
      const app = buildServer({
        config: mockConfig(),
        log: createLogger(),
        zalo: fakeZalo(),
        eventsRepo,
      });

      // Create event
      const createRes = await app.inject({
        method: "POST",
        url: "/api/admin/channels/group-300/events",
        headers: { authorization: `Bearer ${adminPassword}` },
        payload: JSON.stringify({
          title: "Sinh nhật Bé",
          kind: "birthday",
          calendar: "solar",
          day: 15,
          month: 10,
          remindDaysBefore: 1,
        }),
      });
      assert.equal(createRes.statusCode, 201);
      const createBody = JSON.parse(createRes.body);
      assert.equal(createBody.ok, true);
      assert.equal(createBody.event.title, "Sinh nhật Bé");
      const eventId = createBody.event.id;

      // List events
      const listRes = await app.inject({
        method: "GET",
        url: "/api/admin/channels/group-300/events",
        headers: { authorization: `Bearer ${adminPassword}` },
      });
      assert.equal(listRes.statusCode, 200);
      const listBody = JSON.parse(listRes.body);
      assert.equal(listBody.events.length, 1);

      // Delete event
      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/api/admin/channels/group-300/events/${eventId}`,
        headers: { authorization: `Bearer ${adminPassword}` },
      });
      assert.equal(deleteRes.statusCode, 200);
      assert.equal(JSON.parse(deleteRes.body).ok, true);

      // Verify empty list
      assert.equal(eventsRepo.getEventsByChat("group-300").length, 0);

      await app.close();
    } finally {
      closeDatabase(db);
    }
  });

  it("manages channel memories and stories", async () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const memoryRepo = createMemoryRepository(db);
      const app = buildServer({
        config: mockConfig(),
        log: createLogger(),
        zalo: fakeZalo(),
        memoryRepo,
      });

      // Create fact
      const factRes = await app.inject({
        method: "POST",
        url: "/api/admin/channels/group-400/memories/facts",
        headers: { authorization: `Bearer ${adminPassword}` },
        payload: JSON.stringify({
          subject: "Mẹ",
          fact: "Thích hoa cúc họa mi",
        }),
      });
      assert.equal(factRes.statusCode, 201);
      const factBody = JSON.parse(factRes.body);
      const factId = factBody.memory.id;

      // Create story
      const storyRes = await app.inject({
        method: "POST",
        url: "/api/admin/channels/group-400/memories/stories",
        headers: { authorization: `Bearer ${adminPassword}` },
        payload: JSON.stringify({
          title: "Chuyến đi Đà Lạt",
          story: "Gia đình đi ngắm hoa dã quỳ rất vui.",
          people: "Bố, Mẹ, Con",
        }),
      });
      assert.equal(storyRes.statusCode, 201);
      const storyId = JSON.parse(storyRes.body).story.id;

      // List memories
      const listRes = await app.inject({
        method: "GET",
        url: "/api/admin/channels/group-400/memories",
        headers: { authorization: `Bearer ${adminPassword}` },
      });
      assert.equal(listRes.statusCode, 200);
      const listBody = JSON.parse(listRes.body);
      assert.equal(listBody.facts.length, 1);
      assert.equal(listBody.stories.length, 1);

      // Delete fact by ID
      const delFactRes = await app.inject({
        method: "DELETE",
        url: `/api/admin/channels/group-400/memories/facts/${factId}`,
        headers: { authorization: `Bearer ${adminPassword}` },
      });
      assert.equal(delFactRes.statusCode, 200);

      // Delete story by ID
      const delStoryRes = await app.inject({
        method: "DELETE",
        url: `/api/admin/channels/group-400/memories/stories/${storyId}`,
        headers: { authorization: `Bearer ${adminPassword}` },
      });
      assert.equal(delStoryRes.statusCode, 200);

      const remaining = memoryRepo.listMemories("group-400");
      assert.equal(remaining.length, 0);

      await app.close();
    } finally {
      closeDatabase(db);
    }
  });

  it("serves static SPA assets at /admin", async () => {
    const app = buildServer({
      config: mockConfig(),
      log: createLogger(),
      zalo: fakeZalo(),
    });

    // 1. GET /admin redirects to /admin/
    const redirectRes = await app.inject({
      method: "GET",
      url: "/admin",
    });
    assert.equal(redirectRes.statusCode, 302);
    assert.equal(redirectRes.headers.location, "/admin/");

    // 2. GET /admin/ serves index.html
    const indexRes = await app.inject({
      method: "GET",
      url: "/admin/",
    });
    assert.equal(indexRes.statusCode, 200);
    assert.match(indexRes.body, /46-Bot Control Center/);

    // 3. Fallback for client routing e.g. /admin/channels/group-123
    const routeRes = await app.inject({
      method: "GET",
      url: "/admin/channels/group-123",
    });
    assert.equal(routeRes.statusCode, 200);
    assert.match(routeRes.body, /46-Bot Control Center/);

    await app.close();
  });
});
