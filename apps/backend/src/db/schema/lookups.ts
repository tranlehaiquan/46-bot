import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const scheduledLookups = sqliteTable(
  "scheduled_lookups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: text("chat_id").notNull(),
    instruction: text("instruction").notNull(),
    recurrence: text("recurrence").notNull(),
    hour: integer("hour", { mode: "number" }).notNull(),
    minute: integer("minute", { mode: "number" }).notNull(),
    weekday: integer("weekday", { mode: "number" }),
    dayOfMonth: integer("day_of_month", { mode: "number" }),
    active: integer("active", { mode: "number" }).notNull().default(1),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_scheduled_lookups_chat").on(table.chatId),
  ]
);

export type ScheduledLookup = typeof scheduledLookups.$inferSelect;
export type NewScheduledLookup = typeof scheduledLookups.$inferInsert;

export const scheduledLookupRuns = sqliteTable(
  "scheduled_lookup_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lookupId: integer("lookup_id")
      .notNull()
      .references(() => scheduledLookups.id, { onDelete: "cascade" }),
    fireDate: text("fire_date").notNull(),
    status: text("status").notNull(),
    attemptCount: integer("attempt_count", { mode: "number" }).notNull().default(1),
    lastError: text("last_error"),
    sentAt: integer("sent_at", { mode: "number" }),
    startedAt: integer("started_at", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    uniqueIndex("idx_scheduled_lookup_runs_lookup_fire").on(table.lookupId, table.fireDate),
  ]
);

export type ScheduledLookupRun = typeof scheduledLookupRuns.$inferSelect;
export type NewScheduledLookupRun = typeof scheduledLookupRuns.$inferInsert;
