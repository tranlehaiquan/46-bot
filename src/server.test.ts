import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "./config.js";
import { CANNED_REPLY } from "./delivery.js";
import { createLogger } from "./logger.js";
import { WorkQueue } from "./queue.js";
import { BODY_LIMIT, buildServer } from "./server.js";
import type { ZaloClient } from "./zalo-client.js";

const token = "bot-token-value";
const secret = "webhook-secret-value";

function configFor(familyChatId: string) {
  return loadConfig({
    ZALO_BOT_TOKEN: token,
    FAMILY_CHAT_ID: familyChatId,
    WEBHOOK_URL: "https://family.example/webhooks/zalo",
    WEBHOOK_SECRET: secret,
    MODE: "webhook",
  });
}

function envelope(overrides?: {
  eventName?: string;
  chatId?: string;
  chatType?: string;
  senderId?: string;
  senderName?: string;
  isBot?: boolean;
  text?: string;
  messageId?: string;
  extra?: Record<string, unknown>;
}) {
  return {
    ok: true,
    result: {
      event_name: overrides?.eventName ?? "message.text.received",
      message: {
        from: {
          id: overrides?.senderId ?? "user-1",
          display_name: overrides?.senderName ?? "Lan",
          is_bot: overrides?.isBot ?? false,
        },
        chat: {
          id: overrides?.chatId ?? "group-1",
          chat_type: overrides?.chatType ?? "GROUP",
        },
        text: overrides?.text ?? "xin chao",
        message_id: overrides?.messageId ?? "msg-1",
        date: 1750316131602,
        photo: "https://cdn.example/photo.jpg",
        ...overrides?.extra,
      },
    },
  };
}

function testApp(familyChatId: string, lines?: string[]) {
  const zalo = fakeZalo();
  const queue = new WorkQueue();
  const app = buildServer({
    config: configFor(familyChatId),
    log: createLogger({
      write: (line) => lines?.push(line),
      secrets: [token, secret],
    }),
    zalo,
    queue,
  });
  return { app, zalo, queue };
}

function fakeZalo(): ZaloClient & { sends: Array<{ chatId: string; text: string }> } {
  const sends: Array<{ chatId: string; text: string }> = [];
  return {
    sends,
    async getWebhookInfo() {
      return { url: "" };
    },
    async setWebhook() {
      return { outcome: "webhook.ok" };
    },
    async testWebhook() {
      return { outcome: "webhook.ok" };
    },
    async sendMessage(chatId, text) {
      sends.push({ chatId, text });
    },
  };
}

async function post(
  app: ReturnType<typeof buildServer>,
  body: string | Buffer,
  headers: Record<string, string> = {},
) {
  return app.inject({
    method: "POST",
    url: "/webhooks/zalo",
    headers: {
      "content-type": "application/json",
      "x-bot-api-secret-token": secret,
      ...headers,
    },
    payload: body,
  });
}

describe("webhook http", () => {
  it("returns 200 for GET /health and 404 for other paths", async () => {
    const { app } = testApp("");
    const health = await app.inject({ method: "GET", url: "/health" });
    const missing = await app.inject({ method: "GET", url: "/status" });
    const wrongMethod = await app.inject({ method: "POST", url: "/health" });
    assert.equal(health.statusCode, 200);
    assert.equal(missing.statusCode, 404);
    assert.equal(wrongMethod.statusCode, 404);
    await app.close();
  });

  it("rejects an oversized body", async () => {
    const { app } = testApp("");
    const response = await post(app, "x".repeat(BODY_LIMIT + 1));
    assert.notEqual(response.statusCode, 200);
    assert.equal(response.statusCode, 413);
    await app.close();
  });

  it("rejects a wrong or missing secret without sending", async () => {
    const lines: string[] = [];
    const { app, zalo, queue } = testApp("", lines);
    const wrong = await post(app, JSON.stringify(envelope({ text: "secret-body" })), {
      "x-bot-api-secret-token": "not-the-secret",
    });
    const missing = await app.inject({
      method: "POST",
      url: "/webhooks/zalo",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(envelope()),
    });
    await queue.drain();
    assert.equal(wrong.statusCode, 401);
    assert.equal(missing.statusCode, 401);
    assert.equal(zalo.sends.length, 0);
    assert.equal(lines.length, 0);
    await app.close();
  });

  it("acknowledges a non-JSON body and a body with no message id", async () => {
    const { app, zalo, queue } = testApp("");
    const text = await post(app, "hello", { "content-type": "text/plain" });
    const probe = await post(app, JSON.stringify({ ok: true, result: { event_name: "probe" } }));
    const empty = await post(app, "");
    await queue.drain();
    assert.equal(text.statusCode, 200);
    assert.deepEqual(text.json(), { message: "Success" });
    assert.equal(probe.statusCode, 200);
    assert.deepEqual(probe.json(), { message: "Success" });
    assert.equal(empty.statusCode, 200);
    assert.equal(zalo.sends.length, 0);
    await app.close();
  });
});

describe("group discovery", () => {
  it("logs a group and a private chat during discovery and does not send", async () => {
    const lines: string[] = [];
    const { app, zalo, queue } = testApp("", lines);
    const group = envelope({
      chatId: "group-9",
      chatType: "GROUP",
      text: `hello ${secret}`,
      extra: { leaked: token },
    });
    const privateChat = envelope({
      chatId: "user-9",
      chatType: "PRIVATE",
      messageId: "msg-private",
      senderName: "Minh",
    });
    assert.equal((await post(app, JSON.stringify(group))).statusCode, 200);
    assert.equal((await post(app, JSON.stringify(privateChat))).statusCode, 200);
    await queue.drain();
    const joined = lines.join("\n");
    assert.match(joined, /group-9/);
    assert.match(joined, /GROUP/);
    assert.match(joined, /PRIVATE/);
    assert.match(joined, /https:\/\/cdn\.example\/photo\.jpg/);
    assert.equal(joined.includes(secret), false);
    assert.equal(joined.includes(token), false);
    assert.equal(zalo.sends.length, 0);
    await app.close();
  });

  it("sends the canned reply only to the matching group chat id", async () => {
    const lines: string[] = [];
    const { app, zalo, queue } = testApp("group-1", lines);
    const text = "UNIQUE_FAMILY_TEXT";
    const response = await post(app, JSON.stringify(envelope({ text, senderId: "user-1" })));
    await queue.drain();
    assert.equal(response.statusCode, 200);
    assert.deepEqual(zalo.sends, [{ chatId: "group-1", text: CANNED_REPLY }]);
    assert.equal(zalo.sends[0]?.chatId === "user-1", false);
    const joined = lines.join("\n");
    assert.match(joined, /group-1/);
    assert.match(joined, /GROUP/);
    assert.match(joined, /msg-1/);
    assert.equal(joined.includes(text), false);
    await app.close();
  });

  it("stays silent for a bot sender, another chat, a private chat, and an image", async () => {
    const { app, zalo, queue } = testApp("group-1");
    await post(app, JSON.stringify(envelope({ isBot: true, messageId: "bot-msg" })));
    await post(app, JSON.stringify(envelope({ chatId: "group-2", messageId: "other-group" })));
    await post(app, JSON.stringify(envelope({ chatId: "group-1", chatType: "PRIVATE", messageId: "private-same" })));
    await post(
      app,
      JSON.stringify(envelope({ eventName: "message.image.received", messageId: "image-1", text: "" })),
    );
    await queue.drain();
    assert.equal(zalo.sends.length, 0);
    await app.close();
  });

  it("sends once for a duplicate message id in one process", async () => {
    const { app, zalo, queue } = testApp("group-1");
    const body = JSON.stringify(envelope({ messageId: "same-id" }));
    await post(app, body);
    await post(app, body);
    await queue.drain();
    assert.equal(zalo.sends.length, 1);
    await app.close();
  });

  it("sends again for the same message id after a new process", async () => {
    const body = JSON.stringify(envelope({ messageId: "same-id" }));
    const first = testApp("group-1");
    await post(first.app, body);
    await first.queue.drain();
    await first.app.close();

    const second = testApp("group-1");
    await post(second.app, body);
    await second.queue.drain();
    assert.equal(first.zalo.sends.length, 1);
    assert.equal(second.zalo.sends.length, 1);
    await second.app.close();
  });
});
