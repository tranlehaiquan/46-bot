import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase, closeDatabase } from "../connection.js";
import { migrate } from "../migrations.js";
import { createMemoryRepository } from "./memory.js";

describe("MemoryRepository", () => {
  it("stores and deduplicates facts for the same subject", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createMemoryRepository(db);

      // Store initial fact
      const m1 = repo.upsertMemory("chat-1", "Bé Na", "Học lớp 3", "user-1");
      assert.equal(m1.subject, "Bé Na");
      assert.equal(m1.fact, "Học lớp 3");

      // Verify listed
      let list = repo.listMemories("chat-1");
      assert.equal(list.length, 1);
      assert.equal(list[0].fact, "Học lớp 3");

      // Update fact with different case for subject ("bé na")
      const m2 = repo.upsertMemory("chat-1", "bé na", "Năm nay lên lớp 4 rồi", "user-2");
      assert.equal(m2.id, m1.id);
      assert.equal(m2.fact, "Năm nay lên lớp 4 rồi");

      // List should still have 1 entry with updated fact
      list = repo.listMemories("chat-1");
      assert.equal(list.length, 1);
      assert.equal(list[0].id, m1.id);
      assert.equal(list[0].fact, "Năm nay lên lớp 4 rồi");
    } finally {
      closeDatabase(db);
    }
  });

  it("isolates memories between different chats", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createMemoryRepository(db);

      repo.upsertMemory("chat-1", "Bố", "Thích uống cà phê đen", "user-1");
      repo.upsertMemory("chat-2", "Bố", "Thích uống trà xanh", "user-2");

      const chat1Memories = repo.listMemories("chat-1");
      const chat2Memories = repo.listMemories("chat-2");

      assert.equal(chat1Memories.length, 1);
      assert.equal(chat1Memories[0].fact, "Thích uống cà phê đen");

      assert.equal(chat2Memories.length, 1);
      assert.equal(chat2Memories[0].fact, "Thích uống trà xanh");
    } finally {
      closeDatabase(db);
    }
  });

  it("deletes a memory by subject", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createMemoryRepository(db);

      repo.upsertMemory("chat-1", "Mẹ", "Dị ứng hành tây", "user-1");
      assert.equal(repo.listMemories("chat-1").length, 1);

      const deleted = repo.deleteMemory("chat-1", "mẹ");
      assert.equal(deleted, true);
      assert.equal(repo.listMemories("chat-1").length, 0);

      const deletedAgain = repo.deleteMemory("chat-1", "mẹ");
      assert.equal(deletedAgain, false);
    } finally {
      closeDatabase(db);
    }
  });

  it("adds and searches stories in Memory Book", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createMemoryRepository(db);

      const s1 = repo.addStory({
        chatId: "chat-1",
        title: "Chuyến đi Đà Lạt đầu tiên",
        story: "Cả nhà đi ngắm hoa cẩm tú cầu và uống sữa đậu nành nóng đêm ở chợ Đà Lạt.",
        people: "Bố, Mẹ, Bé Na",
        happenedOn: "2024-06-15",
        createdBy: "user-1",
      });

      const s2 = repo.addStory({
        chatId: "chat-1",
        title: "Bé Na học bơi",
        story: "Hôm nay Na đã bơi được 25m không cần phao, bố mẹ rất tự hào.",
        people: "Bé Na, Bố",
        happenedOn: "2024-08-01",
        createdBy: "user-1",
      });

      // Search by keyword in title
      const dalatResults = repo.searchStories("chat-1", "Đà Lạt");
      assert.equal(dalatResults.length, 1);
      assert.equal(dalatResults[0].id, s1.id);
      assert.equal(dalatResults[0].title, "Chuyến đi Đà Lạt đầu tiên");

      // Search by keyword in story text
      const swimResults = repo.searchStories("chat-1", "phao");
      assert.equal(swimResults.length, 1);
      assert.equal(swimResults[0].id, s2.id);

      // Search by people
      const naResults = repo.searchStories("chat-1", "Bé Na");
      assert.equal(naResults.length, 2);

      // Search with empty query returns all stories
      const allStories = repo.searchStories("chat-1", "");
      assert.equal(allStories.length, 2);

      // Stories are isolated per chat
      const chat2Stories = repo.searchStories("chat-2", "Đà Lạt");
      assert.equal(chat2Stories.length, 0);
    } finally {
      closeDatabase(db);
    }
  });
});
