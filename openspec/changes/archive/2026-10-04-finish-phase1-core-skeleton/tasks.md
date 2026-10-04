## 1. Dependencies and Configuration

- [x] 1.1 Add runtime dependencies (`better-sqlite3`, `ai`, `@ai-sdk/deepseek`) and dev dependency (`@types/better-sqlite3`) to `package.json`
- [x] 1.2 Update `src/config.ts` and `.env.example` to parse and validate `DB_PATH`, `DEEPSEEK_API_KEY`, and `DEEPSEEK_MODEL`
- [x] 1.3 Add unit tests in `src/config.test.ts` for the new environment variables

## 2. Database Layer (SQLite)

- [x] 2.1 Implement `src/db/connection.ts` establishing SQLite connection with WAL mode and busy timeout
- [x] 2.2 Implement `src/db/migrations.ts` to create `seen_messages` and `messages` tables
- [x] 2.3 Implement repository methods for `seen_messages` (deduplication) and `messages` (insert and fetch last 20 messages)
- [x] 2.4 Add unit tests for database connection, migrations, and repository operations

## 3. Message Normalization and Mention Filtering

- [x] 3.1 Update `src/normalize.ts` to extract message text content, mentions array, and reply/quote metadata
- [x] 3.2 Update `src/delivery.ts` to filter group messages so only @mentions and replies to the bot trigger responses
- [x] 3.3 Add unit tests in `src/normalize.test.ts` for text extraction, mention detection, and reply detection

## 4. LLM Integration and Text Utilities

- [x] 4.1 Implement `src/utils/split-text.ts` to split outbound messages at paragraph or sentence boundaries under 2000 characters
- [x] 4.2 Add unit tests for `src/utils/split-text.ts`
- [x] 4.3 Implement `src/llm/client.ts` using Vercel AI SDK to prompt DeepSeek with family-friendly Vietnamese persona and short-term message history
- [x] 4.4 Add fallback error handling for LLM generation failures ("Mình chưa làm được việc này, thử lại sau nhé.")

## 5. Wiring and Lifecycle Integration

- [x] 5.1 Wire database and LLM service into `src/server.ts` and `src/delivery.ts`, adding typing indicator (`sendChatAction`) before LLM calls
- [x] 5.2 Update `src/lifecycle.ts` and `src/index.ts` to cleanly close SQLite database on SIGTERM / SIGINT shutdown
- [x] 5.3 Update existing tests (`src/server.test.ts`, `src/lifecycle.test.ts`) and ensure full test suite passes with `pnpm test`
