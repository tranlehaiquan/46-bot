## 1. Schema & Repository Updates

- [x] 1.1 Add `condition`, `avoidAction`, and `expiresAt` columns to `memories` table in `apps/backend/src/db/schema/conversations.ts`.
- [x] 1.2 Update migrations in `apps/backend/src/db/migrations.ts` to idempotently add the new columns if they do not exist.
- [x] 1.3 Update `MemoryRepository` interface and implementation in `apps/backend/src/db/repositories/memory.ts` to support action boundaries and expiry filtering in `listActiveMemories`.
- [x] 1.4 Add unit tests for action-sensitive persistence and expiry in `apps/backend/src/db/repositories/memory.test.ts`.

## 2. Tools & Prompt Integration

- [x] 2.1 Update `remember` tool schema and execution in `apps/backend/src/tools/memory.ts` to accept `condition`, `avoidAction`, and `expiresAt`.
- [x] 2.2 Update `delivery.ts` memory prompt injection to format action boundaries (`avoidAction` and `condition`) into system prompt lines.
- [x] 2.3 Update `memory_search` in `apps/backend/src/tools/memory-search.ts` and `apps/backend/src/tools/memory.ts` to include action boundary fields.
- [x] 2.4 Add unit and integration tests in `apps/backend/src/tools/memory.test.ts` and `apps/backend/src/server.test.ts`.

## 3. Verification & Validation

- [x] 3.1 Run full backend test suite (`pnpm test`) and TypeScript check (`pnpm typecheck`).
