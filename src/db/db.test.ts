import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "./connection.js";
import { migrate } from "./migrations.js";
import { createSeenRepository } from "./seen-repo.js";
import { createMessageRepository } from "./message-repo.js";

describe("SQLite database layer", () => {
  it("initializes in-memory database with migrations and handles seen messages", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const seenRepo = createSeenRepository(db);

      assert.equal(seenRepo.hasSeen("msg-1"), false);
      assert.equal(seenRepo.markSeen("msg-1"), true);
      assert.equal(seenRepo.hasSeen("msg-1"), true);

      // Duplicate insert should not fail and should return false
      assert.equal(seenRepo.markSeen("msg-1"), false);
    } finally {
      closeDatabase(db);
    }
  });

  it("stores and retrieves recent messages in chronological order", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const messageRepo = createMessageRepository(db);

      // Insert 25 messages
      for (let i = 1; i <= 25; i++) {
        messageRepo.insert({
          chatId: "chat-123",
          senderId: `user-${i}`,
          senderName: `User ${i}`,
          role: i % 2 === 0 ? "assistant" : "user",
          content: `Message ${i}`,
          ts: 1000 + i,
        });
      }

      // Default limit 20
      const recent = messageRepo.getRecent("chat-123", 20);
      assert.equal(recent.length, 20);
      assert.equal(recent[0].content, "Message 6");
      assert.equal(recent[19].content, "Message 25");

      // Verify fields
      assert.equal(recent[19].chatId, "chat-123");
      assert.equal(recent[19].role, "user");
      assert.equal(recent[19].senderName, "User 25");

      // Other chat is empty
      const other = messageRepo.getRecent("chat-456");
      assert.equal(other.length, 0);
    } finally {
      closeDatabase(db);
    }
  });

  it("creates memories and memory_book tables idempotently", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      migrate(db); // Idempotency check

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('memories', 'memory_book', 'channels')")
        .all() as Array<{ name: string }>;
      assert.equal(tables.length, 3);
    } finally {
      closeDatabase(db);
    }
  });
});
