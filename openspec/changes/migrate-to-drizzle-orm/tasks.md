## 1. Setup & Dependencies

- [x] 1.1 Install `drizzle-orm` in `apps/backend` dependencies and `drizzle-kit` in devDependencies
- [x] 1.2 Create `drizzle.config.ts` in `apps/backend` targeting SQLite schema and libSQL driver

## 2. Schema Definitions

- [x] 2.1 Create system schema (`system_settings`, `channels`, `seen_messages`) in `apps/backend/src/db/schema/system.ts`
- [x] 2.2 Create conversation schema (`messages`, `memories`, `memory_book`, `group_members`) in `apps/backend/src/db/schema/conversations.ts`
- [x] 2.3 Create tasks & calendar schema (`lists`, `list_items`, `events`, `reminders_sent`) in `apps/backend/src/db/schema/tasks.ts`
- [x] 2.4 Create lookups & games schema (`scheduled_lookups`, `scheduled_lookup_runs`, `word_chain_sessions`, `word_chain_stats`) in `apps/backend/src/db/schema/lookups.ts` and `games.ts`
- [x] 2.5 Export combined schema and inferred types from `apps/backend/src/db/schema/index.ts`

## 3. Database Connection & Migrations

- [ ] 3.1 Update `apps/backend/src/db/connection.ts` to initialize and expose the typed Drizzle database instance
- [x] 3.2 Generate baseline migration files using `drizzle-kit` into `apps/backend/drizzle/`
- [ ] 3.3 Implement Drizzle migration execution runner in `apps/backend/src/db/migrations.ts` supporting both fresh/in-memory and existing databases

## 4. Repository Migration

- [ ] 4.1 Migrate `seen-repo.ts` and `message-repo.ts` to Drizzle queries and verify existing tests
- [ ] 4.2 Migrate `settings.ts` and `channels.ts` to Drizzle queries and verify existing tests
- [ ] 4.3 Migrate `group-members.ts` and `memory.ts` to Drizzle queries and verify existing tests
- [ ] 4.4 Migrate `list-repo.ts` and `events.ts` to Drizzle queries and verify existing tests
- [ ] 4.5 Migrate `lookups.ts` and `word-chain.ts` to Drizzle queries and verify existing tests

## 5. Verification & Validation

- [ ] 5.1 Run all database test suites (`npm test` in `apps/backend`) to ensure all tests pass
- [ ] 5.2 Run typecheck (`npm run typecheck`) across the workspace to ensure zero type errors
