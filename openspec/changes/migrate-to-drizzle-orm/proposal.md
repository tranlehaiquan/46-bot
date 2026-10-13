## Why

The backend currently uses raw SQL strings, a single monolithic `CREATE TABLE IF NOT EXISTS` migration file, manual TypeScript types, and hand-written mapping functions across repositories. As the bot grows with more features and data models, this pattern causes triple maintenance overhead (SQL schema, TypeScript interfaces, and runtime `mapRow` mappers), lacks compile-time SQL safety, and creates migration friction for schema alterations.

Adopting Drizzle ORM provides a single source of truth for schemas and inferred types, type-safe queries, and structured migrations with `drizzle-kit`, while preserving our lightweight `@libsql/client` architecture and zero-overhead philosophy.

## What Changes

- Add `drizzle-orm` and development dependency `drizzle-kit` to `apps/backend`.
- Define type-safe schemas using Drizzle SQLite schema definitions (`drizzle-orm/sqlite-core`) for all existing tables: `seen_messages`, `messages`, `lists`, `list_items`, `events`, `reminders_sent`, `memories`, `memory_book`, `channels`, `scheduled_lookups`, `scheduled_lookup_runs`, `word_chain_sessions`, `word_chain_stats`, `system_settings`, and `group_members`.
- Replace monolithic raw-SQL `migrations.ts` with Drizzle migration runner and `drizzle-kit` generated migration files.
- Refactor existing database repositories to utilize Drizzle queries and schema types instead of raw SQL strings and manual `mapRow` casting.
- Maintain existing repository interfaces and behavior so that callers, handlers, and unit tests continue functioning without functional regressions.

## Capabilities

### New Capabilities
- `database-persistence`: Standardize type-safe schema management, Drizzle-based repository querying, and automated schema migrations for the backend SQLite database.

### Modified Capabilities
<!-- None: External behavior and functional requirements of bot features, webhooks, and admin APIs remain unchanged. -->

## Impact

- **Dependencies**: Adds `drizzle-orm` (runtime) and `drizzle-kit` (dev) in `apps/backend`.
- **Database Layer**: `apps/backend/src/db/` will be restructured to host schemas, connection setup wrapping `@libsql/client`, and migration utilities.
- **Repositories**: All repository implementations in `apps/backend/src/db/repositories/` and root `apps/backend/src/db/` will be updated to use Drizzle queries.
- **Build & Dev Tooling**: Update `package.json` scripts with drizzle-kit migration commands.
