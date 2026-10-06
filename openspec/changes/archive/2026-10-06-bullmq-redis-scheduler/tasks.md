# Tasks

## 1. Dependencies and Configuration

- [x] 1.1 Add `bullmq` and `ioredis` to `apps/backend/package.json` and verify dependencies install cleanly
- [x] 1.2 Add optional `REDIS_URL` and `SCHEDULER_CONCURRENCY` to `AppConfig` in `apps/backend/src/config.ts` and verify config parsing tests pass

## 2. Connection and Fallback Layer

- [x] 2.1 Create Redis connection manager in `apps/backend/src/scheduler/redis.ts` with connection error handling and verify connection failure handling tests pass
- [x] 2.2 Separate in-memory timer scheduler into `apps/backend/src/scheduler/in-memory.ts` implementing a common `SchedulerInstance` interface and verify existing scheduler tests pass

## 3. BullMQ Queue and Repeatable Jobs

- [x] 3.1 Define scheduled job payload types and deterministic job ID builders in `apps/backend/src/scheduler/types.ts`
- [x] 3.2 Implement BullMQ queue setup and repeatable cron registration (07:00 morning briefing, 08:00 event reminders, Sunday 20:00 weekly summary with `Asia/Ho_Chi_Minh` timezone) in `apps/backend/src/scheduler/queue.ts`

## 4. Worker Execution and Rate Limiting

- [x] 4.1 Implement BullMQ worker processing handlers for briefings, reminders, and lookups with concurrency and rate limiting in `apps/backend/src/scheduler/worker.ts`
- [x] 4.2 Update `apps/backend/src/scheduler/index.ts` to initialize BullMQ scheduler when Redis is configured and fall back to in-memory scheduler when Redis is absent

## 5. Integration and Lifecycle Verification

- [x] 5.1 Integrate graceful shutdown for BullMQ workers and queues into application lifecycle in `apps/backend/src/lifecycle.ts`
- [x] 5.2 Add comprehensive test suite in `apps/backend/src/scheduler/scheduler.test.ts` validating fallback mode, job deduplication, and worker execution, and verify all tests pass
