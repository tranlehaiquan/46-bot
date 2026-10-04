import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText } from "ai";
import type { MessageRow } from "../db/message-repo.js";

export const FALLBACK_ERROR_MESSAGE = "Mình chưa làm được việc này, thử lại sau nhé.";

export const DEFAULT_SYSTEM_PROMPT = `Bạn là Family Bot, trợ lý thân thiện cho nhóm chat gia đình.
- Ngôn ngữ: Mặc định trả lời bằng tiếng Việt. Nếu người dùng viết tiếng Anh, trả lời bằng tiếng Anh.
- Giọng điệu: Thân thiện, ấm áp, gần gũi như người trong gia đình, ngắn gọn, súc tích.
- Trung thực: Không bịa đặt thông tin. Nếu không biết thì nói thật là chưa biết.
- Lịch sử trò chuyện cung cấp tên người gửi để bạn hiểu ngữ cảnh và ai đang nói gì.`;

export interface LlmClient {
  generateReply(params: {
    systemPrompt?: string;
    history: MessageRow[];
    incomingMessage: {
      senderId: string;
      senderName: string;
      content: string;
    };
  }): Promise<string>;
}

export function createLlmClient(options: {
  apiKey: string;
  modelName: string;
}): LlmClient {
  const deepseek = createDeepSeek({ apiKey: options.apiKey });
  const model = deepseek(options.modelName);

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

      const result = await generateText({
        model,
        system: params.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        messages,
      });

      return result.text.trim();
    },
  };
}
