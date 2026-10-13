## 1. Backend Configuration & Settings Management

- [x] 1.1 Add `crawl4aiApiToken` to `AppConfig` and environment variable parsing (`CRAWL4AI_API_TOKEN`) in `apps/backend/src/config.ts`
- [x] 1.2 Update `apps/backend/src/admin/settings-helper.ts` to include `crawl4aiApiToken` in `EffectiveSettings`, `MaskedSettings`, and resolution logic
- [x] 1.3 Add test connection helper for Crawl4AI in `apps/backend/src/admin/settings-helper.ts` or client service
- [x] 1.4 Add `POST /api/admin/settings/test-crawl4ai` endpoint and support `crawl4aiApiKey` in `PUT /api/admin/settings` in `apps/backend/src/admin/routes.ts`
- [x] 1.5 Add unit tests for Crawl4AI settings resolution, masking, and test endpoint in `apps/backend/src/admin/settings-helper.test.ts` and `admin-api.test.ts`

## 2. Crawl4AI Client & Tool Implementation

- [x] 2.1 Implement Crawl4AI Cloud API client wrapper (`scrapeUrl`) in `apps/backend/src/tools/crawl4ai.ts` using native fetch
- [x] 2.2 Implement `createCrawl4AiTool` exposing `scrape_url` with Zod schema, error handling, and 20k character content truncation
- [x] 2.3 Add unit tests for `scrape_url` tool covering success, error, and unconfigured token cases in `apps/backend/src/tools/crawl4ai.test.ts`
- [x] 2.4 Register `crawl4ai` tool in `apps/backend/src/delivery.ts` and scheduler workers when `crawl4aiApiToken` is configured

## 3. Admin Web UI Integration

- [x] 3.1 Update admin API types in `apps/admin/src/api.ts` to include Crawl4AI settings fields and `testCrawl4AiSettings` function
- [x] 3.2 Add Crawl4AI mutation hook in `apps/admin/src/hooks/useAdminQueries.ts`
- [x] 3.3 Add Crawl4AI settings card with token visibility toggle, status badge, and "Test Connection" button in `apps/admin/src/components/SettingsPage.tsx`

## 4. Verification & Validation

- [x] 4.1 Run unit and integration tests across backend (`pnpm test` in `apps/backend`)
- [x] 4.2 Run typecheck across the monorepo (`pnpm typecheck`)
- [x] 4.3 Validate OpenSpec change with `openspec validate integrate-crawl4ai --json`
