## Context

46-bot is a family AI assistant built with TypeScript, Drizzle ORM, Fastify, and Vercel AI SDK. While the bot already has real-time search capabilities via Tavily, it cannot directly inspect or read the contents of URLs provided in conversation.

Crawl4AI provides a Cloud REST API (`https://api.crawl4ai.com`) capable of scraping modern dynamic websites and extracting clean, LLM-ready markdown. The user requested Crawl4AI integration with the API token configurable in the system settings and admin interface.

## Goals / Non-Goals

**Goals:**
- Implement a lightweight, typed Crawl4AI client in the backend using native `fetch`.
- Implement a Vercel AI SDK tool (`scrape_url`) that accepts a URL, fetches clean markdown via Crawl4AI, and returns structured content to the LLM.
- Support Crawl4AI API token configuration via environment variable (`CRAWL4AI_API_TOKEN`) and database settings (`system_settings` key `crawl4ai_api_token`).
- Expose the Crawl4AI token in the Admin REST API with masking and a connection test endpoint (`POST /api/admin/settings/test-crawl4ai`).
- Add a Crawl4AI configuration card to the Admin SPA `SettingsPage` matching existing Gemini, DeepSeek, and Tavily cards.

**Non-Goals:**
- Self-hosting Crawl4AI via local Docker/Playwright containers (Cloud API is used).
- Full recursive crawler or multi-hop spidering for deep web indexing.
- Caching scraped web content in the database (caching is handled at the transport/LLM level if needed).

## Decisions

### 1. HTTP Client Implementation
- **Decision:** Use native Node.js `fetch` with typed request/response interfaces instead of an external library.
- **Rationale:** Crawl4AI Cloud API endpoints (`POST https://api.crawl4ai.com/scrape`) are standard JSON APIs authenticated with Bearer tokens. Using `fetch` avoids adding runtime dependencies and minimizes bundle footprint.
- **Alternatives Considered:** Adding Axios or Python-based SDKs (unnecessary complexity).

### 2. Configuration Hierarchy and Persistence
- **Decision:** Follow the established configuration precedence pattern:
  1. `system_settings` row (`crawl4ai_api_token`) in the SQLite database (highest priority).
  2. Environment variable `CRAWL4AI_API_TOKEN` mapped to `AppConfig.crawl4aiApiToken`.
  3. Undefined (feature disabled / tool gracefully informs model).
- **Rationale:** Matches how `gemini_api_key`, `deepseek_api_key`, and `tavily_api_key` operate in `settings-helper.ts`.

### 3. Tool Interface and Context Safety
- **Decision:** Create `createCrawl4AiTool(token: string)` producing tool `scrape_url`. Input schema accepts `{ url: string, instruction?: string }`. Truncate scraped markdown response to 20,000 characters.
- **Rationale:** Ensures LLM context windows are protected from oversized payloads while providing enough content for high quality answers.

### 4. Admin Settings UI Integration
- **Decision:** Update `AdminSettings` in `apps/admin/src/api.ts` to include `hasCrawl4aiApiKey`, `crawl4aiApiKeyMasked`, and `crawl4aiApiKeySource`. Add state and card in `SettingsPage.tsx` with a "Test Connection" button.
- **Rationale:** Gives admins full self-service visibility, ability to rotate keys without restarting the container, and immediate connection validation.

## Risks / Trade-offs

- **[Risk] High latency on complex JS-heavy web pages** → Mitigation: Set a 30s timeout on fetch requests via `AbortSignal.timeout(30000)`.
- **[Risk] Blocked or unreachable URLs** → Mitigation: Return structured error messages to the LLM indicating the URL failed to load, allowing the model to inform the user gracefully.
- **[Risk] Token exhaustion or invalid credentials** → Mitigation: Provide the "Test Connection" button in the Admin UI to verify credentials before operational use.
