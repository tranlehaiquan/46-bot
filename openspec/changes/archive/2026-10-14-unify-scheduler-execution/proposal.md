## Why

Currently, background tasks (morning briefings, weekly outlooks, event reminders, and scheduled lookups) are implemented redundantly across two distinct modules: `apps/backend/src/scheduler/in-memory.ts` and `apps/backend/src/scheduler/worker.ts`. Each module maintains its own inlined copy of message compilation, tool assembly, LLM prompting, text chunking, Zalo dispatching, and run status recording.

This divergent duplication leads to:
1. **Behavioral drift**: Updates in one runner (such as Markdown parse mode or newly added tool bindings like `crawl4ai`) risk being omitted in the other.
2. **Copy-paste bugs**: In `worker.ts`, `recordRunFailure` is invoked three consecutive times for prompt injection due to uncoordinated copying.
3. **High maintenance overhead**: Any modification to reminder formats, lookup tools, or error handling requires synchronizing two disparate files.

Unifying task execution logic into a shared execution module restores Single Responsibility (separating trigger mechanism from execution) and DRY principles without altering public APIs.

## What Changes

- Extract shared task execution functions (`executeMorningBriefing`, `executeWeeklySummary`, `executeEventReminders`, and `executeScheduledLookup`) into dedicated runner services (e.g. `apps/backend/src/scheduler/tasks.ts` or `execution.ts`).
- Refactor `in-memory.ts` to delegate task execution directly to these shared functions while retaining its interval-based timer and local deduplication.
- Refactor `worker.ts` to delegate BullMQ job handling directly to the same shared functions.
- Centralize lookup tool assembly (`weather`, `holidays`, `web_search`, `crawl4ai`) so both runners always have access to identical tools and configurations.
- Fix the triplicated `recordRunFailure` defect in prompt injection handling.
- Fix the typecheck compilation error in `apps/backend/src/server.test.ts` where `sendCalls` is missing from `fakeZalo`'s return type signature.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `distributed-scheduler`: Guarantee execution and delivery parity between in-memory timer scheduling and BullMQ worker queue processing by sharing task execution pipelines.

## Impact

- **Backend scheduler**: `apps/backend/src/scheduler/in-memory.ts`, `apps/backend/src/scheduler/worker.ts`, and `apps/backend/src/scheduler/index.ts`.
- **New module**: `apps/backend/src/scheduler/tasks.ts` containing domain execution logic.
- **Tests**: `apps/backend/src/scheduler/scheduler.test.ts`, `worker.test.ts`, and `server.test.ts`.
- **APIs & Dependencies**: No breaking changes; external Redis queue names, payloads, and cron patterns remain unchanged.
