import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { createZaloClient } from "./zalo-client.js";

const require = createRequire(import.meta.url);

describe("createZaloClient sendMessage", () => {
  it("forwards parse_mode to bot.sendMessage", async () => {
    const zaloBotPath = require.resolve("zalo-bot-js");
    const originalEntry = require.cache[zaloBotPath];

    const calls: Array<{ chatId: string; text: string; options?: any }> = [];
    class MockBot {
      config: any;
      constructor(config: any) {
        this.config = config;
      }
      async sendMessage(chatId: string, text: string, options?: any) {
        calls.push({ chatId, text, options });
        return { ok: true };
      }
    }

    require.cache[zaloBotPath] = {
      exports: { Bot: MockBot },
    } as any;

    try {
      const client = createZaloClient("test-token");
      await client.sendMessage("chat-1", "**Hello**", { parse_mode: "markdown" });
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0], {
        chatId: "chat-1",
        text: "**Hello**",
        options: { parse_mode: "markdown" },
      });
    } finally {
      if (originalEntry) {
        require.cache[zaloBotPath] = originalEntry;
      } else {
        delete require.cache[zaloBotPath];
      }
    }
  });

  it("retries as plain text when sendMessage with parse_mode fails", async () => {
    const zaloBotPath = require.resolve("zalo-bot-js");
    const originalEntry = require.cache[zaloBotPath];

    const calls: Array<{ chatId: string; text: string; options?: any }> = [];
    class MockBot {
      config: any;
      constructor(config: any) {
        this.config = config;
      }
      async sendMessage(chatId: string, text: string, options?: any) {
        calls.push({ chatId, text, options });
        if (options?.parse_mode) {
          throw new Error("Invalid markdown markup");
        }
        return { ok: true };
      }
    }

    require.cache[zaloBotPath] = {
      exports: { Bot: MockBot },
    } as any;

    try {
      const client = createZaloClient("test-token");
      await client.sendMessage("chat-1", "**Broken markdown", { parse_mode: "markdown" });
      assert.equal(calls.length, 2);
      assert.deepEqual(calls[0], {
        chatId: "chat-1",
        text: "**Broken markdown",
        options: { parse_mode: "markdown" },
      });
      assert.deepEqual(calls[1], {
        chatId: "chat-1",
        text: "**Broken markdown",
        options: undefined,
      });
    } finally {
      if (originalEntry) {
        require.cache[zaloBotPath] = originalEntry;
      } else {
        delete require.cache[zaloBotPath];
      }
    }
  });

  it("rethrows error when plain text sending also fails", async () => {
    const zaloBotPath = require.resolve("zalo-bot-js");
    const originalEntry = require.cache[zaloBotPath];

    class MockBot {
      config: any;
      constructor(config: any) {
        this.config = config;
      }
      async sendMessage() {
        throw new Error("Network down");
      }
    }

    require.cache[zaloBotPath] = {
      exports: { Bot: MockBot },
    } as any;

    try {
      const client = createZaloClient("test-token");
      await assert.rejects(
        () => client.sendMessage("chat-1", "plain text"),
        /Network down/,
      );
    } finally {
      if (originalEntry) {
        require.cache[zaloBotPath] = originalEntry;
      } else {
        delete require.cache[zaloBotPath];
      }
    }
  });

  it("cleans useless dividers and excessive blank lines when parse_mode is markdown", async () => {
    const zaloBotPath = require.resolve("zalo-bot-js");
    const originalEntry = require.cache[zaloBotPath];

    const calls: Array<{ chatId: string; text: string; options?: any }> = [];
    class MockBot {
      config: any;
      constructor(config: any) {
        this.config = config;
      }
      async sendMessage(chatId: string, text: string, options?: any) {
        calls.push({ chatId, text, options });
        return { ok: true };
      }
    }

    require.cache[zaloBotPath] = {
      exports: { Bot: MockBot },
    } as any;

    try {
      const client = createZaloClient("test-token");
      const rawText = "Part 1\n\n\n---\n\n\nPart 2";
      await client.sendMessage("chat-1", rawText, { parse_mode: "markdown" });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].text, "Part 1\n\nPart 2");
    } finally {
      if (originalEntry) {
        require.cache[zaloBotPath] = originalEntry;
      } else {
        delete require.cache[zaloBotPath];
      }
    }
  });
});
