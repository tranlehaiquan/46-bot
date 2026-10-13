## Context

The backend currently operates on SQLite via `@libsql/client` (supporting local file, `:memory:`, and remote Turso endpoints). All database tables are declared via raw DDL strings in `apps/backend/src/db/migrations.ts` executed as a single batch `db.executeMultiple(...)`. Each repository (`group-members.ts`, `channels.ts`, `events.ts`, `lookups.ts`, `memory.ts`, `settings.ts`, `word-chain.ts`, `list-repo.ts`, `message-repo.ts`, `seen-repo.ts`) manages hand-crafted SQL strings, manually written TypeScript row types, and manual row parsers (`mapRow(row: any)`).

This architecture is error-prone when modifying schemas, lacks compile-time query safety, and makes incremental migrations difficult as new features are added.

## Goals / Non-Goals

**Goals:**
- Introduce `drizzle-orm` (with `drizzle-orm/libsql`) and `drizzle-kit` to the backend.
- Define modular, type-safe table schemas in `apps/backend/src/db/schema/` matching all existing database tables and columns identically (retaining column names, types, primary keys, and foreign keys).
- Infer repository TypeScript types directly from Drizzle schemas (`$inferSelect`, `$inferInsert`) and eliminate manual `mapRow` boilerplate.
- Refactor all database repositories to use Drizzle queries without changing their public method signatures or contracts.
- Support automated migrations both in dev/prod (via `drizzle-kit`) and in-memory test environments (via Drizzle programmatic migrator).
- Ensure 100% backwards compatibility with existing SQLite database files on disk without data loss.

**Non-Goals:**
- Changing database engines (remains SQLite / LibSQL).
- Modifying repository interfaces or consumer-facing services/tools.
- Changing business logic, webhook handling, or API endpoints.

## Decisions

### 1. Drizzle ORM instead of Prisma or Kysely
- **Choice**: `drizzle-orm` with `drizzle-orm/libsql`.
- **Rationale**: Direct integration with the existing `@libsql/client`, zero runtime engine overhead, single source of truth for schemas + TypeScript types, and seamless support for Turso/LibSQL and SQLite `:memory:`.
- **Alternatives Considered**:
  - *Prisma*: Heavy Rust query engine binary, slow cold starts, complex Turso edge integration.
  - *Kysely*: Great query builder, but lacks built-in schema declaration and automatic migration generator (`drizzle-kit`).

### 2. Schema Structure and Modularity
- **Choice**: Place schemas in `apps/backend/src/db/schema/` split by domain:
  - `system.ts`: `system_settings`, `channels`, `seen_messages`
  - `conversations.ts`: `messages`, `memories`, `memory_book`, `group_members`
  - `tasks.ts`: `lists`, `list_items`, `events`, `reminders_sent`
  - `lookups.ts`: `scheduled_lookups`, `scheduled_lookup_runs`
  - `games.ts`: `word_chain_sessions`, `word_chain_stats`
  - `index.ts`: Unified export of all tables and relations.
- **Rationale**: Keeps schema definitions manageable and organized while providing a unified schema export for Drizzle and Drizzle Kit.

### 3. Preserving Column Types & Storage Formats
- **Choice**: Explicitly map timestamps and numbers using `integer({ mode: "number" })` and text fields using `text()`.
- **Rationale**: SQLite stores unix timestamps in milliseconds. Matching exact storage formats ensures existing databases on disk load without migration discrepancies.

### 4. Repository Abstraction Retention
- **Choice**: Retain the existing Repository interface pattern (e.g. `GroupMemberRepository`, `EventRepository`). The repositories receive the Drizzle DB instance (or wrapped client) and implement methods using Drizzle's query API (`db.select()`, `db.insert()`, `db.update()`, `db.delete()`).
- **Rationale**: Keeps consumers (tools, scheduled tasks, handlers) isolated from database implementation changes.

### 5. Migration Execution Strategy
- **Choice**: Configure `drizzle-kit` to output migrations to `apps/backend/drizzle/` and run `migrate(drizzleDb, { migrationsFolder })` programmatically on backend startup, including during test setups with `:memory:`.
- **Rationale**: Guarantees migrations always run automatically on deployment and test execution without manual pre-run steps.

## Risks / Trade-offs

- **[Risk] Existing DB compatibility**: Applying Drizzle migrations to an existing SQLite database that already has tables created by the legacy `migrations.ts`.
  - → **Mitigation**: Schema definitions will match legacy table definitions exactly (column names, types, constraints, index names). For existing databases, baseline migration state or ensure idempotent migration application.
- **[Risk] In-memory SQLite testing performance**: Running migration scripts before test suites.
  - → **Mitigation**: LibSQL in-memory migration is extremely fast (<10ms). Helper `createTestDb()` will run migrations against `:memory:`.
- **[Risk] Node.js `--experimental-strip-types` CLI compatibility**: Drizzle-kit commands need TS config.
  - → **Mitigation**: Provide a clean `drizzle.config.ts` configured for the project structure.
