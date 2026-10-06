# Design

## Context

The backend currently manages all recurring jobs and event reminders via `apps/backend/src/scheduler/index.ts`, which runs an in-process 60-second `setInterval` loop against SQLite. See `proposal.md` for motivation and bottlenecks.

This design introduces a queue-based architecture using **BullMQ** and **ioredis** that supports both single-node local environments (with in-memory fallback) and clustered production environments.

## Goals / Non-Goals

**Goals:**
- Provide a robust background queue abstraction separating job dispatching from job execution.
- Enable worker concurrency so multiple due lookups and reminders do not block each other sequentially.
- Protect external endpoints (LLM providers and Zalo API) with BullMQ rate limiters.
- Guarantee idempotency across multiple server replicas through deterministic BullMQ job IDs.
- Ensure 100% backward compatibility: single-node or local development without Redis continues to run cleanly via an in-memory fallback.

**Non-Goals:**
- Migrating domain data (events, reminders, channels, memories) out of SQLite. Redis is used strictly for queue coordination and job state.
- Exposing a standalone web monitoring UI for BullMQ (such as Bull-Board) in this initial phase.
- Changing LLM prompt logic or conversational message formatting.

## Decisions

### 1. Queue Library: BullMQ with ioredis
- **Choice**: `bullmq` v5+ with `ioredis`.
- **Rationale**: BullMQ is the de facto standard for Node.js / TypeScript. It provides native support for repeatable cron schedules (`tz: "Asia/Ho_Chi_Minh"`), parent-child flows, worker concurrency, and token bucket rate limiters.
- **Alternatives Considered**:
  - *Keep `setInterval` with `p-limit`*: Does not support horizontal clustering or distributed job deduplication across containers.
  - *`node-cron` / `croner`*: In-process only; multiple containers would fire duplicate jobs.
  - *Cloud Webhook Schedulers (QStash, Cloud Tasks)*: Requires public webhook URLs and external cloud accounts, complicating local and self-hosted deployments.

### 2. Queue Architecture & Job Naming
We establish a single primary queue `scheduled-tasks` to minimize connection overhead while distinguishing jobs by name:
- `morning-briefing`: Dispatched daily for 07:00.
- `event-reminders`: Dispatched daily for 08:00.
- `weekly-summary`: Dispatched Sunday at 20:00.
- `scheduled-lookup`: Dispatched per lookup trigger with payload `{ lookupId, dateStr }`.

Deterministic `jobId` pattern:
- `briefing:${chatId}:${dateStr}`
- `reminder:${eventId}:${occurrenceDateStr}`
- `lookup:${lookupId}:${dateStr}`

BullMQ automatically rejects duplicate jobs submitted with the same `jobId` within the job retention window, ensuring cross-instance idempotency.

### 3. Rate Limiting and Worker Concurrency
- **Concurrency**: Configure worker concurrency to 5 (or via `SCHEDULER_CONCURRENCY` env var).
- **Rate Limiting**: Attach a BullMQ limiter (e.g., maximum 10 jobs per 2 seconds) to avoid Zalo API throttling and token limit spikes.
- **Job Retention**: Set `removeOnComplete: { age: 86400, count: 500 }` and `removeOnFail: { age: 604800, count: 500 }` to keep Redis memory footprint bounded.

### 4. Transparent In-Memory Fallback
- In `src/config.ts`, `redisUrl` is an optional string (`process.env.REDIS_URL`).
- In `src/scheduler/index.ts`, if `config.redisUrl` is not provided or if the initial Redis connection fails, the scheduler smoothly activates the existing in-process timer implementation.

## Risks / Trade-offs

- **[Risk] Redis connection failure or crash** → **Mitigation**: Catch Redis connection errors at startup, log a descriptive warning, and seamlessly fall back to in-memory scheduling. Workers listen for connection errors and reconnect with exponential backoff.
- **[Risk] Timezone drift** → **Mitigation**: All repeatable jobs explicitly specify `{ tz: "Asia/Ho_Chi_Minh" }` in BullMQ repeat options.
- **[Risk] Redis memory accumulation** → **Mitigation**: Automatic pruning of completed/failed jobs via BullMQ retention policies.
