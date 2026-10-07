import type { SqliteDatabase } from "../connection.js";

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

function mapSessionRow(row: any): WordChainSessionRow {
  return {
    id: Number(row.id),
    chatId: String(row.chat_id ?? row.chatId),
    status: (row.status as WordChainSessionStatus),
    currentWord: String(row.current_word ?? row.currentWord),
    starterWord: String(row.starter_word ?? row.starterWord),
    totalWords: Number(row.total_words ?? row.totalWords ?? 0),
    startedAt: Number(row.started_at ?? row.startedAt),
    endedAt: row.ended_at || row.endedAt ? Number(row.ended_at ?? row.endedAt) : undefined,
    updatedAt: Number(row.updated_at ?? row.updatedAt),
  };
}

function mapHistoryRow(row: any): WordChainHistoryRow {
  return {
    id: Number(row.id),
    sessionId: Number(row.session_id ?? row.sessionId),
    chatId: String(row.chat_id ?? row.chatId),
    word: String(row.word),
    playerId: String(row.player_id ?? row.playerId),
    playerName: String(row.player_name ?? row.playerName),
    turnIndex: Number(row.turn_index ?? row.turnIndex),
    points: Number(row.points ?? 1),
    createdAt: Number(row.created_at ?? row.createdAt),
  };
}

function mapStatsRow(row: any): WordChainPlayerStatsRow {
  return {
    id: Number(row.id),
    chatId: String(row.chat_id ?? row.chatId),
    playerId: String(row.player_id ?? row.playerId),
    playerName: String(row.player_name ?? row.playerName),
    totalScore: Number(row.total_score ?? row.totalScore ?? 0),
    wordsChained: Number(row.words_chained ?? row.wordsChained ?? 0),
    highestStreak: Number(row.highest_streak ?? row.highestStreak ?? 0),
    gamesPlayed: Number(row.games_played ?? row.gamesPlayed ?? 0),
    gamesWon: Number(row.games_won ?? row.gamesWon ?? 0),
    updatedAt: Number(row.updated_at ?? row.updatedAt),
  };
}

export function createWordChainRepository(db: SqliteDatabase): WordChainRepository {
  return {
    async getActiveSession(chatId: string): Promise<WordChainSessionRow | undefined> {
      const res = await db.execute({
        sql: `SELECT id, chat_id, status, current_word, starter_word, total_words, started_at, ended_at, updated_at
              FROM word_chain_sessions
              WHERE chat_id = ? AND status = 'active'
              ORDER BY id DESC LIMIT 1`,
        args: [chatId],
      });
      return res.rows[0] ? mapSessionRow(res.rows[0]) : undefined;
    },

    async getSessionById(id: number): Promise<WordChainSessionRow | undefined> {
      const res = await db.execute({
        sql: `SELECT id, chat_id, status, current_word, starter_word, total_words, started_at, ended_at, updated_at
              FROM word_chain_sessions
              WHERE id = ?`,
        args: [id],
      });
      return res.rows[0] ? mapSessionRow(res.rows[0]) : undefined;
    },

    async createSession(chatId: string, starterWord: string): Promise<WordChainSessionRow> {
      const now = Date.now();
      // First, cancel any lingering active sessions for this chat
      await db.execute({
        sql: `UPDATE word_chain_sessions
              SET status = 'timed_out', ended_at = ?, updated_at = ?
              WHERE chat_id = ? AND status = 'active'`,
        args: [now, now, chatId],
      });

      const res = await db.execute({
        sql: `INSERT INTO word_chain_sessions (chat_id, status, current_word, starter_word, total_words, started_at, updated_at)
              VALUES (?, 'active', ?, ?, 0, ?, ?)
              RETURNING id, chat_id, status, current_word, starter_word, total_words, started_at, ended_at, updated_at`,
        args: [chatId, starterWord, starterWord, now, now],
      });

      return mapSessionRow(res.rows[0]);
    },

    async updateSessionWord(sessionId: number, currentWord: string, totalWords: number): Promise<void> {
      const now = Date.now();
      await db.execute({
        sql: `UPDATE word_chain_sessions
              SET current_word = ?, total_words = ?, updated_at = ?
              WHERE id = ?`,
        args: [currentWord, totalWords, now, sessionId],
      });
    },

    async endSession(sessionId: number, status: "finished" | "timed_out"): Promise<void> {
      const now = Date.now();
      await db.execute({
        sql: `UPDATE word_chain_sessions
              SET status = ?, ended_at = ?, updated_at = ?
              WHERE id = ?`,
        args: [status, now, now, sessionId],
      });
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
      const now = Date.now();
      await db.execute({
        sql: `INSERT INTO word_chain_history (session_id, chat_id, word, player_id, player_name, turn_index, points, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          input.sessionId,
          input.chatId,
          input.word,
          input.playerId,
          input.playerName,
          input.turnIndex,
          input.points,
          now,
        ],
      });
    },

    async getSessionWords(sessionId: number): Promise<string[]> {
      const res = await db.execute({
        sql: `SELECT word FROM word_chain_history
              WHERE session_id = ?
              ORDER BY turn_index ASC`,
        args: [sessionId],
      });
      return res.rows.map((r: any) => String(r.word));
    },

    async getSessionHistory(sessionId: number): Promise<WordChainHistoryRow[]> {
      const res = await db.execute({
        sql: `SELECT id, session_id, chat_id, word, player_id, player_name, turn_index, points, created_at
              FROM word_chain_history
              WHERE session_id = ?
              ORDER BY turn_index ASC`,
        args: [sessionId],
      });
      return res.rows.map(mapHistoryRow);
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
        await db.execute({
          sql: `INSERT INTO word_chain_stats (
                  chat_id, player_id, player_name, total_score, words_chained,
                  highest_streak, games_played, games_won, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          args: [
            input.chatId,
            input.playerId,
            input.playerName,
            input.pointsAdded,
            input.wordsAdded,
            input.currentStreak,
            input.wonGame ? 1 : 0,
            now,
          ],
        });
      } else {
        const newScore = existing.totalScore + input.pointsAdded;
        const newWords = existing.wordsChained + input.wordsAdded;
        const newHighestStreak = Math.max(existing.highestStreak, input.currentStreak);
        const newGamesWon = existing.gamesWon + (input.wonGame ? 1 : 0);

        await db.execute({
          sql: `UPDATE word_chain_stats
                SET player_name = ?,
                    total_score = ?,
                    words_chained = ?,
                    highest_streak = ?,
                    games_won = ?,
                    updated_at = ?
                WHERE chat_id = ? AND player_id = ?`,
          args: [
            input.playerName,
            newScore,
            newWords,
            newHighestStreak,
            newGamesWon,
            now,
            input.chatId,
            input.playerId,
          ],
        });
      }
    },

    async incrementGamesPlayed(chatId: string, playerIds: string[]): Promise<void> {
      if (playerIds.length === 0) return;
      const now = Date.now();
      for (const pid of playerIds) {
        await db.execute({
          sql: `UPDATE word_chain_stats
                SET games_played = games_played + 1, updated_at = ?
                WHERE chat_id = ? AND player_id = ?`,
          args: [now, chatId, pid],
        });
      }
    },

    async getPlayerStats(chatId: string, playerId: string): Promise<WordChainPlayerStatsRow | undefined> {
      const res = await db.execute({
        sql: `SELECT id, chat_id, player_id, player_name, total_score, words_chained,
                     highest_streak, games_played, games_won, updated_at
              FROM word_chain_stats
              WHERE chat_id = ? AND player_id = ?`,
        args: [chatId, playerId],
      });
      return res.rows[0] ? mapStatsRow(res.rows[0]) : undefined;
    },

    async getLeaderboard(chatId?: string, limit = 10): Promise<LeaderboardEntry[]> {
      let res;
      if (chatId) {
        res = await db.execute({
          sql: `SELECT player_id, player_name, chat_id, total_score, words_chained, highest_streak, games_won
                FROM word_chain_stats
                WHERE chat_id = ?
                ORDER BY total_score DESC, highest_streak DESC
                LIMIT ?`,
          args: [chatId, limit],
        });
      } else {
        // Global leaderboard across all channels (aggregate per player_id)
        res = await db.execute({
          sql: `SELECT player_id, MAX(player_name) as player_name,
                       SUM(total_score) as total_score,
                       SUM(words_chained) as words_chained,
                       MAX(highest_streak) as highest_streak,
                       SUM(games_won) as games_won
                FROM word_chain_stats
                GROUP BY player_id
                ORDER BY total_score DESC, highest_streak DESC
                LIMIT ?`,
          args: [limit],
        });
      }

      return res.rows.map((r: any, idx: number) => ({
        rank: idx + 1,
        playerId: String(r.player_id ?? r.playerId),
        playerName: String(r.player_name ?? r.playerName),
        chatId: r.chat_id ? String(r.chat_id) : undefined,
        totalScore: Number(r.total_score ?? 0),
        wordsChained: Number(r.words_chained ?? 0),
        highestStreak: Number(r.highest_streak ?? 0),
        gamesWon: Number(r.games_won ?? 0),
      }));
    },
  };
}
