import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "../connection.js";
import { migrate } from "../migrations.js";
import { createChannelRepository } from "./channels.js";

describe("ChannelRepository", () => {
  it("upserts discovery and defaults to pending", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createChannelRepository(db);

      const ch = repo.upsertDiscovery({
        chatId: "group-101",
        name: "Nhóm Bạn Bè",
        chatType: "GROUP",
      });

      assert.equal(ch.chatId, "group-101");
      assert.equal(ch.name, "Nhóm Bạn Bè");
      assert.equal(ch.status, "pending");
      assert.equal(ch.chatType, "GROUP");
      assert.ok(ch.createdAt > 0);
      assert.ok(ch.lastActiveAt >= ch.createdAt);

      // Subsequent discovery updates lastActiveAt and maintains status
      const updated = repo.upsertDiscovery({
        chatId: "group-101",
        name: "Nhóm Bạn Bè",
        chatType: "GROUP",
      });
      assert.equal(updated.status, "pending");
      assert.ok(updated.lastActiveAt >= ch.lastActiveAt);
    } finally {
      closeDatabase(db);
    }
  });

  it("updates channel status and name", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createChannelRepository(db);

      repo.upsertDiscovery({
        chatId: "group-202",
        name: "Old Name",
        chatType: "GROUP",
      });

      assert.equal(repo.updateStatus("group-202", "active"), true);
      assert.equal(repo.getChannel("group-202")?.status, "active");

      assert.equal(repo.updateName("group-202", "New Name"), true);
      assert.equal(repo.getChannel("group-202")?.name, "New Name");

      assert.equal(repo.updateStatus("non-existent", "active"), false);
      assert.equal(repo.updateName("non-existent", "Name"), false);
    } finally {
      closeDatabase(db);
    }
  });

  it("lists channels with optional status filter", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createChannelRepository(db);

      repo.upsertDiscovery({ chatId: "ch-1", name: "Ch 1", chatType: "GROUP" });
      repo.upsertDiscovery({ chatId: "ch-2", name: "Ch 2", chatType: "PRIVATE" });
      repo.updateStatus("ch-1", "active");

      const all = repo.listChannels();
      assert.equal(all.length, 2);

      const active = repo.listChannels("active");
      assert.equal(active.length, 1);
      assert.equal(active[0].chatId, "ch-1");

      const pending = repo.listChannels("pending");
      assert.equal(pending.length, 1);
      assert.equal(pending[0].chatId, "ch-2");

      const disabled = repo.listChannels("disabled");
      assert.equal(disabled.length, 0);
    } finally {
      closeDatabase(db);
    }
  });

  it("seeds channels idempotently with active status", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createChannelRepository(db);

      repo.seedChannels(["seed-1", "seed-2"]);
      assert.equal(repo.getChannel("seed-1")?.status, "active");
      assert.equal(repo.getChannel("seed-2")?.status, "active");

      // Repeated seed does not overwrite existing data
      repo.updateName("seed-1", "Custom Seed Name");
      repo.seedChannels(["seed-1", "seed-3"]);
      assert.equal(repo.getChannel("seed-1")?.name, "Custom Seed Name");
      assert.equal(repo.getChannel("seed-3")?.status, "active");
    } finally {
      closeDatabase(db);
    }
  });
});
