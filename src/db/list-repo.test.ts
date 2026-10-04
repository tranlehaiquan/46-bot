import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "./connection.js";
import { createListRepository } from "./list-repo.js";
import { migrate } from "./migrations.js";

describe("ListRepository", () => {
  it("creates and retrieves lists case-insensitively", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createListRepository(db);

      const list1 = repo.getOrCreateList("chat-1", "Đi chợ");
      assert.equal(list1.name, "Đi chợ");

      // Case-insensitive fetch and getOrCreate
      const list2 = repo.getOrCreateList("chat-1", "đi chợ");
      assert.equal(list2.id, list1.id);

      const fetched = repo.getListByName("chat-1", "ĐI CHỢ");
      assert.ok(fetched);
      assert.equal(fetched.id, list1.id);

      // Separate chat has separate list
      const listOther = repo.getOrCreateList("chat-2", "Đi chợ");
      assert.notEqual(listOther.id, list1.id);
    } finally {
      closeDatabase(db);
    }
  });

  it("adds, checks off, and removes items from a list", () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createListRepository(db);
      const list = repo.getOrCreateList("chat-1", "Mua sắm");

      // Add single item
      const item1 = repo.addItem(list.id, "Trứng gà", "Alice");
      assert.equal(item1.text, "Trứng gà");
      assert.equal(item1.done, false);

      // Add batch items
      const added = repo.addItems(list.id, ["Sữa tươi", "Bánh mì"], "Bob");
      assert.equal(added.length, 2);

      let items = repo.getItems(list.id);
      assert.equal(items.length, 3);

      // Check item by text match
      const checked = repo.checkItem(list.id, "trứng", true);
      assert.ok(checked);
      assert.equal(checked.done, true);

      // Verify getListWithItems reflects check status
      const listWithItems = repo.getListWithItems("chat-1", "mua sắm");
      assert.ok(listWithItems);
      const checkedItem = listWithItems.items.find((i) => i.text === "Trứng gà");
      assert.equal(checkedItem?.done, true);

      // Remove item by text match
      const removed = repo.removeItem(list.id, "bánh mì");
      assert.equal(removed, true);

      items = repo.getItems(list.id);
      assert.equal(items.length, 2);
      assert.equal(items.some((i) => i.text === "Bánh mì"), false);
    } finally {
      closeDatabase(db);
    }
  });
});
