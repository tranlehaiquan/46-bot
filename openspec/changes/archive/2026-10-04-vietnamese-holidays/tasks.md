## 1. Vietnamese Holidays Catalog & Calculation Engine

- [x] 1.1 Implement `VIETNAMESE_HOLIDAYS` catalog and `getUpcomingHolidays` in `src/holidays/index.ts` supporting both public holidays and traditional festivals with lunar-to-solar date conversion
- [x] 1.2 Write unit tests for holiday definitions and occurrence calculations in `src/holidays/holidays.test.ts`

## 2. LLM Holiday Tools

- [x] 2.1 Implement `holiday_list_upcoming` and `holiday_import` tools in `src/tools/holidays.ts`
- [x] 2.2 Add unit tests for holiday tools in `src/tools/holidays.test.ts`

## 3. Wiring and Persona Updates

- [x] 3.1 Wire holiday tools into `src/delivery.ts`
- [x] 3.2 Update system prompt in `src/llm/client.ts` to instruct the bot on answering holiday questions and using holiday tools
- [x] 3.3 Verify full test suite passes with `pnpm test` and `pnpm typecheck`
