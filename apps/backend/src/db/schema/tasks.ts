import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { asc } from "drizzle-orm";

export const lists = sqliteTable(
  "lists",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: text("chat_id").notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_lists_chat_norm_name").on(table.chatId, table.normalizedName),
  ]
);

export type List = typeof lists.$inferSelect;
export type NewList = typeof lists.$inferInsert;

export const listItems = sqliteTable(
  "list_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listId: integer("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    done: integer("done", { mode: "number" }).notNull().default(0),
    addedBy: text("added_by").notNull(),
    ts: integer("ts", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_list_items_list").on(table.listId, table.done, asc(table.ts)),
  ]
);

export type ListItem = typeof listItems.$inferSelect;
export type NewListItem = typeof listItems.$inferInsert;

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: text("chat_id").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    calendar: text("calendar").notNull(),
    day: integer("day", { mode: "number" }).notNull(),
    month: integer("month", { mode: "number" }).notNull(),
    year: integer("year", { mode: "number" }),
    isLeapMonth: integer("is_leap_month", { mode: "number" }).notNull().default(0),
    recurrence: text("recurrence").notNull().default("none"),
    remindDaysBefore: integer("remind_days_before", { mode: "number" }).notNull().default(0),
    notes: text("notes"),
    createdBy: text("created_by").notNull(),
    ts: integer("ts", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_events_chat").on(table.chatId),
  ]
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export const remindersSent = sqliteTable(
  "reminders_sent",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    occurrenceDate: text("occurrence_date").notNull(),
    sentAt: integer("sent_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_reminders_sent_event_date").on(table.eventId, table.occurrenceDate),
  ]
);

export type ReminderSent = typeof remindersSent.$inferSelect;
export type NewReminderSent = typeof remindersSent.$inferInsert;
