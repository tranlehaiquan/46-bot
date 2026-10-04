import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLogger } from "./logger.js";
import { syncWebhook } from "./register.js";
import type { ZaloClient } from "./zalo-client.js";

const secret = "webhook-secret-value";
const desired = "https://family.example/webhooks/zalo";

function client(url: string): ZaloClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async getWebhookInfo() {
      calls.push("getWebhookInfo");
      return { url };
    },
    async setWebhook(webhookUrl, webhookSecret) {
      calls.push(`setWebhook:${webhookUrl}:${webhookSecret}`);
      return { outcome: `webhook.ok ${secret}` };
    },
    async testWebhook() {
      calls.push("testWebhook");
      return { outcome: `webhook.ok ${secret}` };
    },
    async sendMessage() {
      calls.push("sendMessage");
    },
  };
}

describe("syncWebhook", () => {
  it("calls setWebhook when the registered URL differs and omits the secret from logs", async () => {
    const lines: string[] = [];
    const zalo = client("https://old.example/webhooks/zalo");
    await syncWebhook(zalo, desired, secret, createLogger({ write: (line) => lines.push(line), secrets: [secret] }));
    assert.deepEqual(zalo.calls, ["getWebhookInfo", `setWebhook:${desired}:${secret}`]);
    const joined = lines.join("\n");
    assert.match(joined, /setWebhook/);
    assert.match(joined, /webhook\.ok/);
    assert.equal(joined.includes(secret), false);
    assert.equal(joined.includes("testWebhook"), false);
  });

  it("calls testWebhook when the registered URL matches and does not call setWebhook", async () => {
    const lines: string[] = [];
    const zalo = client(desired);
    await syncWebhook(zalo, desired, secret, createLogger({ write: (line) => lines.push(line), secrets: [secret] }));
    assert.deepEqual(zalo.calls, ["getWebhookInfo", "testWebhook"]);
    const joined = lines.join("\n");
    assert.match(joined, /testWebhook/);
    assert.equal(joined.includes(secret), false);
    assert.equal(joined.includes("setWebhook"), false);
  });
});
