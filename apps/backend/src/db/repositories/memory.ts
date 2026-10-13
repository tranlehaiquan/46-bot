import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { createDrizzleDb, type SqliteDatabase } from "../connection.js";
import { memories, memoryBook } from "../schema/index.js";
import {
  rankMemoryCandidates,
  type MemorySearchCandidate,
  type ScoredMemorySearchResult,
} from "../../tools/memory-search.js";

export type MemoryCategory = "core" | "general";
export type MemoryStatus = "active" | "superseded";

export type MemoryRow = {
  id: number;
  chatId: string;
  subject: string;
  fact: string;
  category: MemoryCategory;
  status: MemoryStatus;
  condition?: string | null;
  avoidAction?: string | null;
  expiresAt?: number | null;
  createdBy: string;
  ts: number;
};

export type ActionBoundaryInput = {
  condition?: string | null;
  avoidAction?: string | null;
  expiresAt?: number | null;
};

export type ListMemoriesOptions = {
  subject?: string;
  category?: MemoryCategory;
  status?: MemoryStatus;
  query?: string;
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

export type SearchAllOptions = {
  type?: "all" | "facts" | "stories";
  subject?: string;
  category?: MemoryCategory;
  limit?: number;
};

export interface MemoryRepository {
  upsertMemory(
    chatId: string,
    subject: string,
    fact: string,
    createdBy: string,
    category?: MemoryCategory,
    actionBoundary?: ActionBoundaryInput,
  ): Promise<MemoryRow>;
  supersedeMemory(chatId: string, subject: string): Promise<boolean>;
  deleteMemory(chatId: string, subject: string): Promise<boolean>;
  deleteMemoryById(chatId: string, id: number): Promise<boolean>;
  listMemories(chatId: string, options?: string | ListMemoriesOptions): Promise<MemoryRow[]>;
  listActiveMemories(chatId: string, limit?: number, now?: number): Promise<MemoryRow[]>;
  getMemory(chatId: string, subject: string, activeOnly?: boolean): Promise<MemoryRow | undefined>;

  addStory(input: AddStoryInput): Promise<MemoryBookRow>;
  deleteStory(chatId: string, id: number): Promise<boolean>;
  searchStories(chatId: string, query: string, limit?: number): Promise<MemoryBookRow[]>;
  listStories(chatId: string, limit?: number): Promise<MemoryBookRow[]>;
  getStoryById(chatId: string, id: number): Promise<MemoryBookRow | undefined>;

  searchAll(
    chatId: string,
    query: string,
    options?: SearchAllOptions,
  ): Promise<ScoredMemorySearchResult[]>;
}

function subjectMatches(subject: string) {
  return sql`LOWER(TRIM(${memories.subject})) = LOWER(TRIM(${subject}))`;
}

export function createMemoryRepository(db: SqliteDatabase): MemoryRepository {
  const orm = createDrizzleDb(db);
  return {
    async upsertMemory(
      chatId: string,
      subject: string,
      fact: string,
      createdBy: string,
      category: MemoryCategory = "core",
      actionBoundary?: ActionBoundaryInput,
    ): Promise<MemoryRow> {
      const trimmedSubject = subject.trim();
      const trimmedFact = fact.trim();
      const now = Date.now();
      const condition = actionBoundary?.condition?.trim() || null;
      const avoidAction = actionBoundary?.avoidAction?.trim() || null;
      const expiresAt = actionBoundary?.expiresAt ?? null;

      const existing = await this.getMemory(chatId, trimmedSubject, true);
      if (existing) {
        const [updated] = await orm
          .update(memories)
          .set({
            subject: trimmedSubject,
            fact: trimmedFact,
            category,
            status: "active",
            condition,
            avoidAction,
            expiresAt,
            createdBy,
            ts: now,
          })
          .where(eq(memories.id, existing.id))
          .returning();
        return updated as MemoryRow;
      }

      const [inserted] = await orm
        .insert(memories)
        .values({
          chatId,
          subject: trimmedSubject,
          fact: trimmedFact,
          category,
          status: "active",
          condition,
          avoidAction,
          expiresAt,
          createdBy,
          ts: now,
        })
        .returning();
      return inserted as MemoryRow;
    },

    async supersedeMemory(chatId: string, subject: string): Promise<boolean> {
      const updated = await orm
        .update(memories)
        .set({ status: "superseded", ts: Date.now() })
        .where(and(eq(memories.chatId, chatId), subjectMatches(subject.trim()), eq(memories.status, "active")))
        .returning();
      return updated.length > 0;
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

    async listMemories(chatId: string, options?: string | ListMemoriesOptions): Promise<MemoryRow[]> {
      const filters = [eq(memories.chatId, chatId)];
      if (typeof options === "string") {
        if (options.trim()) {
          filters.push(subjectMatches(options.trim()));
        }
      } else if (options) {
        if (options.subject && options.subject.trim()) {
          filters.push(subjectMatches(options.subject.trim()));
        }
        if (options.category) {
          filters.push(eq(memories.category, options.category));
        }
        if (options.status) {
          filters.push(eq(memories.status, options.status));
        }
        if (options.query && options.query.trim()) {
          const q = `%${options.query.trim()}%`;
          filters.push(or(like(memories.subject, q), like(memories.fact, q))!);
        }
      }

      return (await orm
        .select()
        .from(memories)
        .where(and(...filters))
        .orderBy(memories.id)) as MemoryRow[];
    },

    async listActiveMemories(chatId: string, limit = 20, now = Date.now()): Promise<MemoryRow[]> {
      const priorityOrder = sql`CASE WHEN ${memories.category} = 'core' THEN 0 ELSE 1 END`;
      const notExpired = or(sql`${memories.expiresAt} IS NULL`, sql`${memories.expiresAt} > ${now}`);
      return (await orm
        .select()
        .from(memories)
        .where(and(eq(memories.chatId, chatId), eq(memories.status, "active"), notExpired))
        .orderBy(priorityOrder, desc(memories.ts))
        .limit(limit)) as MemoryRow[];
    },

    async getMemory(chatId: string, subject: string, activeOnly = false): Promise<MemoryRow | undefined> {
      const filters = [eq(memories.chatId, chatId), subjectMatches(subject.trim())];
      if (activeOnly) {
        filters.push(eq(memories.status, "active"));
      }
      const [memory] = await orm
        .select()
        .from(memories)
        .where(and(...filters))
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

    async searchAll(
      chatId: string,
      query: string,
      options?: SearchAllOptions,
    ): Promise<ScoredMemorySearchResult[]> {
      const type = options?.type ?? "all";
      const limit = options?.limit ?? 10;
      const candidates: MemorySearchCandidate[] = [];

      if (type === "all" || type === "facts") {
        const memoryRows = await this.listMemories(chatId, {
          subject: options?.subject,
          category: options?.category,
          status: "active",
        });
        for (const m of memoryRows) {
          candidates.push({
            type: "fact",
            id: m.id,
            subject: m.subject,
            content: m.fact,
            category: m.category,
            condition: m.condition,
            avoidAction: m.avoidAction,
            expiresAt: m.expiresAt,
            ts: m.ts,
          });
        }
      }

      if (type === "all" || type === "stories") {
        const storyRows = await this.listStories(chatId, 200);
        for (const s of storyRows) {
          candidates.push({
            type: "story",
            id: s.id,
            subject: s.title,
            content: s.story,
            people: s.people,
            happenedOn: s.happenedOn,
            ts: s.ts,
          });
        }
      }

      return rankMemoryCandidates(candidates, query, limit);
    },
  };
}
