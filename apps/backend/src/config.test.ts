import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigError, loadConfig } from "./config.js";

const token = "bot-token-value";
const secret = "webhook-secret-value";

function validEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    ZALO_BOT_TOKEN: token,
    FAMILY_CHAT_ID: "",
    WEBHOOK_URL: "https://family.example/webhooks/zalo",
    WEBHOOK_SECRET: secret,
    MODE: "webhook",
    DEEPSEEK_API_KEY: "test-deepseek-key",
    ...overrides,
  };
}

describe("loadConfig", () => {
  it("names WEBHOOK_URL when it is missing", () => {
    const env = validEnv();
    delete env.WEBHOOK_URL;
    assert.throws(
      () => loadConfig(env),
      (error: unknown) => {
        assert.ok(error instanceof ConfigError);
        assert.ok(error.variables.includes("WEBHOOK_URL"));
        assert.match(error.message, /WEBHOOK_URL/);
        assert.equal(error.message.includes(token), false);
        assert.equal(error.message.includes(secret), false);
        return true;
      },
    );
  });

  it("names LLM_API_KEY when neither Gemini nor DeepSeek key is provided", () => {
    const env = validEnv();
    delete env.DEEPSEEK_API_KEY;
    delete env.GEMINI_API_KEY;
    assert.throws(
      () => loadConfig(env),
      (error: unknown) => {
        assert.ok(error instanceof ConfigError);
        assert.ok(error.variables.includes("LLM_API_KEY"));
        return true;
      },
    );
  });

  it("configures Gemini provider when GEMINI_API_KEY is provided", () => {
    const env = validEnv({
      GEMINI_API_KEY: "test-gemini-key",
      DEEPSEEK_API_KEY: undefined,
    });
    delete env.DEEPSEEK_API_KEY;
    const config = loadConfig(env);
    assert.equal(config.llmProvider, "gemini");
    assert.equal(config.llmApiKey, "test-gemini-key");
    assert.equal(config.llmModel, "gemini-3.8-flash");
  });

  it("accepts custom GEMINI_MODEL", () => {
    const config = loadConfig({
      ...validEnv(),
      DEEPSEEK_API_KEY: undefined,
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: "gemini-2.5-flash",
    });
    assert.equal(config.llmProvider, "gemini");
    assert.equal(config.llmModel, "gemini-2.5-flash");
  });

  it("defaults DEEPSEEK_MODEL and DB_PATH when unspecified", () => {
    const config = loadConfig(validEnv());
    assert.equal(config.deepseekModel, "deepseek-chat");
    assert.equal(config.dbPath, "/data/family.db");
    assert.equal(config.llmProvider, "deepseek");
    assert.equal(config.llmApiKey, "test-deepseek-key");
  });

  it("accepts custom DEEPSEEK_MODEL and DB_PATH", () => {
    const config = loadConfig(
      validEnv({
        DEEPSEEK_MODEL: "deepseek-reasoner",
        DB_PATH: "./test.db",
      }),
    );
    assert.equal(config.deepseekModel, "deepseek-reasoner");
    assert.equal(config.dbPath, "./test.db");
  });

  it("defaults ADMIN_PASSWORD to admin123 when unspecified, and accepts custom value", () => {
    const defaultConfig = loadConfig(validEnv());
    assert.equal(defaultConfig.adminPassword, "admin123");

    const customConfig = loadConfig(validEnv({ ADMIN_PASSWORD: "secret-admin-pass" }));
    assert.equal(customConfig.adminPassword, "secret-admin-pass");
  });

  it("refuses MODE=polling", () => {
    assert.throws(
      () => loadConfig(validEnv({ MODE: "polling" })),
      (error: unknown) => {
        assert.ok(error instanceof ConfigError);
        assert.ok(error.variables.includes("MODE"));
        assert.match(error.message, /MODE/);
        assert.equal(error.message.includes(token), false);
        assert.equal(error.message.includes(secret), false);
        return true;
      },
    );
  });

  it("accepts an empty FAMILY_CHAT_ID", () => {
    const config = loadConfig(validEnv({ FAMILY_CHAT_ID: "" }));
    assert.equal(config.familyChatId, "");
    assert.deepEqual(config.familyChatIds, []);
    assert.equal(config.mode, "webhook");
    assert.equal(config.port, 3000);
  });

  it("accepts a missing FAMILY_CHAT_ID", () => {
    const env = validEnv();
    delete env.FAMILY_CHAT_ID;
    const config = loadConfig(env);
    assert.equal(config.familyChatId, "");
    assert.deepEqual(config.familyChatIds, []);
  });

  it("parses comma-separated FAMILY_CHAT_IDS", () => {
    const config = loadConfig(
      validEnv({
        FAMILY_CHAT_IDS: "group-1, group-2 ,group-3",
      }),
    );
    assert.equal(config.familyChatId, "group-1");
    assert.deepEqual(config.familyChatIds, ["group-1", "group-2", "group-3"]);
  });

  it("falls back to FAMILY_CHAT_ID when FAMILY_CHAT_IDS is not provided", () => {
    const config = loadConfig(
      validEnv({
        FAMILY_CHAT_ID: "group-fallback",
      }),
    );
    assert.equal(config.familyChatId, "group-fallback");
    assert.deepEqual(config.familyChatIds, ["group-fallback"]);
  });

  it("rejects a secret shorter than 8 characters without echoing it", () => {
    const shortSecret = "short";
    assert.throws(
      () => loadConfig(validEnv({ WEBHOOK_SECRET: shortSecret })),
      (error: unknown) => {
        assert.ok(error instanceof ConfigError);
        assert.ok(error.variables.includes("WEBHOOK_SECRET"));
        assert.match(error.message, /WEBHOOK_SECRET/);
        assert.equal(error.message.includes(shortSecret), false);
        assert.equal(error.message.includes(token), false);
        return true;
      },
    );
  });

  it("rejects a secret longer than 256 characters without echoing it", () => {
    const longSecret = "s".repeat(257);
    assert.throws(
      () => loadConfig(validEnv({ WEBHOOK_SECRET: longSecret })),
      (error: unknown) => {
        assert.ok(error instanceof ConfigError);
        assert.equal(error.message.includes(longSecret), false);
        assert.equal(error.message.includes(token), false);
        return true;
      },
    );
  });

  it("loads optional REDIS_URL and defaults SCHEDULER_CONCURRENCY to 5", () => {
    const config = loadConfig(validEnv());
    assert.equal(config.redisUrl, undefined);
    assert.equal(config.schedulerConcurrency, 5);

    const customConfig = loadConfig(
      validEnv({
        REDIS_URL: "redis://127.0.0.1:6379",
        SCHEDULER_CONCURRENCY: "10",
      }),
    );
    assert.equal(customConfig.redisUrl, "redis://127.0.0.1:6379");
    assert.equal(customConfig.schedulerConcurrency, 10);
  });

  it("loads optional TURSO_DATABASE_URL and TURSO_AUTH_TOKEN", () => {
    const config = loadConfig(validEnv());
    assert.equal(config.tursoDatabaseUrl, undefined);
    assert.equal(config.tursoAuthToken, undefined);

    const tursoConfig = loadConfig(
      validEnv({
        TURSO_DATABASE_URL: "libsql://family-bot.turso.io",
        TURSO_AUTH_TOKEN: "jwt-token-xyz",
      }),
    );
    assert.equal(tursoConfig.tursoDatabaseUrl, "libsql://family-bot.turso.io");
    assert.equal(tursoConfig.tursoAuthToken, "jwt-token-xyz");
  });
});

