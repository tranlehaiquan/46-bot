import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { desc } from "drizzle-orm";

export const wordChainSessions = sqliteTable(
  "word_chain_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: text("chat_id").notNull(),
    status: text("status").notNull(),
    currentWord: text("current_word").notNull(),
    starterWord: text("starter_word").notNull(),
    totalWords: integer("total_words", { mode: "number" }).notNull().default(0),
    startedAt: integer("started_at", { mode: "number" }).notNull(),
    endedAt: integer("ended_at", { mode: "number" }),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_wc_sessions_chat_status").on(table.chatId, table.status),
  ]
);

export type WordChainSession = typeof wordChainSessions.$inferSelect;
export type NewWordChainSession = typeof wordChainSessions.$inferInsert;

export const wordChainHistory = sqliteTable(
  "word_chain_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => wordChainSessions.id, { onDelete: "cascade" }),
    chatId: text("chat_id").notNull(),
    word: text("word").notNull(),
    playerId: text("player_id").notNull(),
    playerName: text("player_name").notNull(),
    turnIndex: integer("turn_index", { mode: "number" }).notNull(),
    points: integer("points", { mode: "number" }).notNull().default(1),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("idx_wc_history_session").on(table.sessionId),
    index("idx_wc_history_chat").on(table.chatId),
  ]
);

export type WordChainHistoryItem = typeof wordChainHistory.$inferSelect;
export type NewWordChainHistoryItem = typeof wordChainHistory.$inferInsert;

export const wordChainStats = sqliteTable(
  "word_chain_stats",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatId: text("chat_id").notNull(),
    playerId: text("player_id").notNull(),
    playerName: text("player_name").notNull(),
    totalScore: integer("total_score", { mode: "number" }).notNull().default(0),
    wordsChained: integer("words_chained", { mode: "number" }).notNull().default(0),
    highestStreak: integer("highest_streak", { mode: "number" }).notNull().default(0),
    gamesPlayed: integer("games_played", { mode: "number" }).notNull().default(0),
    gamesWon: integer("games_won", { mode: "number" }).notNull().default(0),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_wc_stats_chat_player").on(table.chatId, table.playerId),
    index("idx_wc_stats_chat_score").on(table.chatId, desc(table.totalScore)),
    index("idx_wc_stats_global_score").on(desc(table.totalScore)),
  ]
);

export type WordChainStat = typeof wordChainStats.$inferSelect;
export type NewWordChainStat = typeof wordChainStats.$inferInsert;
