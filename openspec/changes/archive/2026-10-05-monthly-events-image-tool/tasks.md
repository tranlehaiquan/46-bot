## 1. Foundation & Dependencies

- [x] 1.1 Add `sharp` and its TypeScript types to `apps/backend/package.json`
- [x] 1.2 Update `ZaloClient` interface and factory in `apps/backend/src/zalo-client.ts` to expose `sendPhoto(chatId, caption, photoUrl)`
- [x] 1.3 Configure Fastify route / static serving for generated images under `/images/events/` in `apps/backend/src/server.ts`

## 2. Event Repository Extension

- [x] 2.1 Implement `getEventsForRange(chatId, startDate, endDate)` and helpers `getEventsForWeek`, `getEventsForMonth`, `getEventsForYear` in `apps/backend/src/db/repositories/events.ts` resolving solar, lunar, and recurring occurrences
- [x] 2.2 Add unit tests for range and scope queries covering one-offs, yearly solar birthdays, yearly lunar giỗ, and recurrence patterns

## 3. Multi-Scope Calendar Image Generation

- [x] 3.1 Create SVG layout generators in `apps/backend/src/tools/calendar-image-renderer.ts` supporting week, month, and year layouts with Vietnamese headers, dates, lunar annotations, and event category styling
- [x] 3.2 Implement SVG-to-PNG rasterization and file output using `sharp`
- [x] 3.3 Add unit tests for image generation verifying PNG buffer creation and empty-period fallbacks for all three scopes (`week`, `month`, `year`)

## 4. LLM Tool & Delivery Integration

- [x] 4.1 Implement `event_send_image` tool in `apps/backend/src/tools/events.ts` with input schema for `scope` ('week' | 'month' | 'year'), `date`, `month`, `year`, and `caption`
- [x] 4.2 Connect `sendPhoto` and public base URL resolution in `apps/backend/src/delivery.ts` to pass into event tools
- [x] 4.3 Add unit tests for `event_send_image` tool verifying image creation and photo dispatch to Zalo client for weekly, monthly, and yearly requests

## 5. Verification & Validation

- [x] 5.1 Run backend tests with `pnpm test`
- [x] 5.2 Run workspace typechecking with `pnpm typecheck`
- [x] 5.3 Verify production workspace build with `pnpm build`
