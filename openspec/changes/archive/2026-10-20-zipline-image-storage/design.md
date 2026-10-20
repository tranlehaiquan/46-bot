## Context

The bot generates visual calendar graphics (PNG) for weekly, monthly, and yearly schedules. Currently, these images are saved to local disk directories (`data/images/events` or OS temp directories) and served through a Fastify static route (`/images/events/:filename`) on the bot's HTTP server.

This approach has multiple drawbacks:
- It requires incoming HTTP access to the bot server via `WEBHOOK_URL`, which breaks if the bot runs behind NAT, firewalls, or in ephemeral environments (e.g. containers, serverless).
- Local disk fills up with generated event graphics over time without garbage collection.
- It couples media file hosting to the bot's core messaging process.

By integrating Zipline (an open-source media hosting service with token-based multipart upload APIs), images are uploaded in-memory upon rendering, immediately receiving a persistent public CDN/server URL that Zalo can fetch.

## Goals / Non-Goals

**Goals:**
- Provide a clean Zipline client module (`apps/backend/src/storage/zipline.ts`) supporting image upload via `POST /api/upload` with multipart form-data and bearer/authorization token headers.
- Remove all local static image file hosting (`/images/events/:filename` and associated directory creations) from `server.ts`.
- Persist `zipline_url` and `zipline_token` in `system_settings` table, configurable via Admin Settings API and Admin Web UI, with fallback to environment variables (`ZIPLINE_URL`, `ZIPLINE_TOKEN`).
- Provide an Admin API endpoint (`POST /api/admin/settings/test-zipline`) and Settings UI button to verify connectivity and credentials against the Zipline server.
- Update calendar rendering and `event_send_image` tool to render PNG in-memory, upload to Zipline, and dispatch the returned public URL to Zalo.

**Non-Goals:**
- Removing the Fastify static route for the Admin SPA (`/admin/*`) — only image hosting is removed.
- Uploading non-image files or managing full Zipline user administration (folders, user management) through the bot.
- Automatically migrating historical local images to Zipline (images are ephemeral event renders generated on-demand).

## Decisions

### 1. Direct In-Memory Buffer Uploads
- **Decision**: Render SVG to PNG Buffer with Sharp and pipe directly into `FormData` via `Blob` or `Buffer`, uploading directly to Zipline without touching local disk.
- **Alternatives Considered**: Saving to temporary file first then uploading. Rejected because in-memory upload avoids disk I/O, cleanup issues, and filesystem permission errors in restricted containers.

### 2. Zipline API Interaction
- **Decision**: Send `POST <zipline_url>/api/upload` with:
  - Header `authorization: <token>`
  - Body `multipart/form-data` with field `file`
  - Filename header or field set to descriptive name (e.g., `events_<scope>_<timestamp>.png`).
  - Parse JSON response to extract URL from `files[0]` (with fallback to parsing raw text response if `x-zipline-no-json` or different versions are used).
- **Alternatives Considered**: Custom S3 or MinIO integration. Rejected because user explicitly specified Zipline, which provides lightweight, shareable image URLs and straightforward token authorization.

### 3. Settings Hierarchy & Masking
- **Decision**: Follow existing pattern used for `crawl4ai_api_token` and `tavily_api_key`:
  - Database table `system_settings` stores `zipline_url` and `zipline_token`.
  - Resolution order: DB override > Environment variable (`ZIPLINE_URL`, `ZIPLINE_TOKEN`) > undefined.
  - Secret masking: `toMaskedSettings` returns `ziplineUrl`, `hasZiplineToken`, `ziplineTokenMasked` (e.g. `abcd...1234`), and `ziplineTokenSource` (`db` | `env` | `none`).
  - UI allows editing URL and entering a new token, keeping existing token if left empty.

### 4. Connection Testing Strategy
- **Decision**: `testZiplineConnection` attempts a lightweight check against the Zipline server:
  - First attempts `GET <zipline_url>/api/user` with `authorization: <token>` (standard Zipline endpoint to fetch user profile).
  - If endpoint returns 200 OK, the token and server URL are valid.
  - If `/api/user` returns 404 (non-standard proxy or version difference), attempts an upload test or lightweight ping to `/api/upload`.
  - Returns `{ success: true, message: "Kết nối Zipline thành công" }` or descriptive failure error.

### 5. Decoupling Webhook URL from Image Delivery
- **Decision**: Remove the requirement for `publicBaseUrl` / `WEBHOOK_URL` in `createEventTools`. The tool only requires valid Zipline credentials to upload and obtain image URLs.

## Risks / Trade-offs

- **[Zipline server downtime or rate limit]** → When upload fails, `event_send_image` catches the error and returns a clear text fallback message to the channel (explaining image generation succeeded but hosting failed) without failing the whole LLM request.
- **[Token expiration or invalid URL]** → Admin Settings provides immediate feedback through the "Test Connection" button, so administrators can verify credentials before saving.
- **[Zipline response version variances]** → Response parser handles both `{ files: ["https://..."] }`, `{ files: [{ url: "..." }] }`, and raw URL strings.

## Migration Plan

1. Implement Zipline client module with tests.
2. Update settings repository helper, routes, and config schema.
3. Update `apps/admin` UI in `SettingsPage.tsx` and API client in `api.ts`.
4. Update `calendar-image-renderer.ts` to return in-memory PNG buffer and remove static image file writes.
5. Update `tools/events.ts` and `delivery.ts` to upload to Zipline.
6. Remove `/images/events/:filename` static route and `getEventsImageDir` from `server.ts`.
7. Update test suites and verify all unit/integration tests pass.
