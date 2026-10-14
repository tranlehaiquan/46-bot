## Context

The backend scheduler supports two operating modes:
1. An **in-process timer runner** (`apps/backend/src/scheduler/in-memory.ts`) using 60-second intervals for single-process and development environments.
2. A **distributed worker** (`apps/backend/src/scheduler/worker.ts`) using BullMQ queues backed by Redis for multi-instance deployments.

Currently, the domain execution logic (fetching events/holidays, assembling LLM tools, invoking prompts, chunking text, sending Zalo messages, and updating repository run status) is independently implemented and maintained in both files. This violates DRY, creates code drift, and introduced a copy-paste bug in `worker.ts` (`recordRunFailure` called three times).

## Goals / Non-Goals

**Goals:**
- Extract all domain task logic into a dedicated, reusable module `apps/backend/src/scheduler/tasks.ts`.
- Refactor `in-memory.ts` and `worker.ts` into thin adapters that delegate to `tasks.ts`.
- Centralize lookup tool construction (`weather`, `holidays`, `web_search`, `crawl4ai`) via a shared helper function.
- Fix the prompt injection error-recording copy-paste bug in `worker.ts`.
- Fix the TypeScript compilation error in `server.test.ts` (`fakeZalo` return type missing `sendCalls`).

**Non-Goals:**
- Altering BullMQ job schemas, queue names, or repeatable cron schedules.
- Changing database schemas or repository methods.
- Modifying prompt texts or message formatting rules.

## Decisions

### Decision 1: Create `scheduler/tasks.ts` for domain execution
Rather than having `in-memory.ts` import from `worker.ts` (which couples in-memory setups to BullMQ worker primitives), create a pure execution module:
- `executeMorningBriefing(deps, referenceDate, options?)`
- `executeWeeklySummary(deps, referenceDate, options?)`
- `executeEventReminders(deps, referenceDate)`
- `executeScheduledLookup(deps, { lookupId, dateStr }, referenceDate)`

Both `in-memory.ts` and `worker.ts` will import these functions.

### Decision 2: Shared tool factory for background lookups
Define `createSchedulerTools(config: AppConfig)` inside `tasks.ts` to instantiate `weather_check`, `holiday_list_upcoming`, `web_search`, and `scrape_url` based on API key availability. This ensures parity between in-memory lookups and BullMQ worker jobs.

### Decision 3: Handling deduplication in morning/weekly briefings
In distributed mode, BullMQ repeatable jobs guarantee single-instance execution per slot. In in-memory mode, an in-memory `Set<string>` prevents multiple sends during the catch-up window. `executeMorningBriefing` and `executeWeeklySummary` will accept an optional `dedupeSet?: Set<string>` parameter so in-memory state tracking works seamlessly.

## Risks / Trade-offs

- **[Risk] Test regressions in scheduler suites** → Both `scheduler.test.ts` and `worker.test.ts` have extensive unit test suites mocking clock and repositories; we will run tests after refactoring to ensure exact behavioral parity.
- **[Risk] Error propagation differences** → BullMQ jobs expect errors to be re-thrown on execution failure so BullMQ can handle retries, while in-memory runner logs errors without crashing. The task execution function will allow callers to decide whether to bubble errors or handle locally.
