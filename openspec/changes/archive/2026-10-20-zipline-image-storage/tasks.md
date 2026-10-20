## 1. Zipline Client & Image Storage Service

- [x] 1.1 Implement Zipline client module (`apps/backend/src/storage/zipline.ts`) with `uploadImageToZipline` using `FormData` / `fetch` and `testZiplineConnection`
- [x] 1.2 Add unit tests for Zipline client (`apps/backend/src/storage/zipline.test.ts`) covering success, HTTP errors, token authorization, and URL response parsing

## 2. System Settings & Admin API Backend

- [x] 2.1 Update `apps/backend/src/config.ts` to include optional `ziplineUrl` and `ziplineToken` environment variables
- [x] 2.2 Update `apps/backend/src/admin/settings-helper.ts` to support Zipline settings resolution, secret masking, and connection testing
- [x] 2.3 Update `apps/backend/src/admin/routes.ts` to handle Zipline settings in `GET/PATCH /api/admin/settings` and add `POST /api/admin/settings/test-zipline`
- [x] 2.4 Add/update tests for Zipline admin settings and test endpoint in `apps/backend/src/admin/admin-api.test.ts`

## 3. Admin Web Frontend

- [x] 3.1 Update admin API client (`apps/admin/src/api.ts`) with Zipline settings types, masked properties, and `testZipline()` function
- [x] 3.2 Add Zipline configuration card in `apps/admin/src/components/SettingsPage.tsx` with endpoint URL input, token input with visibility toggle, status badge, and "Test Connection" button

## 4. Calendar Rendering & Event Tool Integration

- [x] 4.1 Update `calendar-image-renderer.ts` to provide in-memory PNG buffer output and remove mandatory filesystem persistence
- [x] 4.2 Update `tools/events.ts` to upload calendar image buffers to Zipline and send the returned public URL to Zalo
- [x] 4.3 Update `delivery.ts` to resolve effective Zipline settings and inject the image storage capability into `createEventTools`
- [x] 4.4 Update tests in `apps/backend/src/tools/events.test.ts` to mock Zipline upload and verify Zalo delivery

## 5. Remove System Static Image Serving & Final Verification

- [x] 5.1 Remove `/images/events/:filename` route, `getEventsImageDir`, and events `fastifyStatic` registration in `apps/backend/src/server.ts`
- [x] 5.2 Remove obsolete static image directory tests in `apps/backend/src/server.test.ts`
- [x] 5.3 Run full test suites and typecheck across workspace (`pnpm test` and `pnpm build`) to ensure all tests pass
