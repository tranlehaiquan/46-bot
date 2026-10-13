import { tool } from "ai";
import { z } from "zod";
import type { MemoryRepository } from "../db/repositories/memory.js";
import {
  detectPromptInjection,
  isMemorySafe,
  PROMPT_INJECTION_REFUSAL_MESSAGE,
} from "../llm/prompt-security.js";

const SENSITIVE_PATTERNS = [
  /\b(mật\s*khẩu|password|pass|mã\s*pin|pin\s*code)\b/i,
  /\b(số\s*tài\s*khoản|stk|tài\s*khoản\s*ngân\s*hàng|bank\s*account)\b/i,
  /\b(thẻ\s*tín\s*dụng|thẻ\s*visa|thẻ\s*mastercard|credit\s*card|cvv|cvc)\b/i,
  /\b(cccd|cmnd|căn\s*cước|chứng\s*minh\s*nhân\s*dân|citizen\s*id)\b/i,
];

export function containsSensitiveData(...texts: (string | undefined | null)[]): boolean {
  const combined = texts.filter(Boolean).join(" ");
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(combined));
}

export const SENSITIVE_DATA_REJECTION_MESSAGE =
  "Vì lý do bảo mật và riêng tư, bot không thể lưu trữ thông tin nhạy cảm như mật khẩu, tài khoản ngân hàng, số thẻ hoặc CCCD/CMND.";

export function createMemoryTools(
  repo: MemoryRepository,
  context: { chatId: string; senderName: string },
) {
  const { chatId, senderName } = context;

  const remember = tool({
    description:
      "Ghi nhớ thông tin, sở thích, thói quen hoặc đặc điểm của thành viên gia đình (ví dụ: 'Bố thích uống cà phê đen', 'Mẹ dị ứng hành tây', 'Bé Na học lớp 4'). Có thể gắn thêm điều kiện áp dụng, hành động cần tránh hoặc thời điểm hết hạn. KHÔNG dùng để lưu trữ mật khẩu hay thông tin ngân hàng.",
    inputSchema: z.object({
      subject: z.string().describe("Chủ thể của thông tin (ví dụ: 'Bố', 'Mẹ', 'Bé Na', 'Cả nhà')"),
      fact: z.string().describe("Thông tin, sở thích, thói quen hoặc đặc điểm cần nhớ"),
      category: z
        .enum(["core", "general"])
        .optional()
        .describe("Phân loại: 'core' (thông tin cốt lõi, quan trọng như dị ứng, sức khỏe, thói quen lớn) hoặc 'general' (thông tin chi tiết, thứ yếu). Mặc định là 'core'."),
      condition: z
        .string()
        .optional()
        .describe("Điều kiện, hoàn cảnh hoặc người cho phép trước khi thực hiện hành động (ví dụ: 'Khi mẹ cho phép', 'Đến khi hết đau lưng')"),
      avoidAction: z
        .string()
        .optional()
        .describe("Hành động hoặc lời nhắc bot cần TRÁNH thực hiện (ví dụ: 'Không nhắc chuyện điểm số', 'Không nhắc tập gym nặng')"),
      expiresAt: z
        .string()
        .optional()
        .describe("Thời điểm hết hiệu lực theo chuẩn ngày ISO hoặc YYYY-MM-DD (dành cho ràng buộc tạm thời)"),
    }),
    execute: async ({ subject, fact, category, condition, avoidAction, expiresAt }) => {
      if (containsSensitiveData(subject, fact, condition, avoidAction)) {
        return {
          success: false,
          message: SENSITIVE_DATA_REJECTION_MESSAGE,
        };
      }

      if (!isMemorySafe(subject, fact, condition, avoidAction)) {
        return {
          success: false,
          message: PROMPT_INJECTION_REFUSAL_MESSAGE,
        };
      }

      let parsedExpiry: number | null = null;
      if (expiresAt && expiresAt.trim()) {
        const ms = Date.parse(expiresAt.trim());
        if (!Number.isNaN(ms)) {
          parsedExpiry = ms;
        }
      }

      const memory = await repo.upsertMemory(chatId, subject, fact, senderName, category ?? "core", {
        condition,
        avoidAction,
        expiresAt: parsedExpiry,
      });

      let extraMessage = "";
      if (memory.avoidAction) extraMessage += ` Lưu ý tránh: "${memory.avoidAction}".`;
      if (memory.condition) extraMessage += ` Điều kiện: "${memory.condition}".`;

      return {
        success: true,
        subject: memory.subject,
        fact: memory.fact,
        category: memory.category,
        condition: memory.condition,
        avoidAction: memory.avoidAction,
        expiresAt: memory.expiresAt,
        message: `Đã ghi nhớ thông tin về ${memory.subject}: "${memory.fact}".${extraMessage}`,
      };
    },
  });

  const forget = tool({
    description: "Quên một thông tin hoặc chủ thể đã ghi nhớ trước đó.",
    inputSchema: z.object({
      subject: z.string().describe("Chủ thể cần quên thông tin (ví dụ: 'Bố', 'Bé Na')"),
    }),
    execute: async ({ subject }) => {
      const deleted = await repo.deleteMemory(chatId, subject);
      if (!deleted) {
        return {
          success: false,
          message: `Không tìm thấy thông tin nào về "${subject}" để xóa.`,
        };
      }
      return {
        success: true,
        message: `Đã xóa thông tin đã ghi nhớ về "${subject}".`,
      };
    },
  });

  const list_memories = tool({
    description:
      "Xem danh sách hoặc tìm kiếm các thông tin, đặc điểm, thói quen đã ghi nhớ về gia đình hoặc một thành viên cụ thể.",
    inputSchema: z.object({
      subject: z
        .string()
        .optional()
        .describe("Chủ thể cụ thể cần xem thông tin (nếu để trống sẽ hiển thị tất cả)"),
      category: z
        .enum(["core", "general"])
        .optional()
        .describe("Lọc theo phân loại: 'core' (thông tin cốt lõi) hoặc 'general' (thông tin chi tiết/thứ yếu)"),
      query: z
        .string()
        .optional()
        .describe("Từ khóa tìm kiếm nội dung thông tin hoặc chủ thể"),
    }),
    execute: async ({ subject, category, query }) => {
      const memories = await repo.listMemories(chatId, {
        subject,
        category,
        status: "active",
        query,
      });
      if (memories.length === 0) {
        return {
          success: true,
          count: 0,
          memories: [],
          message: subject
            ? `Chưa có thông tin ghi nhớ nào về "${subject}".`
            : "Chưa có thông tin ghi nhớ nào phù hợp.",
        };
      }
      return {
        success: true,
        count: memories.length,
        memories: memories.map((m) => ({
          subject: m.subject,
          fact: m.fact,
          category: m.category,
          condition: m.condition,
          avoidAction: m.avoidAction,
          expiresAt: m.expiresAt,
        })),
        message: `Đã tìm thấy ${memories.length} thông tin ghi nhớ.`,
      };
    },
  });

  const memory_book_add = tool({
    description:
      "Lưu lại một câu chuyện, kỷ niệm gia đình, hoặc cột mốc đáng nhớ vào Cuốn sổ Kỷ niệm gia đình (Memory Book). KHÔNG dùng cho mật khẩu hay thông tin nhạy cảm.",
    inputSchema: z.object({
      title: z.string().describe("Tiêu đề kỷ niệm hoặc câu chuyện (ví dụ: 'Chuyến đi Đà Lạt đầu tiên của cả nhà')"),
      story: z.string().describe("Nội dung chi tiết câu chuyện, kỷ niệm"),
      people: z
        .string()
        .optional()
        .describe("Những người tham gia kỷ niệm (ví dụ: 'Bố, Mẹ, Bé Na')"),
      happenedOn: z
        .string()
        .optional()
        .describe("Thời gian hoặc mốc thời gian diễn ra (ví dụ: '2024-06-15' hoặc 'Hè 2024')"),
    }),
    execute: async ({ title, story, people, happenedOn }) => {
      if (containsSensitiveData(title, story, people, happenedOn)) {
        return {
          success: false,
          message: SENSITIVE_DATA_REJECTION_MESSAGE,
        };
      }

      const combinedText = [title, story, people, happenedOn].filter(Boolean).join(" ");
      const check = detectPromptInjection(combinedText);
      if (check.isInjection) {
        return {
          success: false,
          message: PROMPT_INJECTION_REFUSAL_MESSAGE,
        };
      }

      const entry = await repo.addStory({
        chatId,
        title,
        story,
        people,
        happenedOn,
        createdBy: senderName,
      });

      return {
        success: true,
        id: entry.id,
        title: entry.title,
        message: `Đã lưu kỷ niệm "${entry.title}" vào Cuốn sổ Kỷ niệm gia đình!`,
      };
    },
  });

  const memory_book_search = tool({
    description:
      "Tìm kiếm các câu chuyện, kỷ niệm trong Cuốn sổ Kỷ niệm gia đình theo từ khóa, người tham gia hoặc thời gian.",
    inputSchema: z.object({
      query: z.string().describe("Từ khóa tìm kiếm (ví dụ: 'Đà Lạt', 'học bơi', 'Bé Na')"),
    }),
    execute: async ({ query }) => {
      const results = await repo.searchStories(chatId, query);
      if (results.length === 0) {
        return {
          success: true,
          count: 0,
          stories: [],
          message: `Không tìm thấy kỷ niệm nào phù hợp với từ khóa "${query}".`,
        };
      }

      return {
        success: true,
        count: results.length,
        stories: results.map((s) => ({
          id: s.id,
          title: s.title,
          story: s.story,
          people: s.people,
          happenedOn: s.happenedOn,
        })),
        message: `Đã tìm thấy ${results.length} kỷ niệm phù hợp.`,
      };
    },
  });

  const memory_search = tool({
    description:
      "Tìm kiếm tổng hợp và xếp hạng mức độ liên quan trên toàn bộ ký ức gia đình (bao gồm cả thông tin/thói quen ngắn và câu chuyện trong Sổ Kỷ niệm). Hỗ trợ tìm kiếm không dấu tiếng Việt và lọc nguồn.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Từ khóa hoặc nội dung cần tìm kiếm (ví dụ: 'cà phê', 'Đà Lạt', 'dị ứng', 'sở thích của Bố')"),
      type: z
        .enum(["all", "facts", "stories"])
        .optional()
        .describe("Phạm vi nguồn: 'all' (mặc định), 'facts' (chỉ sự kiện/thói quen ngắn), hoặc 'stories' (chỉ câu chuyện kỷ niệm)"),
      subject: z
        .string()
        .optional()
        .describe("Chủ thể cụ thể cần tìm (ví dụ: 'Bố', 'Mẹ')"),
      limit: z
        .number()
        .optional()
        .describe("Số lượng kết quả tối đa (mặc định 10)"),
    }),
    execute: async ({ query, type, subject, limit }) => {
      const results = await repo.searchAll(chatId, query, {
        type: type ?? "all",
        subject,
        limit: limit ?? 10,
      });

      if (results.length === 0) {
        return {
          success: true,
          count: 0,
          results: [],
          message: `Không tìm thấy ký ức nào phù hợp với từ khóa "${query}".`,
        };
      }

      return {
        success: true,
        count: results.length,
        results: results.map((r) => ({
          type: r.type,
          id: r.id,
          subject: r.subject,
          content: r.content,
          score: r.score,
          category: r.category,
          condition: r.condition,
          avoidAction: r.avoidAction,
          expiresAt: r.expiresAt,
          people: r.people,
          happenedOn: r.happenedOn,
        })),
        message: `Đã tìm thấy ${results.length} ký ức phù hợp (được xếp hạng theo mức độ liên quan).`,
      };
    },
  });

  return {
    remember,
    forget,
    list_memories,
    memory_book_add,
    memory_book_search,
    memory_search,
  };
}
