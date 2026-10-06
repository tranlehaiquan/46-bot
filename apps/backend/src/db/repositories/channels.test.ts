import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "../connection.js";
import { migrate } from "../migrations.js";
import { createChannelRepository } from "./channels.js";

describe("ChannelRepository", () => {
  it("upserts discovery and defaults to pending", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createChannelRepository(db);

      const ch = await repo.upsertDiscovery({
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
      const updated = await repo.upsertDiscovery({
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

  it("updates channel status and name", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createChannelRepository(db);

      await repo.upsertDiscovery({
        chatId: "group-202",
        name: "Old Name",
        chatType: "GROUP",
      });

      assert.equal(await repo.updateStatus("group-202", "active"), true);
      assert.equal((await repo.getChannel("group-202"))?.status, "active");

      assert.equal(await repo.updateName("group-202", "New Name"), true);
      assert.equal((await repo.getChannel("group-202"))?.name, "New Name");

      assert.equal(await repo.updateStatus("non-existent", "active"), false);
      assert.equal(await repo.updateName("non-existent", "Name"), false);
    } finally {
      closeDatabase(db);
    }
  });

  it("lists channels with optional status filter", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createChannelRepository(db);

      await repo.upsertDiscovery({ chatId: "ch-1", name: "Ch 1", chatType: "GROUP" });
      await repo.upsertDiscovery({ chatId: "ch-2", name: "Ch 2", chatType: "PRIVATE" });
      await repo.updateStatus("ch-1", "active");

      const all = await repo.listChannels();
      assert.equal(all.length, 2);

      const active = await repo.listChannels("active");
      assert.equal(active.length, 1);
      assert.equal(active[0].chatId, "ch-1");

      const pending = await repo.listChannels("pending");
      assert.equal(pending.length, 1);
      assert.equal(pending[0].chatId, "ch-2");

      const disabled = await repo.listChannels("disabled");
      assert.equal(disabled.length, 0);
    } finally {
      closeDatabase(db);
    }
  });

  it("seeds channels idempotently with active status", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createChannelRepository(db);

      await repo.seedChannels(["seed-1", "seed-2"]);
      assert.equal((await repo.getChannel("seed-1"))?.status, "active");
      assert.equal((await repo.getChannel("seed-2"))?.status, "active");

      // Repeated seed does not overwrite existing data
      await repo.updateName("seed-1", "Custom Seed Name");
      await repo.seedChannels(["seed-1", "seed-3"]);
      assert.equal((await repo.getChannel("seed-1"))?.name, "Custom Seed Name");
      assert.equal((await repo.getChannel("seed-3"))?.status, "active");
    } finally {
      closeDatabase(db);
    }
  });
});
