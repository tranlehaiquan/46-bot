import { and, desc, eq, sql } from "drizzle-orm";
import { createDrizzleDb, type SqliteDatabase } from "../connection.js";
import { wordChainHistory, wordChainSessions, wordChainStats } from "../schema/index.js";

export type WordChainSessionStatus = "active" | "finished" | "timed_out";

export type WordChainSessionRow = {
  id: number;
  chatId: string;
  status: WordChainSessionStatus;
  currentWord: string;
  starterWord: string;
  totalWords: number;
  startedAt: number;
  endedAt?: number;
  updatedAt: number;
};

export type WordChainHistoryRow = {
  id: number;
  sessionId: number;
  chatId: string;
  word: string;
  playerId: string;
  playerName: string;
  turnIndex: number;
  points: number;
  createdAt: number;
};

export type WordChainPlayerStatsRow = {
  id: number;
  chatId: string;
  playerId: string;
  playerName: string;
  totalScore: number;
  wordsChained: number;
  highestStreak: number;
  gamesPlayed: number;
  gamesWon: number;
  updatedAt: number;
};

export type LeaderboardEntry = {
  rank: number;
  playerId: string;
  playerName: string;
  chatId?: string;
  totalScore: number;
  wordsChained: number;
  highestStreak: number;
  gamesWon: number;
};

export interface WordChainRepository {
  getActiveSession(chatId: string): Promise<WordChainSessionRow | undefined>;
  getSessionById(id: number): Promise<WordChainSessionRow | undefined>;
  createSession(chatId: string, starterWord: string): Promise<WordChainSessionRow>;
  updateSessionWord(sessionId: number, currentWord: string, totalWords: number): Promise<void>;
  endSession(sessionId: number, status: "finished" | "timed_out"): Promise<void>;
  recordWordHistory(input: {
    sessionId: number;
    chatId: string;
    word: string;
    playerId: string;
    playerName: string;
    turnIndex: number;
    points: number;
  }): Promise<void>;
  getSessionWords(sessionId: number): Promise<string[]>;
  getSessionHistory(sessionId: number): Promise<WordChainHistoryRow[]>;
  updatePlayerStats(input: {
    chatId: string;
    playerId: string;
    playerName: string;
    pointsAdded: number;
    wordsAdded: number;
    currentStreak: number;
    wonGame?: boolean;
  }): Promise<void>;
  incrementGamesPlayed(chatId: string, playerIds: string[]): Promise<void>;
  getPlayerStats(chatId: string, playerId: string): Promise<WordChainPlayerStatsRow | undefined>;
  getLeaderboard(chatId?: string, limit?: number): Promise<LeaderboardEntry[]>;
}

function toSessionRow(row: typeof wordChainSessions.$inferSelect): WordChainSessionRow {
  return {
    id: row.id,
    chatId: row.chatId,
    status: row.status as WordChainSessionStatus,
    currentWord: row.currentWord,
    starterWord: row.starterWord,
    totalWords: row.totalWords,
    startedAt: row.startedAt,
    endedAt: row.endedAt ?? undefined,
    updatedAt: row.updatedAt,
  };
}

function toHistoryRow(row: typeof wordChainHistory.$inferSelect): WordChainHistoryRow {
  return {
    id: row.id,
    sessionId: row.sessionId,
    chatId: row.chatId,
    word: row.word,
    playerId: row.playerId,
    playerName: row.playerName,
    turnIndex: row.turnIndex,
    points: row.points,
    createdAt: row.createdAt,
  };
}

function toStatsRow(row: typeof wordChainStats.$inferSelect): WordChainPlayerStatsRow {
  return {
    id: row.id,
    chatId: row.chatId,
    playerId: row.playerId,
    playerName: row.playerName,
    totalScore: row.totalScore,
    wordsChained: row.wordsChained,
    highestStreak: row.highestStreak,
    gamesPlayed: row.gamesPlayed,
    gamesWon: row.gamesWon,
    updatedAt: row.updatedAt,
  };
}

export function createWordChainRepository(db: SqliteDatabase): WordChainRepository {
  const orm = createDrizzleDb(db);
  return {
    async getActiveSession(chatId: string): Promise<WordChainSessionRow | undefined> {
      const [row] = await orm
        .select()
        .from(wordChainSessions)
        .where(and(eq(wordChainSessions.chatId, chatId), eq(wordChainSessions.status, "active")))
        .orderBy(desc(wordChainSessions.id))
        .limit(1);
      return row ? toSessionRow(row) : undefined;
    },

    async getSessionById(id: number): Promise<WordChainSessionRow | undefined> {
      const [row] = await orm.select().from(wordChainSessions).where(eq(wordChainSessions.id, id)).limit(1);
      return row ? toSessionRow(row) : undefined;
    },

    async createSession(chatId: string, starterWord: string): Promise<WordChainSessionRow> {
      const now = Date.now();
      await orm
        .update(wordChainSessions)
        .set({ status: "timed_out", endedAt: now, updatedAt: now })
        .where(and(eq(wordChainSessions.chatId, chatId), eq(wordChainSessions.status, "active")));

      const [row] = await orm
        .insert(wordChainSessions)
        .values({
          chatId,
          status: "active",
          currentWord: starterWord,
          starterWord,
          totalWords: 0,
          startedAt: now,
          updatedAt: now,
        })
        .returning();
      return toSessionRow(row);
    },

    async updateSessionWord(sessionId: number, currentWord: string, totalWords: number): Promise<void> {
      await orm
        .update(wordChainSessions)
        .set({ currentWord, totalWords, updatedAt: Date.now() })
        .where(eq(wordChainSessions.id, sessionId));
    },

    async endSession(sessionId: number, status: "finished" | "timed_out"): Promise<void> {
      const now = Date.now();
      await orm
        .update(wordChainSessions)
        .set({ status, endedAt: now, updatedAt: now })
        .where(eq(wordChainSessions.id, sessionId));
    },

    async recordWordHistory(input: {
      sessionId: number;
      chatId: string;
      word: string;
      playerId: string;
      playerName: string;
      turnIndex: number;
      points: number;
    }): Promise<void> {
      await orm.insert(wordChainHistory).values({
        sessionId: input.sessionId,
        chatId: input.chatId,
        word: input.word,
        playerId: input.playerId,
        playerName: input.playerName,
        turnIndex: input.turnIndex,
        points: input.points,
        createdAt: Date.now(),
      });
    },

    async getSessionWords(sessionId: number): Promise<string[]> {
      const rows = await orm
        .select({ word: wordChainHistory.word })
        .from(wordChainHistory)
        .where(eq(wordChainHistory.sessionId, sessionId))
        .orderBy(wordChainHistory.turnIndex);
      return rows.map((r) => r.word);
    },

    async getSessionHistory(sessionId: number): Promise<WordChainHistoryRow[]> {
      return (
        await orm
          .select()
          .from(wordChainHistory)
          .where(eq(wordChainHistory.sessionId, sessionId))
          .orderBy(wordChainHistory.turnIndex)
      ).map(toHistoryRow);
    },

    async updatePlayerStats(input: {
      chatId: string;
      playerId: string;
      playerName: string;
      pointsAdded: number;
      wordsAdded: number;
      currentStreak: number;
      wonGame?: boolean;
    }): Promise<void> {
      const now = Date.now();
      const existing = await this.getPlayerStats(input.chatId, input.playerId);

      if (!existing) {
        await orm.insert(wordChainStats).values({
          chatId: input.chatId,
          playerId: input.playerId,
          playerName: input.playerName,
          totalScore: input.pointsAdded,
          wordsChained: input.wordsAdded,
          highestStreak: input.currentStreak,
          gamesPlayed: 1,
          gamesWon: input.wonGame ? 1 : 0,
          updatedAt: now,
        });
      } else {
        await orm
          .update(wordChainStats)
          .set({
            playerName: input.playerName,
            totalScore: existing.totalScore + input.pointsAdded,
            wordsChained: existing.wordsChained + input.wordsAdded,
            highestStreak: Math.max(existing.highestStreak, input.currentStreak),
            gamesWon: existing.gamesWon + (input.wonGame ? 1 : 0),
            updatedAt: now,
          })
          .where(and(eq(wordChainStats.chatId, input.chatId), eq(wordChainStats.playerId, input.playerId)));
      }
    },

    async incrementGamesPlayed(chatId: string, playerIds: string[]): Promise<void> {
      if (playerIds.length === 0) return;
      const now = Date.now();
      for (const pid of playerIds) {
        await orm
          .update(wordChainStats)
          .set({ gamesPlayed: sql`${wordChainStats.gamesPlayed} + 1`, updatedAt: now })
          .where(and(eq(wordChainStats.chatId, chatId), eq(wordChainStats.playerId, pid)));
      }
    },

    async getPlayerStats(chatId: string, playerId: string): Promise<WordChainPlayerStatsRow | undefined> {
      const [row] = await orm
        .select()
        .from(wordChainStats)
        .where(and(eq(wordChainStats.chatId, chatId), eq(wordChainStats.playerId, playerId)))
        .limit(1);
      return row ? toStatsRow(row) : undefined;
    },

    async getLeaderboard(chatId?: string, limit = 10): Promise<LeaderboardEntry[]> {
      if (chatId) {
        const rows = await orm
          .select({
            playerId: wordChainStats.playerId,
            playerName: wordChainStats.playerName,
            chatId: wordChainStats.chatId,
            totalScore: wordChainStats.totalScore,
            wordsChained: wordChainStats.wordsChained,
            highestStreak: wordChainStats.highestStreak,
            gamesWon: wordChainStats.gamesWon,
          })
          .from(wordChainStats)
          .where(eq(wordChainStats.chatId, chatId))
          .orderBy(desc(wordChainStats.totalScore), desc(wordChainStats.highestStreak))
          .limit(limit);

        return rows.map((r, idx) => ({
          rank: idx + 1,
          playerId: r.playerId,
          playerName: r.playerName,
          chatId: r.chatId,
          totalScore: r.totalScore,
          wordsChained: r.wordsChained,
          highestStreak: r.highestStreak,
          gamesWon: r.gamesWon,
        }));
      }

      const rows = await orm
        .select({
          playerId: wordChainStats.playerId,
          playerName: sql<string>`MAX(${wordChainStats.playerName})`.as("player_name"),
          totalScore: sql<number>`SUM(${wordChainStats.totalScore})`.as("total_score"),
          wordsChained: sql<number>`SUM(${wordChainStats.wordsChained})`.as("words_chained"),
          highestStreak: sql<number>`MAX(${wordChainStats.highestStreak})`.as("highest_streak"),
          gamesWon: sql<number>`SUM(${wordChainStats.gamesWon})`.as("games_won"),
        })
        .from(wordChainStats)
        .groupBy(wordChainStats.playerId)
        .orderBy(desc(sql`SUM(${wordChainStats.totalScore})`), desc(sql`MAX(${wordChainStats.highestStreak})`))
        .limit(limit);

      return rows.map((r, idx) => ({
        rank: idx + 1,
        playerId: r.playerId,
        playerName: r.playerName,
        chatId: undefined,
        totalScore: Number(r.totalScore ?? 0),
        wordsChained: Number(r.wordsChained ?? 0),
        highestStreak: Number(r.highestStreak ?? 0),
        gamesWon: Number(r.gamesWon ?? 0),
      }));
    },
  };
}
