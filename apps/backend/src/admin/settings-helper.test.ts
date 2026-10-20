import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase, closeDatabase } from "../db/connection.js";
import { migrate } from "../db/migrations.js";
import { createSettingsRepository } from "../db/repositories/settings.js";
import {
  maskSecret,
  resolveEffectiveSettings,
  toMaskedSettings,
  DynamicLlmClient,
  testCrawl4AiConnection,
} from "./settings-helper.js";
import type { AppConfig } from "../config.js";

function mockConfig(): AppConfig {
  return {
    zaloBotToken: "tok",
    familyChatId: "c1",
    familyChatIds: ["c1"],
    webhookUrl: "https://test.example/webhooks/zalo",
    webhookSecret: "sec123456",
    mode: "webhook",
    port: 3000,
    dbPath: ":memory:",
    botId: "bot1",
    adminPassword: "pass",
    llmProvider: "gemini",
    llmApiKey: "AQ.default-gemini-key-123456",
    llmModel: "gemini-3.8-flash",
    geminiApiKey: "AQ.default-gemini-key-123456",
    geminiModel: "gemini-3.8-flash",
    geminiImageModel: "imagen-3.0-generate-002",
    deepseekModel: "deepseek-chat",
    tavilyApiKey: "tvly-default-key-123456",
    passiveMemoryEnabled: true,
  };
}

describe("Settings Helper", () => {
  it("masks secrets correctly", () => {
    assert.equal(maskSecret(undefined), null);
    assert.equal(maskSecret(""), null);
    assert.equal(maskSecret("short"), "********");
    assert.equal(maskSecret("12345678"), "********");
    assert.equal(maskSecret("AQ.1234567890XYZ"), "AQ.1...0XYZ");
  });

  it("resolves effective settings with fallback to config and tracks source", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createSettingsRepository(db);
      const config = mockConfig();

      // 1. Initial resolution (no DB overrides)
      const res1 = await resolveEffectiveSettings(repo, config);
      assert.equal(res1.effective.llmProvider, "gemini");
      assert.equal(res1.effective.geminiApiKey, "AQ.default-gemini-key-123456");
      assert.equal(res1.effective.geminiModel, "gemini-3.8-flash");
      assert.equal(res1.effective.tavilyApiKey, "tvly-default-key-123456");

      const masked1 = toMaskedSettings(res1.effective, res1.dbEntries, config);
      assert.equal(masked1.geminiApiKeySource, "env");
      assert.equal(masked1.deepseekApiKeySource, "none");
      assert.equal(masked1.tavilyApiKeySource, "env");
      assert.equal(masked1.crawl4aiApiTokenSource, "none");

      // 2. Override with DB settings
      await repo.setMany({
        llm_provider: "deepseek",
        deepseek_api_key: "sk-my-deepseek-key-9999",
        deepseek_model: "deepseek-reasoner",
        tavily_api_key: "tvly-custom-key-8888",
        crawl4ai_api_token: "c4ai-db-token-7777",
      });

      const res2 = await resolveEffectiveSettings(repo, config);
      assert.equal(res2.effective.llmProvider, "deepseek");
      assert.equal(res2.effective.deepseekApiKey, "sk-my-deepseek-key-9999");
      assert.equal(res2.effective.deepseekModel, "deepseek-reasoner");
      assert.equal(res2.effective.tavilyApiKey, "tvly-custom-key-8888");
      assert.equal(res2.effective.crawl4aiApiToken, "c4ai-db-token-7777");

      const masked2 = toMaskedSettings(res2.effective, res2.dbEntries, config);
      assert.equal(masked2.llmProvider, "deepseek");
      assert.equal(masked2.deepseekApiKeySource, "db");
      assert.equal(masked2.deepseekModel, "deepseek-reasoner");
      assert.equal(masked2.tavilyApiKeySource, "db");
      assert.equal(masked2.crawl4aiApiTokenSource, "db");
      assert.equal(masked2.hasCrawl4aiApiToken, true);
      assert.match(masked2.crawl4aiApiTokenMasked!, /c4ai\.\.\.7777/);
    } finally {
      closeDatabase(db);
    }
  });

  it("testCrawl4AiConnection validates token and handles success and errors", async () => {
    // 1. Missing token
    const emptyRes = await testCrawl4AiConnection("");
    assert.equal(emptyRes.success, false);

    // 2. Successful remote response
    const fakeSuccessFetch: typeof fetch = async (input, init) => {
      assert.equal(String(input), "https://api.crawl4ai.com/scrape");
      assert.equal(init?.method, "POST");
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers["Authorization"], "Bearer test-key-123");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    };
    const successRes = await testCrawl4AiConnection("test-key-123", fakeSuccessFetch);
    assert.equal(successRes.success, true);
    assert.match(successRes.message!, /thành công/);

    // 3. Failed remote response
    const fakeFailFetch: typeof fetch = async () => {
      return new Response("Unauthorized", { status: 401 });
    };
    const failRes = await testCrawl4AiConnection("bad-token", fakeFailFetch);
    assert.equal(failRes.success, false);
    assert.match(failRes.error!, /401/);
  });

  it("DynamicLlmClient delegates calls and allows updating client", async () => {
    let callCount = 0;
    const clientA = {
      generateReply: async () => {
        callCount++;
        return "reply-from-A";
      },
    };
    const clientB = {
      generateReply: async () => {
        callCount++;
        return "reply-from-B";
      },
    };

    const dynamic = new DynamicLlmClient(clientA);
    const reply1 = await dynamic.generateReply({
      incomingMessage: { senderId: "u1", senderName: "User", content: "Hi" },
      history: [],
    });
    assert.equal(reply1, "reply-from-A");

    dynamic.setClient(clientB);
    const reply2 = await dynamic.generateReply({
      incomingMessage: { senderId: "u1", senderName: "User", content: "Hi" },
      history: [],
    });
    assert.equal(reply2, "reply-from-B");
    assert.equal(callCount, 2);
  });
});
