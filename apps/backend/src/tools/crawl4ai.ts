import { tool } from "ai";
import { z } from "zod";
import { validateSafeUrl, type LookupFn } from "../security/ssrf.js";
import { formatUntrustedContentTag } from "../llm/prompt-security.js";

export interface Crawl4AiClientOptions {
  apiToken: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  lookupFn?: LookupFn;
}

export const MAX_CRAWL_CONTENT_LENGTH = 20000;

export async function scrapeUrlWithCrawl4Ai(
  url: string,
  options: Crawl4AiClientOptions,
): Promise<{
  url: string;
  title?: string;
  markdown: string;
  truncated: boolean;
}> {
  const token = options.apiToken ? options.apiToken.trim() : "";
  if (!token) {
    throw new Error("Crawl4AI API token is not configured.");
  }

  const safeUrl = await validateSafeUrl(url, options.lookupFn);
  const targetUrl = safeUrl.toString();

  const baseUrl = options.baseUrl || "https://api.crawl4ai.com";
  const fetchFn = options.fetchFn || fetch;

  const response = await fetchFn(`${baseUrl}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: targetUrl }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Crawl4AI request failed (${response.status}): ${errorText || response.statusText}`);
  }

  const data = (await response.json()) as any;
  let markdown =
    typeof data.markdown === "string"
      ? data.markdown
      : typeof data.content === "string"
        ? data.content
        : (data.text || JSON.stringify(data));
  const title = data.metadata?.title || data.title || undefined;

  let truncated = false;
  if (markdown.length > MAX_CRAWL_CONTENT_LENGTH) {
    markdown = `${markdown.slice(0, MAX_CRAWL_CONTENT_LENGTH)}\n\n...[Nội dung trang web quá dài và đã được cắt bớt]`;
    truncated = true;
  }

  return {
    url,
    title,
    markdown,
    truncated,
  };
}

export function createCrawl4AiTool(
  crawl4aiApiToken: string,
  fetchFn?: typeof fetch,
  lookupFn?: LookupFn,
) {
  const scrape_url = tool({
    description:
      "Đọc và thu thập nội dung chi tiết từ một đường link (URL) trang web bằng Crawl4AI. Dùng khi người dùng gửi một liên kết và muốn tóm tắt, tìm thông tin cụ thể, hoặc đọc nội dung bài viết trên trang web đó.",
    inputSchema: z.object({
      url: z.string().url().describe("Đường dẫn trang web cần đọc (ví dụ: https://example.com/...)"),
    }),
    execute: async ({ url }) => {
      try {
        const result = await scrapeUrlWithCrawl4Ai(url, {
          apiToken: crawl4aiApiToken,
          fetchFn,
          lookupFn,
        });
        const safeContent = formatUntrustedContentTag(
          "web_scrape",
          result.markdown,
          result.url,
        );
        return {
          success: true,
          url: result.url,
          title: result.title,
          content: safeContent,
          truncated: result.truncated,
        };
      } catch (error: any) {
        return {
          success: false,
          url,
          error: error.message || "Failed to scrape URL",
        };
      }
    },
  });

  return { scrape_url };
}
