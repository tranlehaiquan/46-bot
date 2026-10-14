## 1. Typecheck & Foundation

- [x] 1.1 Fix TypeScript compilation error in `apps/backend/src/server.test.ts` by adding `sendCalls` to `fakeZalo`'s return type signature
- [x] 1.2 Verify `pnpm typecheck` passes across the entire workspace

## 2. Core Scheduler Tasks Extraction

- [ ] 2.1 Create `apps/backend/src/scheduler/tasks.ts` with `createSchedulerTools(config)` factory function
- [ ] 2.2 Implement `executeMorningBriefing` and `executeWeeklySummary` in `tasks.ts` supporting in-memory deduplication sets
- [ ] 2.3 Implement `executeEventReminders` in `tasks.ts`
- [ ] 2.4 Implement `executeScheduledLookup` in `tasks.ts` with prompt injection validation, uniform tool calling, text chunking, and single failure recording

## 3. Refactor Runners & Exports

- [ ] 3.1 Refactor `apps/backend/src/scheduler/in-memory.ts` to delegate task execution to `tasks.ts`
- [ ] 3.2 Refactor `apps/backend/src/scheduler/worker.ts` to delegate job processing to `tasks.ts` and remove duplicate logic
- [ ] 3.3 Update `apps/backend/src/scheduler/index.ts` to re-export task execution functions cleanly

## 4. Verification & Testing

- [ ] 4.1 Run unit and integration tests (`pnpm --filter @bot/backend test`)
- [ ] 4.2 Run workspace-wide typecheck (`pnpm typecheck`) and build validation (`pnpm build`)
