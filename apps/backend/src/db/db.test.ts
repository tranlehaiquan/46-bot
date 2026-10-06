import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "./connection.js";
import { migrate } from "./migrations.js";
import { createSeenRepository } from "./seen-repo.js";
import { createMessageRepository } from "./message-repo.js";

describe("SQLite database layer", () => {
  it("initializes in-memory database with migrations and handles seen messages", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const seenRepo = createSeenRepository(db);

      assert.equal(await seenRepo.hasSeen("msg-1"), false);
      assert.equal(await seenRepo.markSeen("msg-1"), true);
      assert.equal(await seenRepo.hasSeen("msg-1"), true);

      // Duplicate insert should not fail and should return false
      assert.equal(await seenRepo.markSeen("msg-1"), false);
    } finally {
      closeDatabase(db);
    }
  });

  it("stores and retrieves recent messages in chronological order", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const messageRepo = createMessageRepository(db);

      // Insert 25 messages
      for (let i = 1; i <= 25; i++) {
        await messageRepo.insert({
          chatId: "chat-123",
          senderId: `user-${i}`,
          senderName: `User ${i}`,
          role: i % 2 === 0 ? "assistant" : "user",
          content: `Message ${i}`,
          ts: 1000 + i,
        });
      }

      // Default limit 20
      const recent = await messageRepo.getRecent("chat-123", 20);
      assert.equal(recent.length, 20);
      assert.equal(recent[0].content, "Message 6");
      assert.equal(recent[19].content, "Message 25");

      // Verify fields
      assert.equal(recent[19].chatId, "chat-123");
      assert.equal(recent[19].role, "user");
      assert.equal(recent[19].senderName, "User 25");

      // Other chat is empty
      const other = await messageRepo.getRecent("chat-456");
      assert.equal(other.length, 0);
    } finally {
      closeDatabase(db);
    }
  });

  it("creates memories and memory_book tables idempotently", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      await migrate(db); // Idempotency check

      const res = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('memories', 'memory_book', 'channels')"
      );
      assert.equal(res.rows.length, 3);
    } finally {
      closeDatabase(db);
    }
  });

  it("migrates scheduled_lookups and scheduled_lookup_runs, accepting lookups and rejecting duplicate runs for same lookup and fire_date", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);

      const now = Date.now();
      const info = await db.execute({
        sql: `INSERT INTO scheduled_lookups (chat_id, instruction, recurrence, hour, minute, weekday, day_of_month, active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: ["chat-1", "Báo thời tiết TP.HCM", "daily", 7, 0, null, null, 1, "user-1", now, now],
      });
      const lookupId = Number(info.lastInsertRowid);
      assert.ok(lookupId > 0);

      await db.execute({
        sql: `INSERT INTO scheduled_lookup_runs (lookup_id, fire_date, status, attempt_count, last_error, sent_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
        args: [lookupId, "2026-10-05", "running", 1, null, null],
      });

      await assert.rejects(async () => {
        await db.execute({
          sql: `INSERT INTO scheduled_lookup_runs (lookup_id, fire_date, status, attempt_count, last_error, sent_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
          args: [lookupId, "2026-10-05", "running", 1, null, null],
        });
      }, /UNIQUE constraint failed/);

      // Different fire_date succeeds
      await db.execute({
        sql: `INSERT INTO scheduled_lookup_runs (lookup_id, fire_date, status, attempt_count, last_error, sent_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
        args: [lookupId, "2026-10-06", "running", 1, null, null],
      });
    } finally {
      closeDatabase(db);
    }
  });
});
