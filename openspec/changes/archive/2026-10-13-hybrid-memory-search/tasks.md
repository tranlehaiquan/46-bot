## 1. Lexical Scoring & Normalization Engine

- [x] 1.1 Implement Vietnamese diacritic folding and string normalization utilities in `apps/backend/src/tools/memory-search.ts`.
- [x] 1.2 Implement multi-token and phrase relevance scoring algorithm (exact phrase match bonus, token overlap, field weighting, and core category boost).
- [x] 1.3 Add unit tests for lexical scoring and diacritic normalization in `apps/backend/src/tools/memory-search.test.ts`.

## 2. Repository Search Extension

- [x] 2.1 Add `searchAll` method to `MemoryRepository` interface and implementation in `apps/backend/src/db/repositories/memory.ts` querying both `memories` and `memory_book`.
- [x] 2.2 Add unit tests for `searchAll` in `apps/backend/src/db/repositories/memory.test.ts` verifying ranked aggregation across both tables.

## 3. Tool Suite & Agent Integration

- [x] 3.1 Implement `memory_search` tool in `apps/backend/src/tools/memory.ts` accepting `query`, `type` ('all' | 'facts' | 'stories'), `subject`, and `limit`.
- [x] 3.2 Update memory system prompt instructions in `apps/backend/src/llm/client.ts` to guide the model on using `memory_search` for comprehensive recall.
- [x] 3.3 Add tests in `apps/backend/src/tools/memory.test.ts` and `apps/backend/src/server.test.ts` covering `memory_search` tool execution.

## 4. Verification & Validation

- [x] 4.1 Run full backend test suite (`pnpm test`) and TypeScript check (`pnpm typecheck`).
