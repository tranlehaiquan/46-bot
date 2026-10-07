import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "../db/connection.js";
import { migrate } from "../db/migrations.js";
import { createWordChainRepository } from "../db/repositories/word-chain.js";
import { WordChainDictionary } from "./dictionary.js";
import { WordChainService } from "./service.js";

describe("WordChainService", () => {
  it("runs a full game session with turns, streaks, and stopping", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createWordChainRepository(db);
      const customDict = new WordChainDictionary([
        "học sinh",
        "sinh viên",
        "viên phấn",
        "phấn đấu",
        "đấu sinh",
        "đấu tranh",
        "tranh giành",
      ]);
      const service = new WordChainService({
        repo,
        dictionary: customDict,
        turnTimeoutMs: 10_000,
      });

      // 1. Start game with starter word "học sinh"
      const startResult = await service.startGame("chat-1", "học sinh");
      assert.equal(startResult.starterWord, "học sinh");
      assert.equal(startResult.alreadyActive, false);
      assert.ok(startResult.message.includes("sinh"));

      // 2. Starting again returns alreadyActive
      const duplicateStart = await service.startGame("chat-1");
      assert.equal(duplicateStart.alreadyActive, true);

      // 3. Play invalid turns:
      // a) Not 2 syllables
      const notTwo = await service.playTurn("chat-1", "p1", "Alice", "học");
      assert.equal(notTwo.status, "not_two_syllables");

      // b) Mismatch chain (starts with 'phấn' instead of 'sinh')
      const mismatch = await service.playTurn("chat-1", "p1", "Alice", "phấn đấu");
      assert.equal(mismatch.status, "invalid_chain");

      // c) Not in dictionary
      const notDict = await service.playTurn("chat-1", "p1", "Alice", "sinh đẻ");
      assert.equal(notDict.status, "not_in_dictionary");

      // 4. Play valid turn 1 by Alice: "sinh viên"
      const turn1 = await service.playTurn("chat-1", "p1", "Alice", "sinh viên");
      assert.equal(turn1.status, "valid");
      assert.equal(turn1.pointsAwarded, 1);
      assert.equal(turn1.playerStreak, 1);
      assert.equal(turn1.nextRequiredSyllable, "viên");

      // 5. Play turn 2 by Alice: "viên phấn" (Streak 2!)
      const turn2 = await service.playTurn("chat-1", "p1", "Alice", "viên phấn");
      assert.equal(turn2.status, "valid");
      assert.equal(turn2.playerStreak, 2);
      assert.equal(turn2.pointsAwarded, 2); // 1 base + 1 streak bonus

      // 6. Play turn 3 by Bob: "phấn đấu"
      const turn3 = await service.playTurn("chat-1", "p2", "Bob", "phấn đấu");
      assert.equal(turn3.status, "valid");
      assert.equal(turn3.playerStreak, 1); // Streak reset for Bob
      assert.equal(turn3.pointsAwarded, 1);

      // 7. Play turn 4: "đấu sinh"
      const turn4 = await service.playTurn("chat-1", "p2", "Bob", "đấu sinh");
      assert.equal(turn4.status, "valid");

      // 8. Now current word is "đấu sinh" (tail: "sinh").
      // Alice tries "sinh viên", which was already played in turn 1!
      const dup = await service.playTurn("chat-1", "p1", "Alice", "sinh viên");
      assert.equal(dup.status, "already_used");

      // 8. Stop game
      const stopResult = await service.stopGame("chat-1");
      assert.ok(stopResult.session);
      assert.ok(stopResult.summary?.includes("Alice"));
      assert.ok(stopResult.summary?.includes("Bob"));

      // 9. Verify leaderboards
      const lb = await repo.getLeaderboard("chat-1");
      assert.equal(lb.length, 2);
      assert.equal(lb[0].playerName, "Alice"); // 3 points
      assert.equal(lb[1].playerName, "Bob"); // 1 point

      const formattedLb = service.formatLeaderboard(lb);
      assert.ok(formattedLb.includes("Alice"));
      assert.ok(formattedLb.includes("Bob"));

      // 10. Verify personal stats
      const aliceStats = await repo.getPlayerStats("chat-1", "p1");
      assert.ok(aliceStats);
      const formattedStats = service.formatPlayerStats(aliceStats);
      assert.ok(formattedStats.includes("3"));

      service.dispose();
    } finally {
      closeDatabase(db);
    }
  });

  it("handles game inactivity timeout properly", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createWordChainRepository(db);
      const customDict = new WordChainDictionary(["học sinh", "sinh viên"]);

      let timeoutNotified = false;
      let notifiedChat = "";

      const service = new WordChainService({
        repo,
        dictionary: customDict,
        turnTimeoutMs: 50, // fast 50ms timeout for test
        onTimeout: async (chatId, _msg) => {
          timeoutNotified = true;
          notifiedChat = chatId;
        },
      });

      await service.startGame("chat-test-timeout", "học sinh");
      assert.ok(await service.getActiveGame("chat-test-timeout"));

      // Wait for timeout to fire
      await new Promise((resolve) => setTimeout(resolve, 80));

      assert.equal(timeoutNotified, true);
      assert.equal(notifiedChat, "chat-test-timeout");
      assert.equal(await service.getActiveGame("chat-test-timeout"), undefined);

      service.dispose();
    } finally {
      closeDatabase(db);
    }
  });
});
