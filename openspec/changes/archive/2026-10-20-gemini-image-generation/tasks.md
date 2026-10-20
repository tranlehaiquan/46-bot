## 1. Configuration & Settings

- [x] 1.1 Add `GEMINI_IMAGE_MODEL` configuration option in `apps/backend/src/config.ts` defaulting to `imagen-3.0-generate-002`
- [x] 1.2 Support `gemini_image_model` and `geminiImageModel` in settings repository and backend admin endpoints (`GET` and `PATCH /api/admin/settings`)
- [x] 1.3 Add Gemini Image Model configuration field to the Admin Settings UI in `apps/admin/src/pages/SettingsPage.tsx`

## 2. Core Image Generation Tool

- [x] 2.1 Implement `createImageGenerateTool` in `apps/backend/src/tools/image-generation.ts` utilizing `@ai-sdk/google` and `generateImage` from `ai`
- [x] 2.2 Handle image upload to Zipline via `uploadImageToZipline` and dispatch photo to origin chat via `zalo.sendPhoto`
- [x] 2.3 Export the tool in `apps/backend/src/tools/index.ts` and register it in the bot's conversation toolset

## 3. System Prompt Guidance

- [x] 3.1 Update `DEFAULT_SYSTEM_PROMPT` in `apps/backend/src/llm/client.ts` instructing the assistant to call `image_generate` when users ask to draw, paint, or create pictures

## 4. Testing & Validation

- [x] 4.1 Add unit tests for `image_generate` covering generation, Zipline upload, Zalo photo dispatch, and error conditions
- [x] 4.2 Add unit tests for `geminiImageModel` in admin settings API tests
- [x] 4.3 Run the full test suite and verify build passes cleanly (`pnpm test` and `pnpm build`)
