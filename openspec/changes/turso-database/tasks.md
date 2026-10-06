# Tasks

## 1. Dependencies and Configuration

- [x] 1.1 Add `@libsql/client` to `apps/backend/package.json`, remove `better-sqlite3` and `@types/better-sqlite3`, and verify installation succeeds
- [x] 1.2 Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to `AppConfig` in `apps/backend/src/config.ts` and verify config tests pass

## 2. LibSQL Connection and Schema Migrations

- [x] 2.1 Refactor `src/db/connection.ts` to initialize `@libsql/client` with support for local file and remote `libsql://` URLs and verify connection tests pass
- [x] 2.2 Refactor `src/db/migrations.ts` to execute schema migrations asynchronously via libSQL and verify migration tests pass

## 3. Asynchronous Repositories Migration

- [x] 3.1 Migrate `seen-repo.ts` and `message-repo.ts` to asynchronous libSQL execution and verify repository tests pass
- [x] 3.2 Migrate `channels.ts` repository to asynchronous libSQL execution and verify channel tests pass
- [x] 3.3 Migrate `list-repo.ts` repository to asynchronous libSQL execution and verify list tests pass
- [x] 3.4 Migrate `memory.ts` repository to asynchronous libSQL execution and verify memory tests pass
- [x] 3.5 Migrate `lookups.ts` repository to asynchronous libSQL execution and verify lookup tests pass
- [x] 3.6 Migrate `events.ts` repository to asynchronous libSQL execution and verify events tests pass

## 4. Callers and Integrations Update

- [x] 4.1 Update tool handlers in `src/tools/` to await repository calls and verify tool tests pass
- [x] 4.2 Update incoming message handling and delivery in `src/delivery.ts` and verify conversation tests pass
- [x] 4.3 Update scheduler execution in `src/scheduler/` to await repository calls and verify scheduler tests pass
- [x] 4.4 Update admin REST routes in `src/admin/routes.ts` to await repository calls and verify admin API tests pass

## 5. Verification and Docker Cleanup

- [x] 5.1 Remove `better-sqlite3` native build settings from `pnpm-workspace.yaml` and `Dockerfile`
- [x] 5.2 Verify complete test suite (`pnpm test`) and typecheck (`pnpm typecheck`) pass cleanly
