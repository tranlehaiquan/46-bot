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
    deepseekModel: "deepseek-chat",
    tavilyApiKey: "tvly-default-key-123456",
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

      // 2. Override with DB settings
      await repo.setMany({
        llm_provider: "deepseek",
        deepseek_api_key: "sk-my-deepseek-key-9999",
        deepseek_model: "deepseek-reasoner",
        tavily_api_key: "tvly-custom-key-8888",
      });

      const res2 = await resolveEffectiveSettings(repo, config);
      assert.equal(res2.effective.llmProvider, "deepseek");
      assert.equal(res2.effective.deepseekApiKey, "sk-my-deepseek-key-9999");
      assert.equal(res2.effective.deepseekModel, "deepseek-reasoner");
      assert.equal(res2.effective.tavilyApiKey, "tvly-custom-key-8888");

      const masked2 = toMaskedSettings(res2.effective, res2.dbEntries, config);
      assert.equal(masked2.llmProvider, "deepseek");
      assert.equal(masked2.deepseekApiKeySource, "db");
      assert.equal(masked2.deepseekModel, "deepseek-reasoner");
      assert.equal(masked2.tavilyApiKeySource, "db");
    } finally {
      closeDatabase(db);
    }
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
