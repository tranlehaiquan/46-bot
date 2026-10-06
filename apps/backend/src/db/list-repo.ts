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
  getOrCreateList(chatId: string, name: string): Promise<ListRow>;
  getListByName(chatId: string, name: string): Promise<ListRow | undefined>;
  getListsByChat(chatId: string): Promise<ListRow[]>;
  addItem(listId: number, text: string, addedBy: string): Promise<ListItemRow>;
  addItems(listId: number, texts: string[], addedBy: string): Promise<ListItemRow[]>;
  getItems(listId: number): Promise<ListItemRow[]>;
  getListWithItems(chatId: string, name: string): Promise<ListWithItems | undefined>;
  checkItem(listId: number, itemIdOrText: number | string, done: boolean): Promise<ListItemRow | undefined>;
  removeItem(listId: number, itemIdOrText: number | string): Promise<boolean>;
  deleteList(chatId: string, name: string): Promise<boolean>;
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

function mapListRow(row: any): ListRow {
  return {
    id: Number(row.id),
    chatId: String(row.chatId),
    name: String(row.name),
    createdAt: Number(row.createdAt),
  };
}

function mapItemRow(row: any): ListItemRow {
  return {
    id: Number(row.id),
    listId: Number(row.listId),
    text: String(row.text),
    done: Number(row.done) === 1,
    addedBy: String(row.addedBy),
    ts: Number(row.ts),
  };
}

export function createListRepository(db: SqliteDatabase): ListRepository {
  const repo: ListRepository = {
    async getOrCreateList(chatId: string, name: string): Promise<ListRow> {
      const trimmed = name.trim();
      const norm = normalize(trimmed);
      const existing = await this.getListByName(chatId, norm);
      if (existing) {
        return existing;
      }
      const now = Date.now();
      const result = await db.execute({
        sql: `INSERT INTO lists (chat_id, name, normalized_name, created_at)
              VALUES (?, TRIM(?), ?, ?)`,
        args: [chatId, trimmed, norm, now],
      });
      return {
        id: Number(result.lastInsertRowid),
        chatId,
        name: trimmed,
        createdAt: now,
      };
    },

    async getListByName(chatId: string, name: string): Promise<ListRow | undefined> {
      const res = await db.execute({
        sql: `SELECT id, chat_id as chatId, name, created_at as createdAt
              FROM lists
              WHERE chat_id = ? AND normalized_name = ?`,
        args: [chatId, normalize(name)],
      });
      return res.rows[0] ? mapListRow(res.rows[0]) : undefined;
    },

    async getListsByChat(chatId: string): Promise<ListRow[]> {
      const res = await db.execute({
        sql: `SELECT id, chat_id as chatId, name, created_at as createdAt
              FROM lists
              WHERE chat_id = ?
              ORDER BY name ASC`,
        args: [chatId],
      });
      return res.rows.map(mapListRow);
    },

    async addItem(listId: number, text: string, addedBy: string): Promise<ListItemRow> {
      const now = Date.now();
      const trimmed = text.trim();
      const result = await db.execute({
        sql: `INSERT INTO list_items (list_id, text, done, added_by, ts)
              VALUES (?, ?, 0, ?, ?)`,
        args: [listId, trimmed, addedBy, now],
      });
      return {
        id: Number(result.lastInsertRowid),
        listId,
        text: trimmed,
        done: false,
        addedBy,
        ts: now,
      };
    },

    async addItems(listId: number, texts: string[], addedBy: string): Promise<ListItemRow[]> {
      const items: ListItemRow[] = [];
      for (const t of texts) {
        const trimmed = t.trim();
        if (trimmed.length > 0) {
          items.push(await this.addItem(listId, trimmed, addedBy));
        }
      }
      return items;
    },

    async getItems(listId: number): Promise<ListItemRow[]> {
      const res = await db.execute({
        sql: `SELECT id, list_id as listId, text, done, added_by as addedBy, ts
              FROM list_items
              WHERE list_id = ?
              ORDER BY done ASC, ts ASC, id ASC`,
        args: [listId],
      });
      return res.rows.map(mapItemRow);
    },

    async getListWithItems(chatId: string, name: string): Promise<ListWithItems | undefined> {
      const list = await this.getListByName(chatId, name);
      if (!list) {
        return undefined;
      }
      const items = await this.getItems(list.id);
      return { ...list, items };
    },

    async checkItem(listId: number, itemIdOrText: number | string, done: boolean): Promise<ListItemRow | undefined> {
      let item: ListItemRow | undefined;
      if (typeof itemIdOrText === "number") {
        const res = await db.execute({
          sql: `SELECT id, list_id as listId, text, done, added_by as addedBy, ts
                FROM list_items
                WHERE list_id = ? AND id = ?`,
          args: [listId, itemIdOrText],
        });
        if (res.rows[0]) item = mapItemRow(res.rows[0]);
      } else {
        const query = `%${normalize(itemIdOrText)}%`;
        const res = await db.execute({
          sql: `SELECT id, list_id as listId, text, done, added_by as addedBy, ts
                FROM list_items
                WHERE list_id = ? AND LOWER(text) LIKE ?
                ORDER BY id ASC
                LIMIT 1`,
          args: [listId, query],
        });
        if (res.rows[0]) item = mapItemRow(res.rows[0]);
      }

      if (!item) {
        return undefined;
      }

      await db.execute({
        sql: `UPDATE list_items SET done = ? WHERE id = ?`,
        args: [done ? 1 : 0, item.id],
      });
      return { ...item, done };
    },

    async removeItem(listId: number, itemIdOrText: number | string): Promise<boolean> {
      if (typeof itemIdOrText === "number") {
        const res = await db.execute({
          sql: `DELETE FROM list_items WHERE list_id = ? AND id = ?`,
          args: [listId, itemIdOrText],
        });
        return res.rowsAffected > 0;
      }
      const query = `%${normalize(itemIdOrText)}%`;
      const searchRes = await db.execute({
        sql: `SELECT id, list_id as listId, text, done, added_by as addedBy, ts
              FROM list_items
              WHERE list_id = ? AND LOWER(text) LIKE ?
              ORDER BY id ASC
              LIMIT 1`,
        args: [listId, query],
      });
      if (!searchRes.rows[0]) {
        return false;
      }
      const item = mapItemRow(searchRes.rows[0]);
      const res = await db.execute({
        sql: `DELETE FROM list_items WHERE list_id = ? AND id = ?`,
        args: [listId, item.id],
      });
      return res.rowsAffected > 0;
    },

    async deleteList(chatId: string, name: string): Promise<boolean> {
      const res = await db.execute({
        sql: `DELETE FROM lists WHERE chat_id = ? AND normalized_name = ?`,
        args: [chatId, normalize(name)],
      });
      return res.rowsAffected > 0;
    },
  };

  return repo;
}
