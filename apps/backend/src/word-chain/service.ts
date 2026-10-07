import type {
  LeaderboardEntry,
  WordChainHistoryRow,
  WordChainPlayerStatsRow,
  WordChainRepository,
  WordChainSessionRow,
} from "../db/repositories/word-chain.js";
import {
  defaultDictionary,
  matchesChain,
  normalizePhrase,
  splitSyllables,
  WordChainDictionary,
} from "./dictionary.js";

export type WordChainTurnStatus =
  | "valid"
  | "not_active"
  | "not_two_syllables"
  | "invalid_chain"
  | "not_in_dictionary"
  | "already_used";

export type WordChainTurnResult = {
  status: WordChainTurnStatus;
  message: string;
  word?: string;
  previousWord?: string;
  nextRequiredSyllable?: string;
  pointsAwarded?: number;
  playerStreak?: number;
  totalWords?: number;
  session?: WordChainSessionRow;
};

export type TimeoutCallback = (chatId: string, message: string) => Promise<void> | void;

export interface WordChainServiceOptions {
  repo: WordChainRepository;
  dictionary?: WordChainDictionary;
  turnTimeoutMs?: number; // default: 60,000ms (60s)
  onTimeout?: TimeoutCallback;
}

export class WordChainService {
  private repo: WordChainRepository;
  private dict: WordChainDictionary;
  private turnTimeoutMs: number;
  private onTimeout?: TimeoutCallback;
  private timeoutTimers = new Map<string, NodeJS.Timeout>();
  // In-memory streak tracking per session: Map<chatId, { lastPlayerId: string; streak: number }>
  private playerStreaks = new Map<string, { lastPlayerId: string; streak: number }>();

  constructor(options: WordChainServiceOptions) {
    this.repo = options.repo;
    this.dict = options.dictionary ?? defaultDictionary;
    this.turnTimeoutMs = options.turnTimeoutMs ?? 60_000;
    this.onTimeout = options.onTimeout;
  }

  public setTimeoutCallback(cb: TimeoutCallback): void {
    this.onTimeout = cb;
  }

  public async getActiveGame(chatId: string): Promise<WordChainSessionRow | undefined> {
    return this.repo.getActiveSession(chatId);
  }

  /**
   * Starts a new word chain game in the specified chat.
   */
  public async startGame(
    chatId: string,
    customStarterWord?: string
  ): Promise<{
    session: WordChainSessionRow;
    starterWord: string;
    message: string;
    alreadyActive?: boolean;
  }> {
    const existing = await this.repo.getActiveSession(chatId);
    if (existing) {
      const parts = splitSyllables(existing.currentWord);
      const nextWordPrompt = parts ? parts[1] : existing.currentWord;
      return {
        session: existing,
        starterWord: existing.currentWord,
        message: `Trò chơi nối chữ đang diễn ra! Từ hiện tại là: "${existing.currentWord}". Từ tiếp theo phải bắt đầu bằng chữ "${nextWordPrompt}".`,
        alreadyActive: true,
      };
    }

    let starter = customStarterWord ? normalizePhrase(customStarterWord) : "";
    if (!starter || !this.dict.isValidWord(starter)) {
      starter = this.dict.getRandomStartingWord();
    }

    const session = await this.repo.createSession(chatId, starter);
    const starterParts = splitSyllables(starter)!;
    const requiredFirst = starterParts[1];

    this.playerStreaks.delete(chatId);
    this.armTimeout(chatId, session.id);

    return {
      session,
      starterWord: starter,
      message: `🎮 Bắt đầu trò chơi Nối Chữ!\nTừ khởi đầu: **${starter}**\n➡️ Lượt tiếp theo cần từ 2 tiếng bắt đầu bằng chữ: **${requiredFirst}** (Thời gian: ${Math.round(
        this.turnTimeoutMs / 1000
      )}s). Cố lên nào!`,
      alreadyActive: false,
    };
  }

  /**
   * Plays a turn in the active game.
   */
  public async playTurn(
    chatId: string,
    playerId: string,
    playerName: string,
    wordText: string
  ): Promise<WordChainTurnResult> {
    const session = await this.repo.getActiveSession(chatId);
    if (!session) {
      return {
        status: "not_active",
        message: "Hiện tại không có trò chơi nối chữ nào đang diễn ra. Gõ '!noichu' để bắt đầu nhé!",
      };
    }

    const normalized = normalizePhrase(wordText);
    const syllables = splitSyllables(normalized);
    if (!syllables) {
      return {
        status: "not_two_syllables",
        message: `"${wordText}" không hợp lệ! Nối chữ yêu cầu cụm từ gồm đúng 2 tiếng (từ ghép tiếng Việt).`,
      };
    }

    // Check chain continuation
    if (!matchesChain(session.currentWord, normalized)) {
      const prevParts = splitSyllables(session.currentWord);
      const expectedSyllable = prevParts ? prevParts[1] : "";
      return {
        status: "invalid_chain",
        previousWord: session.currentWord,
        nextRequiredSyllable: expectedSyllable,
        message: `Sai rồi! Từ "${normalized}" không bắt đầu bằng chữ "${expectedSyllable}". Từ hiện tại là "${session.currentWord}".`,
      };
    }

    // Check dictionary
    if (!this.dict.isValidWord(normalized)) {
      return {
        status: "not_in_dictionary",
        word: normalized,
        message: `Từ "${normalized}" không có trong từ điển tiếng Việt của bot hoặc không phải từ ghép thông dụng. Thử từ khác xem!`,
      };
    }

    // Check duplicate in current session
    const playedWords = await this.repo.getSessionWords(session.id);
    const usedWords = new Set(playedWords.map((w) => normalizePhrase(w)));
    usedWords.add(normalizePhrase(session.starterWord));

    if (usedWords.has(normalized)) {
      return {
        status: "already_used",
        word: normalized,
        message: `Từ "${normalized}" đã được sử dụng trong ván này rồi! Vui lòng tìm từ khác nhé.`,
      };
    }

    // Calculate streak and points
    const streakInfo = this.playerStreaks.get(chatId) || { lastPlayerId: "", streak: 0 };
    let currentStreak = 1;
    if (streakInfo.lastPlayerId === playerId) {
      currentStreak = streakInfo.streak + 1;
    }
    this.playerStreaks.set(chatId, { lastPlayerId: playerId, streak: currentStreak });

    // Scoring: 1 base point + streak bonus (1 extra point every 2 consecutive turns)
    const streakBonus = Math.floor(currentStreak / 2);
    const pointsAwarded = 1 + streakBonus;

    const newTotalWords = session.totalWords + 1;

    // Record turn history and update session
    await this.repo.recordWordHistory({
      sessionId: session.id,
      chatId,
      word: normalized,
      playerId,
      playerName,
      turnIndex: newTotalWords,
      points: pointsAwarded,
    });

    await this.repo.updateSessionWord(session.id, normalized, newTotalWords);

    // Update player cumulative stats
    await this.repo.updatePlayerStats({
      chatId,
      playerId,
      playerName,
      pointsAdded: pointsAwarded,
      wordsAdded: 1,
      currentStreak,
    });

    // Reset turn inactivity timer
    this.armTimeout(chatId, session.id);

    const nextRequired = syllables[1];
    let replyMsg = `✅ **${playerName}** nối từ thành công: **${normalized}** (+${pointsAwarded}đ)`;
    if (currentStreak >= 3) {
      replyMsg += ` 🔥 Chuỗi ${currentStreak}!`;
    }
    replyMsg += `\n➡️ Tiếp theo bắt đầu bằng chữ: **${nextRequired}** (Tổng: ${newTotalWords} từ)`;

    return {
      status: "valid",
      word: normalized,
      previousWord: session.currentWord,
      nextRequiredSyllable: nextRequired,
      pointsAwarded,
      playerStreak: currentStreak,
      totalWords: newTotalWords,
      message: replyMsg,
    };
  }

  /**
   * Stops an active game voluntarily.
   */
  public async stopGame(chatId: string): Promise<{
    session?: WordChainSessionRow;
    summary?: string;
    message: string;
  }> {
    const session = await this.repo.getActiveSession(chatId);
    if (!session) {
      return {
        message: "Không có ván nối chữ nào đang diễn ra trong phòng này.",
      };
    }

    this.clearTimeoutTimer(chatId);
    this.playerStreaks.delete(chatId);

    await this.repo.endSession(session.id, "finished");
    const history = await this.repo.getSessionHistory(session.id);
    const summary = this.formatRoundSummary(session, history);

    return {
      session,
      summary,
      message: `🛑 Đã dừng trò chơi nối chữ!\n\n${summary}`,
    };
  }

  /**
   * Timeout handler when players take too long.
   */
  public async handleTimeout(chatId: string, sessionId: number): Promise<string | undefined> {
    const session = await this.repo.getSessionById(sessionId);
    if (!session || session.status !== "active") {
      return undefined;
    }

    this.clearTimeoutTimer(chatId);
    this.playerStreaks.delete(chatId);

    await this.repo.endSession(sessionId, "timed_out");
    const history = await this.repo.getSessionHistory(sessionId);
    const summary = this.formatRoundSummary(session, history);

    const msg = `⏰ Hết giờ! Ván nối chữ kết thúc do không có ai trả lời kịp.\nTừ cuối cùng là: "${session.currentWord}".\n\n${summary}`;

    if (this.onTimeout) {
      await this.onTimeout(chatId, msg);
    }

    return msg;
  }

  /**
   * Generates a round summary string from session and history.
   */
  public formatRoundSummary(session: WordChainSessionRow, history: WordChainHistoryRow[]): string {
    const totalWords = history.length;
    if (totalWords === 0) {
      return `Chưa có từ nào được nối thêm (Khởi đầu: "${session.starterWord}").`;
    }

    const playerScores = new Map<string, { name: string; score: number; words: number }>();
    for (const item of history) {
      const cur = playerScores.get(item.playerId) || { name: item.playerName, score: 0, words: 0 };
      cur.score += item.points;
      cur.words += 1;
      playerScores.set(item.playerId, cur);
    }

    const sortedPlayers = Array.from(playerScores.values()).sort((a, b) => b.score - a.score);
    const playerLines = sortedPlayers.map(
      (p, i) => `${i + 1}. **${p.name}**: ${p.score} điểm (${p.words} từ)`
    );

    return [
      `📊 **Tổng kết ván đấu:**`,
      `• Tổng số từ đã nối: ${totalWords}`,
      `• Từ khởi đầu: ${session.starterWord}`,
      `• Từ kết thúc: ${session.currentWord}`,
      `• Xếp hạng ván:`,
      ...playerLines,
    ].join("\n");
  }

  /**
   * Formats leaderboard into a user-friendly string.
   */
  public formatLeaderboard(entries: LeaderboardEntry[], isGlobal = false): string {
    if (entries.length === 0) {
      return "🏆 Bảng xếp hạng Nối Chữ hiện chưa có dữ liệu. Hãy bắt đầu ván đầu tiên bằng '!noichu' nhé!";
    }

    const title = isGlobal
      ? "🏆 **BẢNG XẾP HẠNG NỐI CHỮ TOÀN HỆ THỐNG**"
      : "🏆 **BẢNG XẾP HẠNG NỐI CHỮ (NHÓM)**";

    const medals = ["🥇", "🥈", "🥉"];
    const lines = entries.map((e) => {
      const badge = medals[e.rank - 1] || `#${e.rank}`;
      return `${badge} **${e.playerName}**: ${e.totalScore} điểm | ${e.wordsChained} từ | Chuỗi cao nhất: ${e.highestStreak}`;
    });

    return [title, "", ...lines].join("\n");
  }

  /**
   * Formats personal player stats into a user-friendly message.
   */
  public formatPlayerStats(stats: WordChainPlayerStatsRow): string {
    return [
      `🎖️ **Thống kê Nối Chữ của ${stats.playerName}:**`,
      `• Tổng điểm: **${stats.totalScore}**`,
      `• Tổng số từ đã nối: **${stats.wordsChained}**`,
      `• Chuỗi kỷ lục: **${stats.highestStreak}** từ liên tiếp`,
      `• Số ván chiến thắng: **${stats.gamesWon}**`,
    ].join("\n");
  }

  /**
   * Arm turn timeout.
   */
  private armTimeout(chatId: string, sessionId: number): void {
    this.clearTimeoutTimer(chatId);
    const timer = setTimeout(() => {
      this.handleTimeout(chatId, sessionId).catch((err) => {
        console.error(`Error in word chain timeout handler for chat ${chatId}:`, err);
      });
    }, this.turnTimeoutMs);

    // Allow process to exit in tests
    if (timer.unref) {
      timer.unref();
    }

    this.timeoutTimers.set(chatId, timer);
  }

  private clearTimeoutTimer(chatId: string): void {
    const existing = this.timeoutTimers.get(chatId);
    if (existing) {
      clearTimeout(existing);
      this.timeoutTimers.delete(chatId);
    }
  }

  public dispose(): void {
    for (const timer of this.timeoutTimers.values()) {
      clearTimeout(timer);
    }
    this.timeoutTimers.clear();
  }
}
