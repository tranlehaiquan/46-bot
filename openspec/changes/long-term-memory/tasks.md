## 1. Database Schema & Migration

- [x] 1.1 Add `memories` and `memory_book` table definitions with indexes in `src/db/migrations.ts`
- [x] 1.2 Update schema migration tests to verify new table creation and idempotency

## 2. Memory Repositories

- [x] 2.1 Implement `MemoryRepository` in `src/db/repositories/memory.ts` with upsert, delete, list, add story, and search capabilities
- [x] 2.2 Write unit tests in `src/db/repositories/memory.test.ts` covering fact deduplication, deletion, per-chat isolation, and story search

## 3. Memory & Storybook Tools

- [x] 3.1 Create tool definitions and handlers for `remember`, `forget`, `list_memories`, `memory_book_add`, and `memory_book_search` in `src/tools/memory.ts`
- [x] 3.2 Add privacy guardrails in tool handlers to reject sensitive credentials (passwords, bank info, card numbers, citizen IDs)
- [x] 3.3 Register memory tools in `src/tools/index.ts`
- [x] 3.4 Write unit tests for memory tools in `src/tools/memory.test.ts`

## 4. System Prompt Integration & Disambiguation

- [x] 4.1 Update `buildSystemPrompt` in `src/llm/client.ts` to format and inject active memories under `### Things you know about this family:`
- [x] 4.2 Add system prompt instructions for tool disambiguation (`remember` vs `event_add` vs `list_add_item` vs `memory_book_add`) and privacy restrictions
- [x] 4.3 Wire memory retrieval into `src/delivery.ts` so per-chat memories are loaded on every message turn
- [x] 4.4 Write unit tests for prompt formatting and memory injection in `src/llm/client.test.ts`

## 5. Verification & Validation

- [x] 5.1 Run test suite with `pnpm test` and verify zero regressions
- [x] 5.2 Validate TypeScript types and project build with `pnpm typecheck` and `pnpm build`
