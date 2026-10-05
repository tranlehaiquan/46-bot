import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeDatabase, openDatabase } from "../db/connection.js";
import { createListRepository } from "../db/list-repo.js";
import { migrate } from "../db/migrations.js";
import { createListTools } from "./lists.js";

describe("Shared list tools", () => {
  it("executes list_create, list_add_item, list_check_item, list_remove_item, and list_show", async () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createListRepository(db);
      const tools = createListTools(repo, { chatId: "chat-100", senderName: "Bố" });

      // 1. list_create
      const createRes = (await tools.list_create.execute?.({ name: "Đi chợ" }, {} as any)) as any;
      assert.ok(createRes);
      assert.equal(createRes.success, true);
      assert.equal(createRes.listName, "Đi chợ");

      // 2. list_add_item
      const addRes = (await tools.list_add_item.execute?.(
        { listName: "Đi chợ", items: ["Thịt bò", "Rau muống"] },
        {} as any,
      )) as any;
      assert.ok(addRes);
      assert.equal(addRes.success, true);
      assert.equal(addRes.addedCount, 2);

      // 3. list_show
      const showRes = (await tools.list_show.execute?.({ listName: "Đi chợ" }, {} as any)) as any;
      assert.ok(showRes);
      assert.equal(showRes.success, true);
      assert.equal(showRes.totalItems, 2);
      assert.equal(showRes.items[0].done, false);

      // 4. list_check_item
      const checkRes = (await tools.list_check_item.execute?.(
        { listName: "Đi chợ", itemText: "thịt", done: true },
        {} as any,
      )) as any;
      assert.ok(checkRes);
      assert.equal(checkRes.success, true);
      assert.equal(checkRes.done, true);

      // 5. list_remove_item
      const removeRes = (await tools.list_remove_item.execute?.(
        { listName: "Đi chợ", itemText: "rau" },
        {} as any,
      )) as any;
      assert.ok(removeRes);
      assert.equal(removeRes.success, true);

      // 6. show all lists
      const showAllRes = (await tools.list_show.execute?.({}, {} as any)) as any;
      assert.ok(showAllRes);
      assert.equal(showAllRes.totalLists, 1);
      assert.equal(showAllRes.lists[0].name, "Đi chợ");
    } finally {
      closeDatabase(db);
    }
  });

  it("handles non-existent list errors gracefully", async () => {
    const db = openDatabase(":memory:");
    try {
      migrate(db);
      const repo = createListRepository(db);
      const tools = createListTools(repo, { chatId: "chat-100", senderName: "Mẹ" });

      const checkRes = (await tools.list_check_item.execute?.(
        { listName: "Không tồn tại", itemText: "món gì đó", done: true },
        {} as any,
      )) as any;
      assert.ok(checkRes);
      assert.equal(checkRes.success, false);

      const removeRes = (await tools.list_remove_item.execute?.(
        { listName: "Không tồn tại", itemText: "món gì đó" },
        {} as any,
      )) as any;
      assert.ok(removeRes);
      assert.equal(removeRes.success, false);
    } finally {
      closeDatabase(db);
    }
  });
});
