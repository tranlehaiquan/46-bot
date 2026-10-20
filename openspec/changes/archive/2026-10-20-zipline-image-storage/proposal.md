## Why

Currently, the bot stores rendered calendar and schedule images on the local filesystem and hosts them using Fastify's static file handler (`/images/events/:filename`). This approach couples image hosting to the bot's runtime, requires incoming HTTP access via a public `WEBHOOK_URL`, consumes local disk space, and fails in containerized, ephemeral, or reverse-proxy setups.

Integrating an external Zipline service solves this by uploading generated images directly to Zipline via its API, receiving public URLs for Zalo delivery, and eliminating all local static image file storage and serving from our system.

## What Changes

- **Zipline Image Storage Integration**: Introduce an image storage client that sends image buffers to Zipline's upload API (`POST /api/upload`) with multipart form-data and authorization headers, retrieving public image URLs.
- **Remove System Static Image Serving**: Deprecate and remove `/images/events/:filename` routes, local filesystem image storage directories (`data/images/events`, temp paths), and local file saving routines for calendar renders.
- **Admin Settings for Zipline**: Add `zipline_url` and `zipline_token` to dynamic system settings, persisted in database and configurable via Admin Settings API (`GET /api/admin/settings`, `PATCH /api/admin/settings`), with fallback to environment variables (`ZIPLINE_URL`, `ZIPLINE_TOKEN`).
- **Admin Zipline Connection Test**: Add `POST /api/admin/settings/test-zipline` to verify credentials against the configured Zipline instance.
- **Admin UI Settings Card**: Add a dedicated Zipline configuration card in `apps/admin/src/components/SettingsPage.tsx` with URL input, masked token input/reveal, status badges, and a "Test Connection" button.
- **Calendar Image Flow Update**: Update calendar image generation and `event_send_image` tool to render PNG buffers in-memory, upload to Zipline, and dispatch the returned URL to Zalo.

## Capabilities

### New Capabilities
- `image-storage`: Uploads image buffers to an external Zipline hosting instance via HTTP multipart API, validates responses, and returns public URLs.

### Modified Capabilities
- `event-schedule-image`: Replaces local static file hosting with Zipline remote image upload for delivering calendar graphics to Zalo.
- `web-admin`: Extends system settings API and admin web dashboard to manage Zipline URL and token, display masked status, and test Zipline connectivity.

## Impact

- **Backend**:
  - `apps/backend/src/config.ts`: Add optional `ziplineUrl` and `ziplineToken` env configuration.
  - `apps/backend/src/server.ts`: Remove `/images/events/:filename` route, fastify-static for events, and `getEventsImageDir`.
  - `apps/backend/src/tools/calendar-image-renderer.ts`: Remove disk writing logic or make it optional; calendar rendering produces in-memory PNG buffer.
  - `apps/backend/src/tools/events.ts`: Delegate image hosting to Zipline client instead of local static URL generation.
  - `apps/backend/src/delivery.ts`: Pass image storage service/settings to event tools.
  - `apps/backend/src/admin/settings-helper.ts` & `apps/backend/src/admin/routes.ts`: Expose Zipline settings, masking, updating, and connection test endpoint.
- **Admin Frontend**:
  - `apps/admin/src/api.ts`: Add Zipline settings types and `testZipline()` function.
  - `apps/admin/src/components/SettingsPage.tsx`: Add Zipline settings card and test button.
- **Dependencies**: No external runtime binaries required; standard `fetch` with `FormData` / `Blob` or `undici` is available in Node 18+.
