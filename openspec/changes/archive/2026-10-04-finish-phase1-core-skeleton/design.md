## Context

The current bot implementation validates incoming Zalo webhooks and returns a hardcoded confirmation ("Mình nhận được.") to all text messages. The repository layout, Fastify HTTP server, queue-based delivery, and Dokploy deployment are established. Phase 1 in `readme.md` calls for completing the core conversational skeleton: SQLite-backed deduplication and conversation history, group mention/reply filtering, and LLM-powered Vietnamese replies via DeepSeek.

## Goals / Non-Goals

**Goals:**
- Provide SQLite storage (`better-sqlite3`, WAL mode, busy timeout) at `DB_PATH` (`/data/family.db` default).
- Persist `seen_messages` to guarantee deduplication across container restarts.
- Store conversation turns in `messages` table and supply the last ~20 turns into the LLM context.
- Inspect incoming Zalo group payloads so the bot responds ONLY when mentioned or when someone replies to one of the bot's messages. In direct chats (PRIVATE), respond to all incoming text.
- Integrate DeepSeek via Vercel AI SDK (`ai` and `@ai-sdk/deepseek` or `@ai-sdk/openai` compatible provider) with a family-friendly, concise Vietnamese persona.
- Trigger `sendChatAction` ("typing") before generating LLM responses.
- Split outbound messages exceeding 2000 characters along newline/sentence boundaries.
- Gracefully handle LLM failures with a single short Vietnamese fallback ("Mình chưa làm được việc này, thử lại sau nhé.").

**Non-Goals:**
- Tool definitions (Lists, Events, Memory Book) - deferred to Phases 2 through 5.
- Lunar calendar conversion or scheduled cron messages - deferred to Phases 3 and 4.
- User rate limiting - deferred to Phase 6.

## Decisions

### 1. Database: `better-sqlite3` with Repository Pattern
- **Decision:** Use `better-sqlite3` synchronously behind lightweight async repository functions (`SeenRepository`, `MessageRepository`).
- **Rationale:** `better-sqlite3` is fast, reliable, and standard for embedded SQLite in Node. Repository functions isolate SQL queries so schemas can evolve and storage could migrate later.
- **Alternatives Considered:**
  - `sqlite3` (callback-based, slower, awkward typing).
  - ORMs like Prisma/Drizzle (adds heavy build steps and schema generators for only 2 tables at this stage).

### 2. Group Mention & Reply Detection
- **Decision:** Inspect both explicit mention arrays/tags in the Zalo payload and message content referencing the bot name or bot ID. Check if `message.quote` or reply metadata points to the bot's previous messages.
- **Rationale:** Group chats can be noisy. The bot must strictly observe the rule of replying only when spoken to.
- **Alternatives Considered:**
  - Responding to all group messages (rejected: would spam family groups and violate Zalo platform constraints).

### 3. LLM Integration via Vercel AI SDK
- **Decision:** Use `ai` (`generateText`) with `@ai-sdk/deepseek` (or an OpenAI-compatible provider pointing to DeepSeek API URL) using `DEEPSEEK_MODEL` (e.g. `deepseek-chat`).
- **Rationale:** The Vercel AI SDK standardizes prompts, system messages, and seamlessly supports tool calling for future phases.
- **Alternatives Considered:**
  - Direct `fetch` to DeepSeek API (rejected: would have to rewrite tool calling and prompt formatting in Phase 2).

### 4. Outbound Text Splitting
- **Decision:** Create a text-splitting utility that breaks responses into chunks <= 2000 characters, breaking at double newlines, single newlines, or sentence boundaries (`. `, `? `, `! `).
- **Rationale:** Zalo enforces a hard limit of 2000 characters per outbound message.

## Risks / Trade-offs

- **[Risk] Docker native module build failure on Dokploy** → Mitigation: Use `node:22-slim` (already in `Dockerfile`), install Python/make/g++ during build stage, and ensure the `/data` volume is writable by the non-root container user.
- **[Risk] DeepSeek API latency causing webhook timeout** → Mitigation: Webhook already responds HTTP 200 immediately and queues work asynchronously. Send typing indicator immediately upon dequeuing.
- **[Risk] Zalo mention format variations** → Mitigation: Provide robust extraction that inspects `mentions`, `quote`, and text content. Provide a fallback local test harness / dry-run script.
