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

  it("names DEEPSEEK_API_KEY when it is missing", () => {
    const env = validEnv();
    delete env.DEEPSEEK_API_KEY;
    assert.throws(
      () => loadConfig(env),
      (error: unknown) => {
        assert.ok(error instanceof ConfigError);
        assert.ok(error.variables.includes("DEEPSEEK_API_KEY"));
        assert.match(error.message, /DEEPSEEK_API_KEY/);
        return true;
      },
    );
  });

  it("defaults DEEPSEEK_MODEL and DB_PATH when unspecified", () => {
    const config = loadConfig(validEnv());
    assert.equal(config.deepseekModel, "deepseek-chat");
    assert.equal(config.dbPath, "/data/family.db");
    assert.equal(config.deepseekApiKey, "test-deepseek-key");
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
    assert.equal(config.mode, "webhook");
    assert.equal(config.port, 3000);
  });

  it("accepts a missing FAMILY_CHAT_ID", () => {
    const env = validEnv();
    delete env.FAMILY_CHAT_ID;
    const config = loadConfig(env);
    assert.equal(config.familyChatId, "");
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
});
