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
  upsertMemory(chatId: string, subject: string, fact: string, createdBy: string): MemoryRow;
  deleteMemory(chatId: string, subject: string): boolean;
  deleteMemoryById(chatId: string, id: number): boolean;
  listMemories(chatId: string, subject?: string): MemoryRow[];
  getMemory(chatId: string, subject: string): MemoryRow | undefined;

  addStory(input: AddStoryInput): MemoryBookRow;
  deleteStory(chatId: string, id: number): boolean;
  searchStories(chatId: string, query: string, limit?: number): MemoryBookRow[];
  listStories(chatId: string, limit?: number): MemoryBookRow[];
  getStoryById(chatId: string, id: number): MemoryBookRow | undefined;
}

export function createMemoryRepository(db: SqliteDatabase): MemoryRepository {
  const getMemoryBySubjectStmt = db.prepare(`
    SELECT id, chat_id as chatId, subject, fact, created_by as createdBy, ts
    FROM memories
    WHERE chat_id = ? AND LOWER(TRIM(subject)) = LOWER(TRIM(?))
    LIMIT 1
  `);

  const updateMemoryStmt = db.prepare(`
    UPDATE memories
    SET subject = TRIM(?), fact = TRIM(?), created_by = ?, ts = ?
    WHERE id = ?
  `);

  const insertMemoryStmt = db.prepare(`
    INSERT INTO memories (chat_id, subject, fact, created_by, ts)
    VALUES (?, TRIM(?), TRIM(?), ?, ?)
  `);

  const getMemoryByIdStmt = db.prepare(`
    SELECT id, chat_id as chatId, subject, fact, created_by as createdBy, ts
    FROM memories
    WHERE id = ?
  `);

  const deleteMemoryStmt = db.prepare(`
    DELETE FROM memories
    WHERE chat_id = ? AND LOWER(TRIM(subject)) = LOWER(TRIM(?))
  `);

  const deleteMemoryByIdStmt = db.prepare(`
    DELETE FROM memories
    WHERE chat_id = ? AND id = ?
  `);

  const deleteStoryStmt = db.prepare(`
    DELETE FROM memory_book
    WHERE chat_id = ? AND id = ?
  `);

  const listMemoriesByChatStmt = db.prepare(`
    SELECT id, chat_id as chatId, subject, fact, created_by as createdBy, ts
    FROM memories
    WHERE chat_id = ?
    ORDER BY id ASC
  `);

  const listMemoriesBySubjectStmt = db.prepare(`
    SELECT id, chat_id as chatId, subject, fact, created_by as createdBy, ts
    FROM memories
    WHERE chat_id = ? AND LOWER(TRIM(subject)) = LOWER(TRIM(?))
    ORDER BY id ASC
  `);

  const insertStoryStmt = db.prepare(`
    INSERT INTO memory_book (chat_id, title, story, people, happened_on, created_by, ts)
    VALUES (?, TRIM(?), TRIM(?), TRIM(?), ?, ?, ?)
  `);

  const getStoryByIdStmt = db.prepare(`
    SELECT id, chat_id as chatId, title, story, people, happened_on as happenedOn, created_by as createdBy, ts
    FROM memory_book
    WHERE id = ?
  `);

  const getStoryByIdAndChatStmt = db.prepare(`
    SELECT id, chat_id as chatId, title, story, people, happened_on as happenedOn, created_by as createdBy, ts
    FROM memory_book
    WHERE chat_id = ? AND id = ?
  `);

  const listStoriesByChatStmt = db.prepare(`
    SELECT id, chat_id as chatId, title, story, people, happened_on as happenedOn, created_by as createdBy, ts
    FROM memory_book
    WHERE chat_id = ?
    ORDER BY ts DESC, id DESC
    LIMIT ?
  `);

  return {
    upsertMemory(chatId: string, subject: string, fact: string, createdBy: string): MemoryRow {
      const trimmedSubject = subject.trim();
      const trimmedFact = fact.trim();
      const now = Date.now();

      const existing = getMemoryBySubjectStmt.get(chatId, trimmedSubject) as MemoryRow | undefined;
      if (existing) {
        updateMemoryStmt.run(trimmedSubject, trimmedFact, createdBy, now, existing.id);
        return {
          id: existing.id,
          chatId,
          subject: trimmedSubject,
          fact: trimmedFact,
          createdBy,
          ts: now,
        };
      }

      const result = insertMemoryStmt.run(chatId, trimmedSubject, trimmedFact, createdBy, now);
      const insertedId = Number(result.lastInsertRowid);
      return (getMemoryByIdStmt.get(insertedId) as MemoryRow) ?? {
        id: insertedId,
        chatId,
        subject: trimmedSubject,
        fact: trimmedFact,
        createdBy,
        ts: now,
      };
    },

    deleteMemory(chatId: string, subject: string): boolean {
      const result = deleteMemoryStmt.run(chatId, subject.trim());
      return result.changes > 0;
    },

    deleteMemoryById(chatId: string, id: number): boolean {
      const result = deleteMemoryByIdStmt.run(chatId, id);
      return result.changes > 0;
    },

    listMemories(chatId: string, subject?: string): MemoryRow[] {
      if (subject && subject.trim()) {
        return listMemoriesBySubjectStmt.all(chatId, subject.trim()) as MemoryRow[];
      }
      return listMemoriesByChatStmt.all(chatId) as MemoryRow[];
    },

    getMemory(chatId: string, subject: string): MemoryRow | undefined {
      return getMemoryBySubjectStmt.get(chatId, subject.trim()) as MemoryRow | undefined;
    },

    addStory(input: AddStoryInput): MemoryBookRow {
      const now = Date.now();
      const people = input.people?.trim() || "";
      const happenedOn = input.happenedOn?.trim() || null;

      const result = insertStoryStmt.run(
        input.chatId,
        input.title.trim(),
        input.story.trim(),
        people,
        happenedOn,
        input.createdBy,
        now,
      );

      const insertedId = Number(result.lastInsertRowid);
      return (getStoryByIdStmt.get(insertedId) as MemoryBookRow) ?? {
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

    deleteStory(chatId: string, id: number): boolean {
      const result = deleteStoryStmt.run(chatId, id);
      return result.changes > 0;
    },

    searchStories(chatId: string, query: string, limit = 10): MemoryBookRow[] {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return this.listStories(chatId, limit);
      }

      // Tokenize query words for broader matching
      const tokens = trimmedQuery
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // Search matching either the whole query or individual tokens
      const conditions: string[] = ["chat_id = ?"];
      const params: any[] = [chatId];

      const tokenConditions: string[] = [];
      // Full query match
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

      return db.prepare(sql).all(...params) as MemoryBookRow[];
    },

    listStories(chatId: string, limit = 20): MemoryBookRow[] {
      return listStoriesByChatStmt.all(chatId, limit) as MemoryBookRow[];
    },

    getStoryById(chatId: string, id: number): MemoryBookRow | undefined {
      return getStoryByIdAndChatStmt.get(chatId, id) as MemoryBookRow | undefined;
    },
  };
}
