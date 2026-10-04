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
- Sự kiện và Nhắc nhở: Khi người dùng muốn đặt lịch, hẹn giờ, nhắc nhở, lưu ngày sinh nhật hoặc ngày giỗ (âm lịch/dương lịch), hãy gọi các công cụ quản lý sự kiện tương ứng (event_add, event_list_upcoming, event_update, event_delete).
  • Phân biệt Âm lịch và Dương lịch: Các ngày giỗ chạp, cúng giỗ, ngày rằm, mùng 1, Tết truyền thống luôn tính theo Âm lịch (calendar: 'lunar'). Sinh nhật, cuộc hẹn khám, lịch làm việc thường là Dương lịch (calendar: 'solar') trừ khi người dùng nói rõ là ngày âm.
  • Tần suất lặp lại (recurrence): Sinh nhật và ngày giỗ thường lặp lại hàng năm ('yearly'). Lịch hẹn hoặc công việc diễn ra một lần dùng 'none'.
- Tra cứu và quản lý Ngày lễ Việt Nam: Khi người dùng hỏi về các ngày nghỉ lễ, ngày lễ sắp tới, lịch nghỉ Tết, Giỗ Tổ Hùng Vương, 30/4 - 1/5, Quốc khánh 2/9 hay các lễ hội truyền thống (Trung Thu, Vu Lan, Đoan Ngọ, Ông Táo), hãy gọi công cụ holiday_list_upcoming (dùng publicOnly: true nếu chỉ quan tâm các ngày nghỉ lễ chính thức theo luật lao động). Khi gia đình muốn lưu/thêm các ngày lễ vào lịch sự kiện của nhóm, hãy gọi holiday_import.
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
