import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { desc } from "drizzle-orm";

export const messages = sqliteTable(
  "messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: text("chat_id").notNull(),
    senderId: text("sender_id").notNull(),
    senderName: text("sender_name").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    ts: integer("ts", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_messages_chat_ts").on(table.chatId, desc(table.ts)),
  ]
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type MemoryCategory = "core" | "general";
export type MemoryStatus = "active" | "superseded";

export const memories = sqliteTable(
  "memories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: text("chat_id").notNull(),
    subject: text("subject").notNull(),
    fact: text("fact").notNull(),
    category: text("category", { enum: ["core", "general"] }).notNull().default("core"),
    status: text("status", { enum: ["active", "superseded"] }).notNull().default("active"),
    createdBy: text("created_by").notNull(),
    ts: integer("ts", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_memories_chat_subject").on(table.chatId, table.subject),
    index("idx_memories_chat_status").on(table.chatId, table.status),
  ]
);

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

export const memoryBook = sqliteTable(
  "memory_book",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: text("chat_id").notNull(),
    title: text("title").notNull(),
    story: text("story").notNull(),
    people: text("people").notNull(),
    happenedOn: text("happened_on"),
    createdBy: text("created_by").notNull(),
    ts: integer("ts", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_memory_book_chat").on(table.chatId, desc(table.ts)),
  ]
);

export type MemoryBookEntry = typeof memoryBook.$inferSelect;
export type NewMemoryBookEntry = typeof memoryBook.$inferInsert;

export const groupMembers = sqliteTable(
  "group_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: text("chat_id").notNull(),
    senderId: text("sender_id").notNull(),
    senderName: text("sender_name").notNull(),
    alias: text("alias"),
    relationship: text("relationship"),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_group_members_chat_sender").on(table.chatId, table.senderId),
    index("idx_group_members_chat").on(table.chatId),
  ]
);

export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
