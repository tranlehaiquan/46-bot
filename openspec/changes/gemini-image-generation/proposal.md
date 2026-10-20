## Why

Users in family chat groups frequently ask the bot to draw, visualize, or create pictures (e.g., "vẽ cho tôi con mèo", "tạo hình ảnh một chú chó đang bơi"). Currently, the bot only supports text conversations, OCR/vision analysis, and generating calendar event schedule graphics. Giving the bot the capability to generate images using Google's dedicated Imagen model (e.g., `imagen-3.0-generate-002`) via the Gemini API, host them on Zipline, and send them directly to Zalo chats will significantly enrich the assistant's capabilities and user engagement.

## What Changes

- Add an AI image generation tool (`image_generate`) accessible to the LLM agent during conversations.
- Use Google's Gemini Image Generation model (`imagen-3.0-generate-002` via `@ai-sdk/google` or Google Generative AI API) powered by the existing `GEMINI_API_KEY`.
- Integrate generated image binaries directly with the Zipline image storage service to upload and obtain a public URL.
- Dispatch the generated photo directly to the conversation chat via `zalo.sendPhoto(chatId, photoUrl, prompt)`.
- Support configuration of the Gemini image model via environment variable `GEMINI_IMAGE_MODEL` (defaulting to `imagen-3.0-generate-002`) and dynamic configuration via Web Admin settings.
- Add system prompt instructions informing the assistant about its image generation ability and when to call `image_generate`.

## Capabilities

### New Capabilities
- `ai-image-generation`: Text-to-image generation tool using Google Imagen 3 via Gemini API, uploading the resulting image to Zipline, and dispatching it to the origin chat.

### Modified Capabilities
- `web-admin`: Add `geminiImageModel` field to admin settings (GET, PATCH, and UI display) to allow viewing and overriding the image generation model.

## Impact

- **Backend**:
  - `apps/backend/src/config.ts`: Add `GEMINI_IMAGE_MODEL` config option with default `imagen-3.0-generate-002`.
  - `apps/backend/src/tools/image-generation.ts`: New tool `image_generate` using `generateImage` with Google Generative AI `imageModel`, uploading to Zipline, and sending via Zalo client.
  - `apps/backend/src/tools/index.ts`: Export the new tool.
  - `apps/backend/src/llm/client.ts`: Update system prompt instructions to guide image generation requests.
  - `apps/backend/src/admin/routes.ts`: Support `geminiImageModel` / `gemini_image_model` in settings endpoints.
- **Admin Frontend**:
  - `apps/admin/src/pages/SettingsPage.tsx`: Add input field for Gemini Image Model in AI Settings section.
- **Dependencies**: Uses existing `@ai-sdk/google` and `ai` packages (`generateImage`), no new heavy packages required.
