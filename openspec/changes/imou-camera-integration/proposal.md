## Why

Family members often need to quickly check home security cameras (e.g., checking if children are asleep, seeing if anyone is in the living room, or checking who is at the front gate) directly within their family Zalo chat group. Integrating Imou smart cameras via the Imou Cloud Open Platform enables the bot to capture real-time snapshots on demand and perform AI Vision analysis using Gemini, eliminating the need to open separate mobile apps or expose internal home network ports.

## What Changes

- Add **Imou Cloud API Client** (`imou-client.ts`) supporting Imou OpenAPI authentication, MD5 request signature calculation, automatic token caching & renewal, and device snapshot capture (`setDeviceSnapEnhanced` with graceful fallback to `setDeviceSnap`).
- Add **Camera Toolset** for LLM function calling (`camera.ts`):
  - `camera_list`: View all configured cameras in the family.
  - `camera_capture`: Trigger real-time snapshot, optionally send the photo directly to the Zalo chat channel (`zalo.sendPhoto`), and optionally analyze the scene with Gemini Vision to answer visual questions.
- Add **Static Image Route** in Fastify server (`GET /images/camera/:filename`) to safely serve captured camera snapshots with public URLs so Zalo servers can retrieve them.
- Add **Environment Configuration** for Imou credentials (`IMOU_APP_ID`, `IMOU_APP_SECRET`, `IMOU_BASE_URL`, `IMOU_CAMERAS`, `IMOU_DEVICE_ID`, `IMOU_CHANNEL_ID`, `IMOU_DEVICE_NAME`).
- Update **Web Admin Dashboard** (`web-admin`):
  - Add Imou Camera settings section to configure App ID, App Secret, Regional API Gateway, and registered cameras.
  - Add connection testing endpoint (`POST /api/admin/settings/test-imou`) to test Imou credentials and snapshot capability.
- Update **System Prompt** in `llm/client.ts` to guide the model on camera listing, snapshot capturing, and vision analysis.

## Capabilities

### New Capabilities
- `imou-camera`: Connect to the Imou Cloud Open Platform API to list cameras, capture on-demand snapshots, send photos to Zalo chat channels, and perform AI Vision visual inspections on camera scenes.

### Modified Capabilities
- `web-admin`: Extend admin settings schema and UI to support Imou API credentials, regional gateway configuration, camera definitions, and camera connectivity testing.

## Impact

- **Backend**:
  - New files: `apps/backend/src/camera/imou-client.ts`, `apps/backend/src/tools/camera.ts`, and test files.
  - Modified: `apps/backend/src/config.ts`, `apps/backend/src/delivery.ts`, `apps/backend/src/server.ts`, `apps/backend/src/admin/routes.ts`, `apps/backend/src/admin/settings-helper.ts`, `apps/backend/src/llm/client.ts`.
- **Frontend Admin**:
  - Modified: `apps/admin/src/components/SettingsPage.tsx`, `apps/admin/src/api.ts`, `apps/admin/src/hooks/useAdminQueries.ts`.
- **Dependencies**: Uses native Node.js `crypto` for MD5 signature calculation and standard `fetch` for Imou OpenAPI requests; no heavy external SDKs required.
