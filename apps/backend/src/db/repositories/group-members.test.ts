import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "../connection.js";
import { migrate } from "../migrations.js";
import { createGroupMemberRepository } from "./group-members.js";

describe("GroupMemberRepository", () => {
  it("records activity, updates last_seen_at and sender_name idempotently", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createGroupMemberRepository(db);

      // Record first activity
      const m1 = await repo.recordActivity("group-1", "user-1", "Nam");
      assert.equal(m1.chatId, "group-1");
      assert.equal(m1.senderId, "user-1");
      assert.equal(m1.senderName, "Nam");
      assert.equal(m1.alias, null);
      assert.ok(m1.createdAt > 0);
      assert.equal(m1.createdAt, m1.lastSeenAt);

      // Record second activity with updated name
      const m2 = await repo.recordActivity("group-1", "user-1", "Nam Nguyen");
      assert.equal(m2.senderName, "Nam Nguyen");
      assert.equal(m2.createdAt, m1.createdAt);
      assert.ok(m2.lastSeenAt >= m1.lastSeenAt);

      // Check member retrieval
      const fetched = await repo.getMember("group-1", "user-1");
      assert.ok(fetched);
      assert.equal(fetched.senderName, "Nam Nguyen");
    } finally {
      closeDatabase(db);
    }
  });

  it("updates alias, relationship, and notes", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createGroupMemberRepository(db);

      await repo.recordActivity("group-1", "user-1", "Nam Nguyen");
      const updated = await repo.updateMember("group-1", "user-1", {
        alias: "Bố",
        relationship: "Cha",
        notes: "Thích uống cà phê sữa",
      });

      assert.ok(updated);
      assert.equal(updated.alias, "Bố");
      assert.equal(updated.relationship, "Cha");
      assert.equal(updated.notes, "Thích uống cà phê sữa");

      // Verify persistent fetch
      const fetched = await repo.getMember("group-1", "user-1");
      assert.equal(fetched?.alias, "Bố");
      assert.equal(fetched?.notes, "Thích uống cà phê sữa");

      // Updating non-existent member returns undefined
      const nonExistent = await repo.updateMember("group-1", "user-999", { alias: "Ai đó" });
      assert.equal(nonExistent, undefined);
    } finally {
      closeDatabase(db);
    }
  });

  it("lists members in descending order of last_seen_at and searches by alias or name", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createGroupMemberRepository(db);

      await repo.recordActivity("group-1", "user-1", "Nam Nguyen");
      await repo.updateMember("group-1", "user-1", { alias: "Bố" });

      await repo.recordActivity("group-1", "user-2", "Mai Le");
      await repo.updateMember("group-1", "user-2", { alias: "Mẹ", relationship: "Mẹ" });

      await repo.recordActivity("group-1", "user-3", "Bé Bông");

      const members = await repo.listMembers("group-1");
      assert.equal(members.length, 3);
      assert.equal(members[0].senderId, "user-3"); // newest active

      // Search by alias
      const searchAlias = await repo.findByAliasOrName("group-1", "Bố");
      assert.equal(searchAlias.length, 1);
      assert.equal(searchAlias[0].senderId, "user-1");

      // Search by partial name
      const searchName = await repo.findByAliasOrName("group-1", "Mai");
      assert.equal(searchName.length, 1);
      assert.equal(searchName[0].senderId, "user-2");

      // Search non-existent
      const searchEmpty = await repo.findByAliasOrName("group-1", "Ông Nội");
      assert.equal(searchEmpty.length, 0);
    } finally {
      closeDatabase(db);
    }
  });
});
