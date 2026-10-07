import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "../config.js";
import { closeDatabase, openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrations.js";
import { createWordChainRepository } from "../db/repositories/word-chain.js";
import { handleDelivery } from "../delivery.js";
import { createLogger } from "../logger.js";
import type { ZaloClient } from "../zalo-client.js";
import { WordChainDictionary } from "./dictionary.js";
import { WordChainService } from "./service.js";
import { createWordChainTools } from "../tools/word-chain.js";

function makeConfig(chatId: string) {
  return loadConfig({
    ZALO_BOT_TOKEN: "mock-token",
    FAMILY_CHAT_ID: chatId,
    WEBHOOK_URL: "https://example.com/webhooks/zalo",
    WEBHOOK_SECRET: "mock-secret",
    MODE: "webhook",
    DEEPSEEK_API_KEY: "mock-deepseek-key",
  });
}

function makePayload(chatId: string, text: string, messageId: string, senderId = "user-1", senderName = "Alice") {
  const obj = {
    event_name: "message.text.received",
    message: {
      from: { id: senderId, display_name: senderName, is_bot: false },
      chat: { id: chatId, chat_type: "GROUP" },
      text,
      message_id: messageId,
      timestamp: Date.now(),
    },
  };
  return Buffer.from(JSON.stringify(obj), "utf8");
}

describe("Word Chain Delivery Pipeline & Fast-path Commands", () => {
  it("handles !noichu, turns, !bxh, and !dungnoichu via fast-path", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createWordChainRepository(db);
      const customDict = new WordChainDictionary([
        "học sinh",
        "sinh viên",
        "viên chức",
        "chức vụ",
      ]);
      const service = new WordChainService({
        repo,
        dictionary: customDict,
      });

      const sentMessages: Array<{ chatId: string; text: string }> = [];
      const zalo: ZaloClient = {
        async sendMessage(chatId, text) {
          sentMessages.push({ chatId, text });
          return { message_id: "m-1" };
        },
      };
      const log = createLogger();
      const config = makeConfig("chat-wc");

      // 1. Send !noichu học sinh
      await handleDelivery({
        payload: makePayload("chat-wc", "!noichu học sinh", "msg-1"),
        config,
        log,
        zalo,
        wordChainRepo: repo,
        wordChainService: service,
      });

      assert.equal(sentMessages.length, 1);
      assert.ok(sentMessages[0].text.includes("Bắt đầu trò chơi Nối Chữ"));

      // Active game exists
      const active = await service.getActiveGame("chat-wc");
      assert.ok(active);
      assert.equal(active.currentWord, "học sinh");

      // 2. Play turn "sinh viên"
      await handleDelivery({
        payload: makePayload("chat-wc", "sinh viên", "msg-2", "user-1", "Alice"),
        config,
        log,
        zalo,
        wordChainRepo: repo,
        wordChainService: service,
      });

      assert.equal(sentMessages.length, 2);
      assert.ok(sentMessages[1].text.includes("Alice"));
      assert.ok(sentMessages[1].text.includes("sinh viên"));
      assert.ok(sentMessages[1].text.includes("viên"));

      // 3. Play turn "viên chức" by Bob
      await handleDelivery({
        payload: makePayload("chat-wc", "viên chức", "msg-3", "user-2", "Bob"),
        config,
        log,
        zalo,
        wordChainRepo: repo,
        wordChainService: service,
      });

      assert.equal(sentMessages.length, 3);
      assert.ok(sentMessages[2].text.includes("Bob"));
      assert.ok(sentMessages[2].text.includes("viên chức"));

      // 4. Query !bxh
      await handleDelivery({
        payload: makePayload("chat-wc", "!bxh", "msg-4"),
        config,
        log,
        zalo,
        wordChainRepo: repo,
        wordChainService: service,
      });

      assert.equal(sentMessages.length, 4);
      assert.ok(sentMessages[3].text.includes("BẢNG XẾP HẠNG"));
      assert.ok(sentMessages[3].text.includes("Alice"));
      assert.ok(sentMessages[3].text.includes("Bob"));

      // 5. Query !noichu stats
      await handleDelivery({
        payload: makePayload("chat-wc", "!noichu stats", "msg-5", "user-1", "Alice"),
        config,
        log,
        zalo,
        wordChainRepo: repo,
        wordChainService: service,
      });

      assert.equal(sentMessages.length, 5);
      assert.ok(sentMessages[4].text.includes("Thống kê Nối Chữ của Alice"));

      // 6. Stop game with !dungnoichu
      await handleDelivery({
        payload: makePayload("chat-wc", "!dungnoichu", "msg-6"),
        config,
        log,
        zalo,
        wordChainRepo: repo,
        wordChainService: service,
      });

      assert.equal(sentMessages.length, 6);
      assert.ok(sentMessages[5].text.includes("Đã dừng trò chơi nối chữ"));
      assert.equal(await service.getActiveGame("chat-wc"), undefined);

      service.dispose();
    } finally {
      closeDatabase(db);
    }
  });

  it("executes word chain LLM tools correctly", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createWordChainRepository(db);
      const customDict = new WordChainDictionary(["học sinh", "sinh viên"]);
      const service = new WordChainService({
        repo,
        dictionary: customDict,
      });

      const tools = createWordChainTools(service, repo, {
        chatId: "chat-tools",
        senderId: "user-1",
        senderName: "Alice",
      });

      // 1. word_chain_start
      const startRes = await (tools.word_chain_start as any).execute({ starterWord: "học sinh" });
      assert.equal(startRes.success, true);
      assert.equal(startRes.starterWord, "học sinh");

      // 2. word_chain_leaderboard
      const lbRes = await (tools.word_chain_leaderboard as any).execute({ isGlobal: false });
      assert.equal(lbRes.success, true);
      assert.ok(lbRes.message);

      // 3. word_chain_stats
      const statsRes = await (tools.word_chain_stats as any).execute({});
      assert.equal(statsRes.success, true);

      // 4. word_chain_stop
      const stopRes = await (tools.word_chain_stop as any).execute({});
      assert.equal(stopRes.success, true);
      assert.ok(stopRes.message.includes("dừng"));

      service.dispose();
    } finally {
      closeDatabase(db);
    }
  });
});
