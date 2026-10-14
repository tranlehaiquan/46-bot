## 1. Imou Cloud API Client & Configuration

- [x] 1.1 Add Imou environment variables & config schemas in `apps/backend/src/config.ts` and `.env.example`
- [x] 1.2 Implement `apps/backend/src/camera/imou-client.ts` with signature computation, token caching, and snapshot capture
- [x] 1.3 Add unit tests for `ImouClient` in `apps/backend/src/camera/imou-client.test.ts`

## 2. Camera Snapshot Storage & Fastify Image Serving

- [x] 2.1 Implement `getCameraImageDir` and static image endpoint `/images/camera/:filename` in `apps/backend/src/server.ts`
- [x] 2.2 Add server tests for `/images/camera/:filename` in `apps/backend/src/server.test.ts`

## 3. LLM Camera Tools & Vision Inspection

- [x] 3.1 Implement `apps/backend/src/tools/camera.ts` with `camera_list` and `camera_capture` (integrating photo delivery & Gemini Vision analysis)
- [x] 3.2 Wire camera tools into `delivery.ts` and update system prompt in `apps/backend/src/llm/client.ts`
- [x] 3.3 Add unit tests for camera tools in `apps/backend/src/tools/camera.test.ts`

## 4. Web Admin Integration & Verification

- [x] 4.1 Add Imou test endpoint `POST /api/admin/settings/test-imou` and setting keys in `apps/backend/src/admin/routes.ts`
- [x] 4.2 Update Admin frontend `api.ts`, `useAdminQueries.ts`, and `SettingsPage.tsx` with Imou Camera configuration and connection testing
- [x] 4.3 Verify full project build, typecheck, and test suite across backend and admin
