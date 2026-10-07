import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "../connection.js";
import { migrate } from "../migrations.js";
import { createWordChainRepository } from "./word-chain.js";

describe("WordChainRepository", () => {
  it("creates, retrieves, updates, and ends game sessions", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createWordChainRepository(db);

      // Initially no active session
      assert.equal(await repo.getActiveSession("chat-1"), undefined);

      // Create session
      const session = await repo.createSession("chat-1", "học sinh");
      assert.equal(session.chatId, "chat-1");
      assert.equal(session.status, "active");
      assert.equal(session.currentWord, "học sinh");
      assert.equal(session.totalWords, 0);

      // Verify active session retrieved
      const active = await repo.getActiveSession("chat-1");
      assert.ok(active);
      assert.equal(active.id, session.id);

      // Update session word
      await repo.updateSessionWord(session.id, "sinh viên", 1);
      const updated = await repo.getActiveSession("chat-1");
      assert.equal(updated?.currentWord, "sinh viên");
      assert.equal(updated?.totalWords, 1);

      // Record word history
      await repo.recordWordHistory({
        sessionId: session.id,
        chatId: "chat-1",
        word: "sinh viên",
        playerId: "user-1",
        playerName: "Alice",
        turnIndex: 1,
        points: 2,
      });

      const words = await repo.getSessionWords(session.id);
      assert.deepEqual(words, ["sinh viên"]);

      // End session
      await repo.endSession(session.id, "finished");
      assert.equal(await repo.getActiveSession("chat-1"), undefined);

      const ended = await repo.getSessionById(session.id);
      assert.equal(ended?.status, "finished");
      assert.ok(ended?.endedAt);
    } finally {
      closeDatabase(db);
    }
  });

  it("updates player stats and computes leaderboard correctly", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createWordChainRepository(db);

      // Add stats for Alice
      await repo.updatePlayerStats({
        chatId: "chat-1",
        playerId: "user-1",
        playerName: "Alice",
        pointsAdded: 10,
        wordsAdded: 5,
        currentStreak: 3,
        wonGame: true,
      });

      // Add stats for Bob
      await repo.updatePlayerStats({
        chatId: "chat-1",
        playerId: "user-2",
        playerName: "Bob",
        pointsAdded: 25,
        wordsAdded: 10,
        currentStreak: 6,
        wonGame: true,
      });

      // Add stats for Charlie in chat-2
      await repo.updatePlayerStats({
        chatId: "chat-2",
        playerId: "user-3",
        playerName: "Charlie",
        pointsAdded: 15,
        wordsAdded: 7,
        currentStreak: 4,
      });

      // Check personal stats
      const alice = await repo.getPlayerStats("chat-1", "user-1");
      assert.equal(alice?.playerName, "Alice");
      assert.equal(alice?.totalScore, 10);
      assert.equal(alice?.wordsChained, 5);
      assert.equal(alice?.highestStreak, 3);
      assert.equal(alice?.gamesWon, 1);

      // Update Alice with additional turn
      await repo.updatePlayerStats({
        chatId: "chat-1",
        playerId: "user-1",
        playerName: "Alice",
        pointsAdded: 5,
        wordsAdded: 2,
        currentStreak: 5,
      });
      const aliceUpdated = await repo.getPlayerStats("chat-1", "user-1");
      assert.equal(aliceUpdated?.totalScore, 15);
      assert.equal(aliceUpdated?.highestStreak, 5);

      // Channel leaderboard for chat-1
      const lbChat1 = await repo.getLeaderboard("chat-1");
      assert.equal(lbChat1.length, 2);
      assert.equal(lbChat1[0].playerName, "Bob"); // 25 > 15
      assert.equal(lbChat1[0].rank, 1);
      assert.equal(lbChat1[1].playerName, "Alice");
      assert.equal(lbChat1[1].rank, 2);

      // Global leaderboard (Bob 25, Alice 15 with streak 5, Charlie 15 with streak 4)
      const globalLb = await repo.getLeaderboard();
      assert.equal(globalLb.length, 3);
      assert.equal(globalLb[0].playerName, "Bob"); // 25
      assert.equal(globalLb[1].playerName, "Alice"); // 15, streak 5
      assert.equal(globalLb[2].playerName, "Charlie"); // 15, streak 4
    } finally {
      closeDatabase(db);
    }
  });
});
