## 1. Passive Memory Extractor Module

- [x] 1.1 Create `apps/backend/src/llm/passive-memory.ts` with structured Zod extraction schema, safety checks (`containsSensitiveData`, `isMemorySafe`), and database upsert logic.
- [x] 1.2 Implement heuristics and prompt directives to reject ephemeral remarks and short greetings.
- [x] 1.3 Add comprehensive unit tests in `apps/backend/src/llm/passive-memory.test.ts` covering durable facts extraction, ephemeral rejection, and sensitive data gating.

## 2. Configuration & Integration

- [x] 2.1 Add `passiveMemoryEnabled` configuration flag to `apps/backend/src/config.ts` (default: `true`, configurable via `PASSIVE_MEMORY_ENABLED`).
- [x] 2.2 Integrate `extractPassiveMemories` into `apps/backend/src/delivery.ts` as a non-blocking background task after Zalo reply dispatch.
- [x] 2.3 Add integration test in `apps/backend/src/server.test.ts` verifying automatic fact extraction during chat flow.

## 3. Verification & Validation

- [x] 3.1 Run full backend test suite (`pnpm test`) and TypeScript check (`pnpm typecheck`).
- [x] 3.2 Verify error resilience so background extraction failures never affect message delivery.
