# distributed-scheduler Specification

## Purpose
Provide distributed background queueing, worker concurrency control, job deduplication, and resilient task execution across multiple instances with automatic fallback to in-memory scheduling when Redis is not available.

## Requirements

### Requirement: Redis connection with graceful in-memory fallback
The system SHALL connect to Redis when `REDIS_URL` is configured. If `REDIS_URL` is omitted, the system SHALL log a notice and fall back to the in-process timer scheduler so that single-node and local development run without external dependencies. If the configured Redis connection fails at startup, the system SHALL log an error and fall back to in-process scheduling without terminating the process.

#### Scenario: Redis URL configured and connected
- **WHEN** `REDIS_URL` is provided and the Redis server is reachable
- **THEN** the scheduler initializes BullMQ queues and workers and marks the distributed scheduler active

#### Scenario: Redis URL omitted
- **WHEN** `REDIS_URL` is not present in the environment configuration
- **THEN** the system logs that distributed queueing is disabled and starts the in-process 60-second timer scheduler

### Requirement: Distributed repeatable job registration
The system SHALL register scheduled tasks (morning briefings at 07:00, event reminders at 08:00, weekly outlooks on Sunday 20:00, and scheduled lookups) into BullMQ using deterministic job identifiers based on `Asia/Ho_Chi_Minh` calendar dates. Multiple application replicas connected to the same Redis instance SHALL process each occurrence exactly once across the cluster.

#### Scenario: Clustered execution prevents duplicate delivery
- **WHEN** two or more backend instances run with the same Redis queue
- **THEN** only one instance acquires and executes each scheduled job occurrence, and no duplicate message is delivered to chat

### Requirement: Concurrent execution with rate limiting
The worker pool SHALL process queued jobs concurrently up to a configurable worker concurrency limit. Workers executing scheduled lookups and reminders SHALL respect rate limits to avoid overwhelming external LLM APIs and Zalo messaging endpoints.

#### Scenario: Concurrent lookup processing
- **WHEN** several scheduled lookups are due at the same clock time
- **THEN** the worker pool executes them concurrently up to the concurrency limit rather than blocking sequentially

#### Scenario: Rate limiting outbound messages
- **WHEN** a burst of reminders completes at the same time
- **THEN** delivery to Zalo channels is paced according to the configured rate limit without triggering API rejection

### Requirement: Graceful worker shutdown
Upon receiving application shutdown signals (`SIGINT` or `SIGTERM`), the scheduler workers SHALL stop polling for new jobs, allow running jobs to complete up to a configured grace timeout, and close Redis connections cleanly.

#### Scenario: In-flight task finishes on shutdown
- **WHEN** a shutdown signal is received while a scheduled lookup is generating an LLM response
- **THEN** the worker allows the in-flight job to finish and deliver before closing connections
