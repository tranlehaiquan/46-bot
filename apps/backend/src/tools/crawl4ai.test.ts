import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  scrapeUrlWithCrawl4Ai,
  createCrawl4AiTool,
  MAX_CRAWL_CONTENT_LENGTH,
} from "./crawl4ai.js";

describe("Crawl4AI Tool", () => {
  it("throws when token is missing", async () => {
    await assert.rejects(
      async () => {
        await scrapeUrlWithCrawl4Ai("https://example.com", { apiToken: "" });
      },
      { message: "Crawl4AI API token is not configured." }
    );
  });

  it("scrapes URL successfully and returns markdown and metadata", async () => {
    const fakeFetch: typeof fetch = async (input, init) => {
      assert.equal(String(input), "https://api.crawl4ai.com/scrape");
      assert.equal(init?.method, "POST");
      const headers = init?.headers as Record<string, string>;
      assert.equal(headers["Authorization"], "Bearer c4ai-token-123");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.url, "https://example.com/article");

      return new Response(
        JSON.stringify({
          markdown: "# Example Article\nThis is sample scraped markdown content.",
          metadata: { title: "Example Article" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const res = await scrapeUrlWithCrawl4Ai("https://example.com/article", {
      apiToken: "c4ai-token-123",
      fetchFn: fakeFetch,
    });

    assert.equal(res.url, "https://example.com/article");
    assert.equal(res.title, "Example Article");
    assert.match(res.markdown, /Example Article/);
    assert.equal(res.truncated, false);
  });

  it("truncates content exceeding maximum length", async () => {
    const longContent = "A".repeat(MAX_CRAWL_CONTENT_LENGTH + 500);

    const fakeFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          markdown: longContent,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const res = await scrapeUrlWithCrawl4Ai("https://example.com/long", {
      apiToken: "c4ai-token-123",
      fetchFn: fakeFetch,
    });

    assert.equal(res.truncated, true);
    assert.match(res.markdown, /cắt bớt/);
    assert.ok(res.markdown.length < MAX_CRAWL_CONTENT_LENGTH + 200);
  });

  it("throws structured error when remote API returns failure status", async () => {
    const fakeFetch: typeof fetch = async () => {
      return new Response("Forbidden page", { status: 403, statusText: "Forbidden" });
    };

    await assert.rejects(
      async () => {
        await scrapeUrlWithCrawl4Ai("https://example.com/forbidden", {
          apiToken: "c4ai-token-123",
          fetchFn: fakeFetch,
        });
      },
      /Crawl4AI request failed \(403\)/
    );
  });

  it("createCrawl4AiTool wraps scrape_url tool and handles execution", async () => {
    const fakeFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          markdown: "## Title\nHello world",
          metadata: { title: "Title" },
        }),
        { status: 200 }
      );
    };

    const { scrape_url } = createCrawl4AiTool("c4ai-valid-token", fakeFetch);
    const output = await (scrape_url as any).execute({ url: "https://example.com" });

    assert.equal(output.success, true);
    assert.equal(output.title, "Title");
    assert.match(output.content, /Hello world/);
  });

  it("createCrawl4AiTool catches scrape failures gracefully", async () => {
    const fakeFetch: typeof fetch = async () => {
      return new Response("Not Found", { status: 404 });
    };

    const { scrape_url } = createCrawl4AiTool("c4ai-valid-token", fakeFetch);
    const output = await (scrape_url as any).execute({ url: "https://example.com/404" });

    assert.equal(output.success, false);
    assert.match(output.error, /404/);
  });

  it("blocks SSRF attempts to localhost and private addresses", async () => {
    const fakeFetch: typeof fetch = async () => {
      throw new Error("fetch should not be called for SSRF target");
    };

    const { scrape_url } = createCrawl4AiTool("c4ai-valid-token", fakeFetch);

    // 1. Localhost
    const res1 = await (scrape_url as any).execute({ url: "http://localhost:3000/secret" });
    assert.equal(res1.success, false);
    assert.match(res1.error, /mạng nội bộ/);

    // 2. Private IP
    const res2 = await (scrape_url as any).execute({ url: "http://192.168.1.1/admin" });
    assert.equal(res2.success, false);
    assert.match(res2.error, /nội bộ/);

    // 3. Cloud metadata
    const res3 = await (scrape_url as any).execute({ url: "http://169.254.169.254/latest/meta-data" });
    assert.equal(res3.success, false);
    assert.match(res3.error, /nội bộ/);
  });
});
