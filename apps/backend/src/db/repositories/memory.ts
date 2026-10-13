import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { createDrizzleDb, type SqliteDatabase } from "../connection.js";
import { memories, memoryBook } from "../schema/index.js";

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

function subjectMatches(subject: string) {
  return sql`LOWER(TRIM(${memories.subject})) = LOWER(TRIM(${subject}))`;
}

export function createMemoryRepository(db: SqliteDatabase): MemoryRepository {
  const orm = createDrizzleDb(db);
  return {
    async upsertMemory(chatId: string, subject: string, fact: string, createdBy: string): Promise<MemoryRow> {
      const trimmedSubject = subject.trim();
      const trimmedFact = fact.trim();
      const now = Date.now();

      const existing = await this.getMemory(chatId, trimmedSubject);
      if (existing) {
        const [updated] = await orm
          .update(memories)
          .set({ subject: trimmedSubject, fact: trimmedFact, createdBy, ts: now })
          .where(eq(memories.id, existing.id))
          .returning();
        return updated as MemoryRow;
      }

      const [inserted] = await orm
        .insert(memories)
        .values({ chatId, subject: trimmedSubject, fact: trimmedFact, createdBy, ts: now })
        .returning();
      return inserted as MemoryRow;
    },

    async deleteMemory(chatId: string, subject: string): Promise<boolean> {
      const deleted = await orm
        .delete(memories)
        .where(and(eq(memories.chatId, chatId), subjectMatches(subject.trim())))
        .returning();
      return deleted.length > 0;
    },

    async deleteMemoryById(chatId: string, id: number): Promise<boolean> {
      const deleted = await orm
        .delete(memories)
        .where(and(eq(memories.chatId, chatId), eq(memories.id, id)))
        .returning();
      return deleted.length > 0;
    },

    async listMemories(chatId: string, subject?: string): Promise<MemoryRow[]> {
      const whereClause =
        subject && subject.trim()
          ? and(eq(memories.chatId, chatId), subjectMatches(subject.trim()))
          : eq(memories.chatId, chatId);
      return (await orm.select().from(memories).where(whereClause).orderBy(memories.id)) as MemoryRow[];
    },

    async getMemory(chatId: string, subject: string): Promise<MemoryRow | undefined> {
      const [memory] = await orm
        .select()
        .from(memories)
        .where(and(eq(memories.chatId, chatId), subjectMatches(subject.trim())))
        .limit(1);
      return memory as MemoryRow | undefined;
    },

    async addStory(input: AddStoryInput): Promise<MemoryBookRow> {
      const now = Date.now();
      const people = input.people?.trim() || "";
      const happenedOn = input.happenedOn?.trim() || null;
      const [story] = await orm
        .insert(memoryBook)
        .values({
          chatId: input.chatId,
          title: input.title.trim(),
          story: input.story.trim(),
          people,
          happenedOn,
          createdBy: input.createdBy,
          ts: now,
        })
        .returning();
      return story as MemoryBookRow;
    },

    async deleteStory(chatId: string, id: number): Promise<boolean> {
      const deleted = await orm
        .delete(memoryBook)
        .where(and(eq(memoryBook.chatId, chatId), eq(memoryBook.id, id)))
        .returning();
      return deleted.length > 0;
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

      const matchFields = (pattern: string) =>
        or(like(memoryBook.title, pattern), like(memoryBook.story, pattern), like(memoryBook.people, pattern));

      const tokenConditions = [matchFields(`%${trimmedQuery}%`), ...tokens.map((token) => matchFields(`%${token}%`))];

      return (await orm
        .select()
        .from(memoryBook)
        .where(and(eq(memoryBook.chatId, chatId), or(...tokenConditions)))
        .orderBy(desc(memoryBook.ts), desc(memoryBook.id))
        .limit(limit)) as MemoryBookRow[];
    },

    async listStories(chatId: string, limit = 20): Promise<MemoryBookRow[]> {
      return (await orm
        .select()
        .from(memoryBook)
        .where(eq(memoryBook.chatId, chatId))
        .orderBy(desc(memoryBook.ts), desc(memoryBook.id))
        .limit(limit)) as MemoryBookRow[];
    },

    async getStoryById(chatId: string, id: number): Promise<MemoryBookRow | undefined> {
      const [story] = await orm
        .select()
        .from(memoryBook)
        .where(and(eq(memoryBook.chatId, chatId), eq(memoryBook.id, id)))
        .limit(1);
      return story as MemoryBookRow | undefined;
    },
  };
}
