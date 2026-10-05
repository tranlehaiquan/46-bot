import type { SqliteDatabase } from "./connection.js";

export type ListRow = {
  id: number;
  chatId: string;
  name: string;
  createdAt: number;
};

export type ListItemRow = {
  id: number;
  listId: number;
  text: string;
  done: boolean;
  addedBy: string;
  ts: number;
};

export type ListWithItems = ListRow & {
  items: ListItemRow[];
};

export interface ListRepository {
  getOrCreateList(chatId: string, name: string): ListRow;
  getListByName(chatId: string, name: string): ListRow | undefined;
  getListsByChat(chatId: string): ListRow[];
  addItem(listId: number, text: string, addedBy: string): ListItemRow;
  addItems(listId: number, texts: string[], addedBy: string): ListItemRow[];
  getItems(listId: number): ListItemRow[];
  getListWithItems(chatId: string, name: string): ListWithItems | undefined;
  checkItem(listId: number, itemIdOrText: number | string, done: boolean): ListItemRow | undefined;
  removeItem(listId: number, itemIdOrText: number | string): boolean;
  deleteList(chatId: string, name: string): boolean;
}

export function createListRepository(db: SqliteDatabase): ListRepository {
  const getListStmt = db.prepare(`
    SELECT id, chat_id as chatId, name, created_at as createdAt
    FROM lists
    WHERE chat_id = ? AND normalized_name = ?
  `);

  const insertListStmt = db.prepare(`
    INSERT INTO lists (chat_id, name, normalized_name, created_at)
    VALUES (?, TRIM(?), ?, ?)
  `);

  const getListsByChatStmt = db.prepare(`
    SELECT id, chat_id as chatId, name, created_at as createdAt
    FROM lists
    WHERE chat_id = ?
    ORDER BY name ASC
  `);

  const insertItemStmt = db.prepare(`
    INSERT INTO list_items (list_id, text, done, added_by, ts)
    VALUES (?, TRIM(?), 0, ?, ?)
  `);

  const getItemsStmt = db.prepare(`
    SELECT id, list_id as listId, text, done, added_by as addedBy, ts
    FROM list_items
    WHERE list_id = ?
    ORDER BY done ASC, ts ASC, id ASC
  `);

  const findItemByIdStmt = db.prepare(`
    SELECT id, list_id as listId, text, done, added_by as addedBy, ts
    FROM list_items
    WHERE list_id = ? AND id = ?
  `);

  const findItemByTextStmt = db.prepare(`
    SELECT id, list_id as listId, text, done, added_by as addedBy, ts
    FROM list_items
    WHERE list_id = ? AND LOWER(text) LIKE ?
    ORDER BY id ASC
    LIMIT 1
  `);

  const updateItemDoneStmt = db.prepare(`
    UPDATE list_items
    SET done = ?
    WHERE id = ?
  `);

  const deleteItemByIdStmt = db.prepare(`
    DELETE FROM list_items
    WHERE list_id = ? AND id = ?
  `);

  const deleteListStmt = db.prepare(`
    DELETE FROM lists
    WHERE chat_id = ? AND normalized_name = ?
  `);

  function normalize(name: string): string {
    return name.trim().toLowerCase();
  }

  function mapItemRow(row: { id: number; listId: number; text: string; done: number; addedBy: string; ts: number }): ListItemRow {
    return {
      id: row.id,
      listId: row.listId,
      text: row.text,
      done: row.done === 1,
      addedBy: row.addedBy,
      ts: row.ts,
    };
  }

  const repo: ListRepository = {
    getOrCreateList(chatId: string, name: string): ListRow {
      const trimmed = name.trim();
      const norm = normalize(trimmed);
      const existing = getListStmt.get(chatId, norm) as ListRow | undefined;
      if (existing) {
        return existing;
      }
      const now = Date.now();
      const result = insertListStmt.run(chatId, trimmed, norm, now);
      return {
        id: Number(result.lastInsertRowid),
        chatId,
        name: trimmed,
        createdAt: now,
      };
    },

    getListByName(chatId: string, name: string): ListRow | undefined {
      return getListStmt.get(chatId, normalize(name)) as ListRow | undefined;
    },

    getListsByChat(chatId: string): ListRow[] {
      return getListsByChatStmt.all(chatId) as ListRow[];
    },

    addItem(listId: number, text: string, addedBy: string): ListItemRow {
      const now = Date.now();
      const result = insertItemStmt.run(listId, text.trim(), addedBy, now);
      return {
        id: Number(result.lastInsertRowid),
        listId,
        text: text.trim(),
        done: false,
        addedBy,
        ts: now,
      };
    },

    addItems(listId: number, texts: string[], addedBy: string): ListItemRow[] {
      const items: ListItemRow[] = [];
      const tx = db.transaction(() => {
        for (const t of texts) {
          const trimmed = t.trim();
          if (trimmed.length > 0) {
            items.push(repo.addItem(listId, trimmed, addedBy));
          }
        }
      });
      tx();
      return items;
    },

    getItems(listId: number): ListItemRow[] {
      const rows = getItemsStmt.all(listId) as Array<{
        id: number;
        listId: number;
        text: string;
        done: number;
        addedBy: string;
        ts: number;
      }>;
      return rows.map(mapItemRow);
    },

    getListWithItems(chatId: string, name: string): ListWithItems | undefined {
      const list = repo.getListByName(chatId, name);
      if (!list) {
        return undefined;
      }
      const items = repo.getItems(list.id);
      return { ...list, items };
    },

    checkItem(listId: number, itemIdOrText: number | string, done: boolean): ListItemRow | undefined {
      let item: ListItemRow | undefined;
      if (typeof itemIdOrText === "number") {
        const row = findItemByIdStmt.get(listId, itemIdOrText) as any;
        if (row) item = mapItemRow(row);
      } else {
        const query = `%${normalize(itemIdOrText)}%`;
        const row = findItemByTextStmt.get(listId, query) as any;
        if (row) item = mapItemRow(row);
      }

      if (!item) {
        return undefined;
      }

      updateItemDoneStmt.run(done ? 1 : 0, item.id);
      return { ...item, done };
    },

    removeItem(listId: number, itemIdOrText: number | string): boolean {
      if (typeof itemIdOrText === "number") {
        const result = deleteItemByIdStmt.run(listId, itemIdOrText);
        return result.changes > 0;
      }
      const query = `%${normalize(itemIdOrText)}%`;
      const row = findItemByTextStmt.get(listId, query) as any;
      if (!row) {
        return false;
      }
      const result = deleteItemByIdStmt.run(listId, row.id);
      return result.changes > 0;
    },

    deleteList(chatId: string, name: string): boolean {
      const result = deleteListStmt.run(chatId, normalize(name));
      return result.changes > 0;
    },
  };

  return repo;
}
