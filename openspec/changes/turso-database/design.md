# Design

## Context

The backend currently uses `better-sqlite3` via `src/db/connection.ts`. All repository methods execute synchronously. See `proposal.md` for motivation and bottlenecks.

This design introduces `@libsql/client` as the unified database client, enabling connectivity to Turso cloud while keeping local `file:` support.

## Goals / Non-Goals

**Goals:**
- Replace `better-sqlite3` with `@libsql/client` for all database interactions.
- Provide seamless configuration: connect to Turso cloud via `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`, or fall back to local file via `file:${DB_PATH}`.
- Transition all repositories and callers to `async/await`.
- Update all tool definitions (`src/tools/`), delivery handlers (`src/delivery.ts`), scheduler handlers (`src/scheduler/`), and admin REST routes (`src/admin/routes.ts`) to await repository calls.
- Eliminate native C++ compilation during Docker builds.

**Non-Goals:**
- Altering the database schema or table structures.
- Altering the admin web dashboard UI (the REST API signatures remain intact).
- Introducing an ORM (we retain lightweight, explicit SQL queries).

## Decisions

### 1. Unified Client via `@libsql/client`
- **Choice**: `@libsql/client` (version `^0.14.0`+).
- **Rationale**: Supports `libsql://`, `https://`, and `file:` URL protocols with the exact same client interface:
  ```typescript
  export type LibsqlDatabase = Client;
  export function openDatabase(url: string, authToken?: string): LibsqlDatabase {
    return createClient({ url, authToken });
  }
  ```
- **Alternatives Considered**:
  - *Keep `better-sqlite3` and dual-driver*: Adds unnecessary maintenance complexity. `@libsql/client` handles both local SQLite and remote Turso seamlessly.

### 2. Query Execution Pattern
In `@libsql/client`:
- Queries execute via `client.execute({ sql: "...", args: [...] })`.
- Transactions execute via `client.batch([...], "write")` or interactive transactions `client.transaction("write")`.
- Row objects are converted cleanly using row keys and typed mapping functions.

### 3. Configuration & Test Strategy
- In `src/config.ts`:
  - `TURSO_DATABASE_URL`: optional string.
  - `TURSO_AUTH_TOKEN`: optional string.
  - If `TURSO_DATABASE_URL` is omitted, the connection string defaults to `file:${resolveLocalDbPath(dbPath)}`.
- In unit tests:
  - Tests initialize with `file::memory:?cache=shared` or unique temporary files, running fast in-memory without network dependency.

## Risks / Trade-offs

- **[Risk] Extensive async call updates** → **Mitigation**: `pnpm typecheck` (`tsc --noEmit`) strictly checks all repository calls across tools, tests, admin routes, and scheduler, ensuring zero unhandled promises.
- **[Risk] Remote latency** → **Mitigation**: Parameterized SQL queries and batch operations keep roundtrips minimal.
