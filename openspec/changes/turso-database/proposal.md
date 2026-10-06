# Proposal

## Why

The application currently relies on `better-sqlite3`, which requires persistent local disk storage (`/data/family.db`) and a native C++ build. This limits the bot to a single host machine, complicates multi-container cloud deployments, and prevents using managed serverless database infrastructure.

Migrating to **Turso** (powered by `@libsql/client`) allows the bot to connect to a cloud-hosted, distributed libSQL database (`libsql://...`) with automated replication and backups, while retaining local SQLite file support (`file:...`) for offline tests and local development.

## What Changes

- Replace `better-sqlite3` with `@libsql/client` across `apps/backend`.
- Add configuration support for `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `AppConfig`, defaulting to `file:${DB_PATH}` when running locally.
- Refactor database connection manager (`src/db/connection.ts`) and schema migrations (`src/db/migrations.ts`) to use `@libsql/client`.
- Transition repository interfaces (`events`, `lookups`, `channels`, `lists`, `memory`, `message`, `seen`) to asynchronous APIs (`Promise<T>`).
- Update bot tools, scheduler, webhook handlers, and admin REST endpoints to await asynchronous repository operations.
- Remove native build requirements (`better-sqlite3` C++ compilation) from Docker build and workspace dependencies.

## Capabilities

### New Capabilities
- `cloud-database`: Asynchronous database access layer supporting both local file-based SQLite and remote Turso / libSQL cloud databases with authentication tokens.

### Modified Capabilities
<!-- None: Functional contracts of events, lookups, lists, and memory remain unchanged; only the underlying I/O transport changes from synchronous local calls to asynchronous libSQL calls. -->

## Impact

- **Dependencies**: Replaces `better-sqlite3` with `@libsql/client` in `apps/backend`. Removes `@types/better-sqlite3`.
- **Environment**: Adds optional `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` environment variables.
- **Async I/O**: Repository methods return Promises (`async`), which impacts callers in `src/tools/`, `src/admin/`, `src/scheduler/`, and `src/delivery.ts`.
- **Docker**: Dockerfile no longer requires native SQLite compilation, resulting in faster and lighter builds.
