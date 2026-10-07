import { tool } from "ai";
import { z } from "zod";
import type { WordChainService } from "../word-chain/service.js";
import type { WordChainRepository } from "../db/repositories/word-chain.js";

export function createWordChainTools(
  service: WordChainService,
  repo: WordChainRepository,
  context: { chatId: string; senderId: string; senderName: string }
) {
  const { chatId, senderId, senderName } = context;

  const word_chain_start = tool({
    description:
      "Bắt đầu một ván chơi Nối Chữ (từ ghép 2 tiếng tiếng Việt) trong phòng/nhóm chat hiện tại, hoặc xem từ hiện tại nếu đang chơi.",
    inputSchema: z.object({
      starterWord: z
        .string()
        .optional()
        .describe("Từ khởi đầu (cụm 2 tiếng), bỏ trống để bot tự chọn ngẫu nhiên."),
    }),
    execute: async ({ starterWord }) => {
      const result = await service.startGame(chatId, starterWord);
      return {
        success: true,
        alreadyActive: Boolean(result.alreadyActive),
        starterWord: result.starterWord,
        message: result.message,
      };
    },
  });

  const word_chain_stop = tool({
    description:
      "Dừng ván chơi Nối Chữ đang diễn ra trong phòng chat này và hiển thị tổng kết kết quả/điểm số.",
    inputSchema: z.object({}),
    execute: async () => {
      const result = await service.stopGame(chatId);
      return {
        success: Boolean(result.session),
        message: result.message,
      };
    },
  });

  const word_chain_leaderboard = tool({
    description:
      "Xem bảng xếp hạng người chơi Nối Chữ (theo nhóm hoặc toàn hệ thống).",
    inputSchema: z.object({
      isGlobal: z
        .boolean()
        .optional()
        .default(false)
        .describe("true để xem bảng xếp hạng toàn hệ thống, false để xem trong nhóm hiện tại."),
    }),
    execute: async ({ isGlobal }) => {
      const entries = await repo.getLeaderboard(isGlobal ? undefined : chatId, 10);
      const text = service.formatLeaderboard(entries, isGlobal);
      return {
        success: true,
        leaderboard: entries,
        message: text,
      };
    },
  });

  const word_chain_stats = tool({
    description: "Xem thống kê điểm số và chuỗi kỷ lục cá nhân của người dùng trong trò chơi Nối Chữ.",
    inputSchema: z.object({}),
    execute: async () => {
      const stats = await repo.getPlayerStats(chatId, senderId);
      if (!stats) {
        return {
          success: true,
          message: `Bạn chưa tham gia ván nối chữ nào trong nhóm này. Hãy bắt đầu bằng '!noichu' nhé!`,
        };
      }
      return {
        success: true,
        stats,
        message: service.formatPlayerStats(stats),
      };
    },
  });

  return {
    word_chain_start,
    word_chain_stop,
    word_chain_leaderboard,
    word_chain_stats,
  };
}
