import type { SqliteDatabase } from "../connection.js";

export type MemoryRow = {
  id: number;
  chatId: string;
  subject: string;
  fact: string;
  createdBy: string;
  ts: number;
};

export type MemoryBookRow = {
  id: number;
  chatId: string;
  title: string;
  story: string;
  people: string;
  happenedOn: string | null;
  createdBy: string;
  ts: number;
};

export type AddStoryInput = {
  chatId: string;
  title: string;
  story: string;
  people?: string;
  happenedOn?: string | null;
  createdBy: string;
};

export interface MemoryRepository {
  upsertMemory(chatId: string, subject: string, fact: string, createdBy: string): Promise<MemoryRow>;
  deleteMemory(chatId: string, subject: string): Promise<boolean>;
  deleteMemoryById(chatId: string, id: number): Promise<boolean>;
  listMemories(chatId: string, subject?: string): Promise<MemoryRow[]>;
  getMemory(chatId: string, subject: string): Promise<MemoryRow | undefined>;

  addStory(input: AddStoryInput): Promise<MemoryBookRow>;
  deleteStory(chatId: string, id: number): Promise<boolean>;
  searchStories(chatId: string, query: string, limit?: number): Promise<MemoryBookRow[]>;
  listStories(chatId: string, limit?: number): Promise<MemoryBookRow[]>;
  getStoryById(chatId: string, id: number): Promise<MemoryBookRow | undefined>;
}

function mapMemoryRow(row: any): MemoryRow {
  return {
    id: Number(row.id),
    chatId: String(row.chatId),
    subject: String(row.subject),
    fact: String(row.fact),
    createdBy: String(row.createdBy),
    ts: Number(row.ts),
  };
}

function mapStoryRow(row: any): MemoryBookRow {
  return {
    id: Number(row.id),
    chatId: String(row.chatId),
    title: String(row.title),
    story: String(row.story),
    people: String(row.people),
    happenedOn: row.happenedOn ? String(row.happenedOn) : null,
    createdBy: String(row.createdBy),
    ts: Number(row.ts),
  };
}

export function createMemoryRepository(db: SqliteDatabase): MemoryRepository {
  return {
    async upsertMemory(chatId: string, subject: string, fact: string, createdBy: string): Promise<MemoryRow> {
      const trimmedSubject = subject.trim();
      const trimmedFact = fact.trim();
      const now = Date.now();

      const existing = await this.getMemory(chatId, trimmedSubject);
      if (existing) {
        await db.execute({
          sql: `UPDATE memories SET subject = TRIM(?), fact = TRIM(?), created_by = ?, ts = ? WHERE id = ?`,
          args: [trimmedSubject, trimmedFact, createdBy, now, existing.id],
        });
        return {
          id: existing.id,
          chatId,
          subject: trimmedSubject,
          fact: trimmedFact,
          createdBy,
          ts: now,
        };
      }

      const result = await db.execute({
        sql: `INSERT INTO memories (chat_id, subject, fact, created_by, ts) VALUES (?, TRIM(?), TRIM(?), ?, ?)`,
        args: [chatId, trimmedSubject, trimmedFact, createdBy, now],
      });
      const insertedId = Number(result.lastInsertRowid);
      return {
        id: insertedId,
        chatId,
        subject: trimmedSubject,
        fact: trimmedFact,
        createdBy,
        ts: now,
      };
    },

    async deleteMemory(chatId: string, subject: string): Promise<boolean> {
      const res = await db.execute({
        sql: `DELETE FROM memories WHERE chat_id = ? AND LOWER(TRIM(subject)) = LOWER(TRIM(?))`,
        args: [chatId, subject.trim()],
      });
      return res.rowsAffected > 0;
    },

    async deleteMemoryById(chatId: string, id: number): Promise<boolean> {
      const res = await db.execute({
        sql: `DELETE FROM memories WHERE chat_id = ? AND id = ?`,
        args: [chatId, id],
      });
      return res.rowsAffected > 0;
    },

    async listMemories(chatId: string, subject?: string): Promise<MemoryRow[]> {
      if (subject && subject.trim()) {
        const res = await db.execute({
          sql: `SELECT id, chat_id as chatId, subject, fact, created_by as createdBy, ts
                FROM memories
                WHERE chat_id = ? AND LOWER(TRIM(subject)) = LOWER(TRIM(?))
                ORDER BY id ASC`,
          args: [chatId, subject.trim()],
        });
        return res.rows.map(mapMemoryRow);
      }
      const res = await db.execute({
        sql: `SELECT id, chat_id as chatId, subject, fact, created_by as createdBy, ts
              FROM memories
              WHERE chat_id = ?
              ORDER BY id ASC`,
        args: [chatId],
      });
      return res.rows.map(mapMemoryRow);
    },

    async getMemory(chatId: string, subject: string): Promise<MemoryRow | undefined> {
      const res = await db.execute({
        sql: `SELECT id, chat_id as chatId, subject, fact, created_by as createdBy, ts
              FROM memories
              WHERE chat_id = ? AND LOWER(TRIM(subject)) = LOWER(TRIM(?))
              LIMIT 1`,
        args: [chatId, subject.trim()],
      });
      return res.rows[0] ? mapMemoryRow(res.rows[0]) : undefined;
    },

    async addStory(input: AddStoryInput): Promise<MemoryBookRow> {
      const now = Date.now();
      const people = input.people?.trim() || "";
      const happenedOn = input.happenedOn?.trim() || null;

      const result = await db.execute({
        sql: `INSERT INTO memory_book (chat_id, title, story, people, happened_on, created_by, ts)
              VALUES (?, TRIM(?), TRIM(?), TRIM(?), ?, ?, ?)`,
        args: [
          input.chatId,
          input.title.trim(),
          input.story.trim(),
          people,
          happenedOn,
          input.createdBy,
          now,
        ],
      });

      const insertedId = Number(result.lastInsertRowid);
      return {
        id: insertedId,
        chatId: input.chatId,
        title: input.title.trim(),
        story: input.story.trim(),
        people,
        happenedOn,
        createdBy: input.createdBy,
        ts: now,
      };
    },

    async deleteStory(chatId: string, id: number): Promise<boolean> {
      const res = await db.execute({
        sql: `DELETE FROM memory_book WHERE chat_id = ? AND id = ?`,
        args: [chatId, id],
      });
      return res.rowsAffected > 0;
    },

    async searchStories(chatId: string, query: string, limit = 10): Promise<MemoryBookRow[]> {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return this.listStories(chatId, limit);
      }

      const tokens = trimmedQuery
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const conditions: string[] = ["chat_id = ?"];
      const params: any[] = [chatId];

      const tokenConditions: string[] = [];
      tokenConditions.push("(title LIKE ? OR story LIKE ? OR people LIKE ?)");
      const fullPattern = `%${trimmedQuery}%`;
      params.push(fullPattern, fullPattern, fullPattern);

      for (const token of tokens) {
        tokenConditions.push("(title LIKE ? OR story LIKE ? OR people LIKE ?)");
        const pattern = `%${token}%`;
        params.push(pattern, pattern, pattern);
      }

      conditions.push(`(${tokenConditions.join(" OR ")})`);
      params.push(limit);

      const sql = `
        SELECT id, chat_id as chatId, title, story, people, happened_on as happenedOn, created_by as createdBy, ts
        FROM memory_book
        WHERE ${conditions.join(" AND ")}
        ORDER BY ts DESC, id DESC
        LIMIT ?
      `;

      const res = await db.execute({ sql, args: params });
      return res.rows.map(mapStoryRow);
    },

    async listStories(chatId: string, limit = 20): Promise<MemoryBookRow[]> {
      const res = await db.execute({
        sql: `SELECT id, chat_id as chatId, title, story, people, happened_on as happenedOn, created_by as createdBy, ts
              FROM memory_book
              WHERE chat_id = ?
              ORDER BY ts DESC, id DESC
              LIMIT ?`,
        args: [chatId, limit],
      });
      return res.rows.map(mapStoryRow);
    },

    async getStoryById(chatId: string, id: number): Promise<MemoryBookRow | undefined> {
      const res = await db.execute({
        sql: `SELECT id, chat_id as chatId, title, story, people, happened_on as happenedOn, created_by as createdBy, ts
              FROM memory_book
              WHERE chat_id = ? AND id = ?`,
        args: [chatId, id],
      });
      return res.rows[0] ? mapStoryRow(res.rows[0]) : undefined;
    },
  };
}
