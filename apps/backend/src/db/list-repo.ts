import { and, asc, eq, sql } from "drizzle-orm";
import { createDrizzleDb, type SqliteDatabase } from "./connection.js";
import { listItems, lists } from "./schema/index.js";

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

function toListRow(row: typeof lists.$inferSelect): ListRow {
  return {
    id: row.id,
    chatId: row.chatId,
    name: row.name,
    createdAt: row.createdAt,
  };
}

function toItemRow(row: typeof listItems.$inferSelect): ListItemRow {
  return {
    id: row.id,
    listId: row.listId,
    text: row.text,
    done: row.done === 1,
    addedBy: row.addedBy,
    ts: row.ts,
  };
}

export function createListRepository(db: SqliteDatabase): ListRepository {
  const orm = createDrizzleDb(db);
  const repo: ListRepository = {
    async getOrCreateList(chatId: string, name: string): Promise<ListRow> {
      const trimmed = name.trim();
      const norm = normalize(trimmed);
      const existing = await this.getListByName(chatId, norm);
      if (existing) {
        return existing;
      }
      const now = Date.now();
      const [list] = await orm
        .insert(lists)
        .values({ chatId, name: trimmed, normalizedName: norm, createdAt: now })
        .returning();
      return toListRow(list);
    },

    async getListByName(chatId: string, name: string): Promise<ListRow | undefined> {
      const [list] = await orm
        .select()
        .from(lists)
        .where(and(eq(lists.chatId, chatId), eq(lists.normalizedName, normalize(name))))
        .limit(1);
      return list ? toListRow(list) : undefined;
    },

    async getListsByChat(chatId: string): Promise<ListRow[]> {
      return (await orm.select().from(lists).where(eq(lists.chatId, chatId)).orderBy(asc(lists.name))).map(toListRow);
    },

    async addItem(listId: number, text: string, addedBy: string): Promise<ListItemRow> {
      const now = Date.now();
      const trimmed = text.trim();
      const [item] = await orm
        .insert(listItems)
        .values({ listId, text: trimmed, done: 0, addedBy, ts: now })
        .returning();
      return toItemRow(item);
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
      return (
        await orm
          .select()
          .from(listItems)
          .where(eq(listItems.listId, listId))
          .orderBy(asc(listItems.done), asc(listItems.ts), asc(listItems.id))
      ).map(toItemRow);
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
        const [row] = await orm
          .select()
          .from(listItems)
          .where(and(eq(listItems.listId, listId), eq(listItems.id, itemIdOrText)))
          .limit(1);
        if (row) item = toItemRow(row);
      } else {
        const query = `%${normalize(itemIdOrText)}%`;
        const [row] = await orm
          .select()
          .from(listItems)
          .where(and(eq(listItems.listId, listId), sql`LOWER(${listItems.text}) LIKE ${query}`))
          .orderBy(asc(listItems.id))
          .limit(1);
        if (row) item = toItemRow(row);
      }

      if (!item) {
        return undefined;
      }

      await orm.update(listItems).set({ done: done ? 1 : 0 }).where(eq(listItems.id, item.id));
      return { ...item, done };
    },

    async removeItem(listId: number, itemIdOrText: number | string): Promise<boolean> {
      if (typeof itemIdOrText === "number") {
        const deleted = await orm
          .delete(listItems)
          .where(and(eq(listItems.listId, listId), eq(listItems.id, itemIdOrText)))
          .returning();
        return deleted.length > 0;
      }
      const query = `%${normalize(itemIdOrText)}%`;
      const [row] = await orm
        .select()
        .from(listItems)
        .where(and(eq(listItems.listId, listId), sql`LOWER(${listItems.text}) LIKE ${query}`))
        .orderBy(asc(listItems.id))
        .limit(1);
      if (!row) {
        return false;
      }
      const deleted = await orm
        .delete(listItems)
        .where(and(eq(listItems.listId, listId), eq(listItems.id, row.id)))
        .returning();
      return deleted.length > 0;
    },

    async deleteList(chatId: string, name: string): Promise<boolean> {
      const deleted = await orm
        .delete(lists)
        .where(and(eq(lists.chatId, chatId), eq(lists.normalizedName, normalize(name))))
        .returning();
      return deleted.length > 0;
    },
  };

  return repo;
}
