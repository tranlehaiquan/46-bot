# Proposal

## Why

The current scheduling engine relies on an in-memory Node.js `setInterval` running a 60-second polling loop against SQLite. As the bot is deployed across multiple container replicas or scales up in channels and scheduled tasks, this architecture hits several bottlenecks:
1. **No Horizontal Scalability**: Multiple server instances duplicate cron ticks and race on SQLite locks.
2. **Head-of-Line Blocking**: Sequential `for...of` loops awaiting LLM generations and Zalo API calls cause jobs scheduled at the same minute (e.g., 07:00 or 08:00) to delay each other.
3. **Lack of Rate Limiting and Worker Concurrency**: Spikes in concurrent alerts risk violating LLM provider token/minute quotas and Zalo messaging rate limits.

Adopting **BullMQ** backed by **Redis** decouples job scheduling from execution, providing distributed deduplication, concurrent worker processing, configurable rate limits, and resilient job lifecycle management.

## What Changes

- Add Redis client connection and configuration (`REDIS_URL`) with graceful fallback to in-memory scheduling when Redis is not configured.
- Introduce BullMQ queue and worker infrastructure for background tasks:
  - `scheduled-reminders`: Repeatable cron jobs for morning briefings (07:00), weekly outlooks (Sunday 20:00), and daily event reminders (08:00).
  - `scheduled-lookups`: Queue for executing internet lookups concurrently with LLM rate limiting.
- Enable worker concurrency and rate limiting to prevent API throttling and avoid serial delays.
- Implement distributed deduplication using deterministic BullMQ job IDs (`chatId:date` or `lookupId:date`).
- Support graceful shutdown for workers to let active jobs complete cleanly during deployments.

## Capabilities

### New Capabilities
- `distributed-scheduler`: Distributed queueing, repeatable job scheduling, worker concurrency, and resilient task execution via BullMQ and Redis with automatic fallback to in-memory scheduling.

### Modified Capabilities
<!-- None: The functional behavior and delivery contracts of scheduled-reminders and scheduled-lookups remain intact. -->

## Impact

- **Dependencies**: Adds `bullmq` and `ioredis` packages to `apps/backend`.
- **Configuration**: Adds optional `REDIS_URL` environment variable to `AppConfig`.
- **Backend Architecture**: `apps/backend/src/scheduler/` introduces queue producers and worker handlers alongside existing formatters and repositories.
- **Local Development**: Works out of the box with an in-memory fallback when `REDIS_URL` is unset, and seamlessly leverages Redis in Docker/production environments.
