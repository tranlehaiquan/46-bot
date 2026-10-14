## 1. Typecheck & Foundation

- [x] 1.1 Fix TypeScript compilation error in `apps/backend/src/server.test.ts` by adding `sendCalls` to `fakeZalo`'s return type signature
- [x] 1.2 Verify `pnpm typecheck` passes across the entire workspace

## 2. Core Scheduler Tasks Extraction

- [x] 2.1 Create `apps/backend/src/scheduler/tasks.ts` with `createSchedulerTools(config)` factory function
- [x] 2.2 Implement `executeMorningBriefing` and `executeWeeklySummary` in `tasks.ts` supporting in-memory deduplication sets
- [x] 2.3 Implement `executeEventReminders` in `tasks.ts`
- [x] 2.4 Implement `executeScheduledLookup` in `tasks.ts` with prompt injection validation, uniform tool calling, text chunking, and single failure recording

## 3. Refactor Runners & Exports

- [x] 3.1 Refactor `apps/backend/src/scheduler/in-memory.ts` to delegate task execution to `tasks.ts`
- [x] 3.2 Refactor `apps/backend/src/scheduler/worker.ts` to delegate job processing to `tasks.ts` and remove duplicate logic
- [x] 3.3 Update `apps/backend/src/scheduler/index.ts` to re-export task execution functions cleanly

## 4. Verification & Testing

- [x] 4.1 Run unit and integration tests (`pnpm --filter @bot/backend test`)
- [x] 4.2 Run workspace-wide typecheck (`pnpm typecheck`) and build validation (`pnpm build`)
