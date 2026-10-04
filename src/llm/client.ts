import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, stepCountIs } from "ai";
import type { MessageRow } from "../db/message-repo.js";

export const FALLBACK_ERROR_MESSAGE = "Mình chưa làm được việc này, thử lại sau nhé.";

export const DEFAULT_SYSTEM_PROMPT = `Bạn là Family Bot, trợ lý thân thiện cho nhóm chat gia đình.
- Ngôn ngữ: Mặc định trả lời bằng tiếng Việt. Nếu người dùng viết tiếng Anh, trả lời bằng tiếng Anh.
- Giọng điệu: Thân thiện, ấm áp, gần gũi như người trong gia đình, ngắn gọn, súc tích.
- Trung thực: Không bịa đặt thông tin. Nếu không biết thì nói thật là chưa biết.
- Lịch sử trò chuyện cung cấp tên người gửi để bạn hiểu ngữ cảnh và ai đang nói gì.
- Định dạng: KHÔNG dùng Markdown (không dùng **, __, ##, *, _, ~~ hay bất kỳ ký hiệu định dạng nào). Zalo chỉ hiển thị văn bản thuần. Dùng số thứ tự (1. 2. 3.) hoặc gạch đầu dòng thường (•) để liệt kê. Dùng emoji để nhấn mạnh nếu cần.
- Quản lý danh sách: Khi gia đình yêu cầu tạo, thêm món/việc, đánh dấu xong/chưa xong, xóa hoặc xem danh sách (đi chợ, việc nhà, đồ đi du lịch...), hãy gọi các công cụ tương ứng (list_create, list_add_item, list_check_item, list_remove_item, list_show).
- Khi hiển thị danh sách, hãy trình bày rõ ràng, dễ nhìn, dùng ký hiệu [ ] cho món chưa xong và [x] cho món đã xong.
- Tìm kiếm web: Khi cần thông tin thời gian thực (tin tức, sự kiện, thời tiết, giá cả...), hãy gọi công cụ web_search với câu truy vấn phù hợp rồi tổng hợp kết quả thành câu trả lời ngắn gọn, kèm nguồn nếu cần.`;

export function buildSystemPrompt(basePrompt = DEFAULT_SYSTEM_PROMPT, now = new Date()): string {
  const formattedTime = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "full",
    timeStyle: "medium",
  }).format(now);

  return `${basePrompt}\n- Thời gian hiện tại (Việt Nam, GMT+7): ${formattedTime}.`;
}

export type ToolSet = NonNullable<Parameters<typeof generateText>[0]["tools"]>;

export interface LlmClient {
  generateReply(params: {
    systemPrompt?: string;
    history: MessageRow[];
    incomingMessage: {
      senderId: string;
      senderName: string;
      content: string;
    };
    tools?: ToolSet;
  }): Promise<string>;
}

export type LlmClientOptions = {
  provider?: "gemini" | "deepseek";
  apiKey: string;
  modelName: string;
};

export function createLlmClient(options: LlmClientOptions): LlmClient {
  const model =
    options.provider === "gemini"
      ? createGoogleGenerativeAI({ apiKey: options.apiKey })(options.modelName)
      : createDeepSeek({ apiKey: options.apiKey })(options.modelName);

  return {
    async generateReply(params): Promise<string> {
      const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

      for (const msg of params.history) {
        if (msg.role === "assistant") {
          messages.push({
            role: "assistant",
            content: msg.content,
          });
        } else {
          const sender = msg.senderName ? `${msg.senderName}` : msg.senderId;
          messages.push({
            role: "user",
            content: `${sender}: ${msg.content}`,
          });
        }
      }

      const currentSender = params.incomingMessage.senderName
        ? `${params.incomingMessage.senderName}`
        : params.incomingMessage.senderId;

      messages.push({
        role: "user",
        content: `${currentSender}: ${params.incomingMessage.content}`,
      });

      const system = buildSystemPrompt(params.systemPrompt ?? DEFAULT_SYSTEM_PROMPT);

      const result = await generateText({
        model,
        system,
        messages,
        tools: params.tools,
        stopWhen: stepCountIs(4),
      });

      return result.text.trim();
    },
  };
}
