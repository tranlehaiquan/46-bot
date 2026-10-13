import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;

export const channels = sqliteTable(
  "channels",
  {
    chatId: text("chat_id").primaryKey(),
    name: text("name").notNull(),
    chatType: text("chat_type").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    lastActiveAt: integer("last_active_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_channels_status").on(table.status),
  ]
);

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;

export const seenMessages = sqliteTable("seen_messages", {
  messageId: text("message_id").primaryKey(),
  ts: integer("ts", { mode: "number" }).notNull(),
});

export type SeenMessage = typeof seenMessages.$inferSelect;
export type NewSeenMessage = typeof seenMessages.$inferInsert;
