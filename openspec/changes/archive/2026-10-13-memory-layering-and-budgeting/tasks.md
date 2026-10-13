## 1. Database Schema & Migration

- [x] 1.1 Update `memories` table schema in `apps/backend/src/db/schema/index.ts` to include `category` ('core' | 'general') and `status` ('active' | 'superseded') with default values.
- [x] 1.2 Add idempotent column migration checks in `apps/backend/src/db/connection.ts` ensuring existing SQLite tables receive `category` and `status` columns without data loss.
- [x] 1.3 Update `MemoryRow` types and `MemoryRepository` interface in `apps/backend/src/db/repositories/memory.ts`.

## 2. Repository Layer

- [x] 2.1 Update `upsertMemory` in `apps/backend/src/db/repositories/memory.ts` to support category assignment and superseding existing conflicting active facts.
- [x] 2.2 Implement `listActiveMemories` with category prioritization (`core` first) and limit cap for prompt injection.
- [x] 2.3 Enhance `listMemories` to support filtering by category, status, and query term.
- [x] 2.4 Update and extend repository unit tests in `apps/backend/src/db/repositories/memory.test.ts` (or equivalent test suites).

## 3. Prompt Layer & Budgeting

- [x] 3.1 Update `formatMemoriesSection` and `buildSystemPrompt` in `apps/backend/src/llm/client.ts` to accept budgeted memories and enforce max budget cap.
- [x] 3.2 Update `DEFAULT_SYSTEM_PROMPT` in `apps/backend/src/llm/client.ts` to instruct the assistant on using `list_memories` for on-demand lookup of secondary facts.
- [x] 3.3 Update LLM client tests in `apps/backend/src/llm/client.test.ts`.

## 4. Tools & Delivery Integration

- [x] 4.1 Update `remember` and `list_memories` tools in `apps/backend/src/tools/memory.ts` to support categories and on-demand search.
- [x] 4.2 Update `delivery.ts` to pass budgeted active memories to `generateReply` instead of querying all facts unconditionally.
- [x] 4.3 Update memory tool tests in `apps/backend/src/tools/memory.test.ts` and delivery test cases.

## 5. Verification & Validation

- [x] 5.1 Run full backend test suite (`pnpm test`) and ensure all tests pass.
- [x] 5.2 Verify backward compatibility with existing memory rows and ensure clean migration behavior.
