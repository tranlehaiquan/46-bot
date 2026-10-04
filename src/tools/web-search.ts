import { tavily } from "@tavily/core";
import { tool } from "ai";
import { z } from "zod";

export function createWebSearchTool(tavilyApiKey: string) {
  const client = tavily({ apiKey: tavilyApiKey });

  const web_search = tool({
    description:
      "Tìm kiếm thông tin trên Internet theo thời gian thực. Dùng khi cần thông tin mới nhất về tin tức, sự kiện, thời tiết, giá cả, hay bất kỳ chủ đề nào mà dữ liệu có thể thay đổi.",
    inputSchema: z.object({
      query: z.string().describe("Câu truy vấn tìm kiếm bằng tiếng Việt hoặc tiếng Anh"),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(5)
        .default(3)
        .describe("Số kết quả tối đa cần trả về (1–5, mặc định 3)"),
    }),
    execute: async ({ query, maxResults }) => {
      const response = await client.search(query, {
        maxResults: maxResults ?? 3,
        includeAnswer: true,
      });

      const results = response.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
      }));

      return {
        answer: response.answer ?? null,
        results,
        query,
      };
    },
  });

  return { web_search };
}
