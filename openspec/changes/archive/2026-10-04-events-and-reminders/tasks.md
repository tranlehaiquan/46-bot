## 1. Lunar Calendar Engine

- [x] 1.1 Implement Vietnamese lunar calendar algorithm (Ho Ngoc Duc / UTC+7) supporting solar-to-lunar and lunar-to-solar conversions with leap months in `src/lunar/index.ts`
- [x] 1.2 Write comprehensive unit tests in `src/lunar/lunar.test.ts` verifying multiple known historical and future Tết dates (e.g. 2024, 2025, 2026, 2027) and leap month conversions

## 2. Database Migrations

- [x] 2.1 Add migration for `events` and `reminders_sent` tables with appropriate indexes in `src/db/migrations.ts`

## 3. Events Repository

- [x] 3.1 Implement `src/db/repositories/events.ts` supporting `createEvent`, `getEventById`, `updateEvent`, `deleteEvent`, and `listUpcomingEvents` with solar/lunar next occurrence calculation
- [x] 3.2 Add unit tests for event repository operations in `src/db/repositories/events.test.ts`

## 4. LLM Tools

- [x] 4.1 Implement `event_add`, `event_list_upcoming`, `event_update`, and `event_delete` tools using Vercel AI SDK and Zod in `src/tools/events.ts`
- [x] 4.2 Add unit tests for event tools in `src/tools/events.test.ts`

## 5. Wiring and LLM Persona Guidance

- [x] 5.1 Wire event tools into `src/delivery.ts` alongside list and web search tools
- [x] 5.2 Update system prompt in `src/llm/client.ts` to instruct the bot on event/reminder creation, solar vs lunar calendar recognition, and plain-text presentation
- [x] 5.3 Verify all tests pass with `pnpm test` and typecheck with `pnpm typecheck`
