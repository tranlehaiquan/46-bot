## Context

Family members interacting with the chatbot often request pictures, drawings, or visual aids (e.g., "vẽ hình chú mèo đang nhảy múa", "tạo ảnh cảnh bình minh ở Đà Lạt"). The current chatbot engine only supports text responses, OCR image interpretation, and SVG calendar event schedule rendering. 

Google's Gemini platform supports dedicated image generation through Imagen 3 models (`imagen-3.0-generate-002`). By combining `@ai-sdk/google`'s image model support with our existing Zipline image storage integration, the chatbot can synthesize high-quality images and immediately dispatch them to Zalo chat channels.

## Goals / Non-Goals

**Goals:**
- Provide an `image_generate` tool in the AI toolset that the LLM agent can call when a user requests drawing or generating images.
- Use Google's `imagen-3.0-generate-002` model using the configured `GEMINI_API_KEY`.
- Automatically upload the generated image buffer to Zipline to acquire a public URL.
- Dispatch the image to the chat via `zalo.sendPhoto(chatId, photoUrl, prompt)`.
- Support configuration of the image model through environment variable `GEMINI_IMAGE_MODEL` and dynamic overriding in Web Admin settings (`geminiImageModel` / `gemini_image_model`).
- Update system prompt instructions to guide the model to invoke `image_generate` upon drawing or image generation requests.

**Non-Goals:**
- Image-to-image editing, inpainting, or masking (out of scope for initial release).
- Hosting image binaries on local file storage (Zipline is our established image storage solution).
- Supporting DeepSeek for image generation (DeepSeek-chat is text-only; image generation requires Gemini API key).

## Decisions

### 1. Dedicated Tool `image_generate` with Tool Calling
- **Decision**: Implement `image_generate` as a tool provided to `generateText` alongside existing tools (`weather_check`, `web_search`, `event_send_image`, etc.).
- **Rationale**: The user speaks in natural Vietnamese or English. The main LLM (Gemini 2.5/Flash or DeepSeek) interprets user intent, formulates a rich visual prompt, and calls `image_generate`.
- **Alternatives considered**:
  - Keyword-based interceptor regex: Brittle and fails to handle nuanced expressions or conversational context.

### 2. Using `@ai-sdk/google` and `ai` `generateImage`
- **Decision**: Use `generateImage({ model: google.imageModel(modelName), prompt })` from the existing `ai` and `@ai-sdk/google` libraries.
- **Rationale**: The packages are already installed in `apps/backend/package.json`. No new dependencies are introduced.
- **Alternatives considered**:
  - `@google/genai` standalone SDK: Adds duplicate SDK overhead.
  - Raw fetch to `https://generativelanguage.googleapis.com/v1beta/...`: More boilerplate and manual token management.

### 3. Pipeline: Generate -> Zipline Upload -> Zalo `sendPhoto`
- **Decision**: `image_generate` generates the image binary in memory, uploads it to Zipline via `uploadImageToZipline`, and calls `context.zalo.sendPhoto(chatId, url, caption)`.
- **Rationale**: Zalo requires a publicly accessible HTTPS image URL. Zipline already provides this exact capability, matching how `event_send_image` works.
- **Alternatives considered**:
  - Sending base64 to Zalo: Not supported by standard Zalo Bot API `sendPhoto`.

### 4. Admin Settings Configuration
- **Decision**: Add `gemini_image_model` to `system_settings` table, exposed via `/api/admin/settings` (GET and PATCH) with `geminiImageModel`, defaulting to `imagen-3.0-generate-002`.
- **Rationale**: Allows administrators to adjust or upgrade to newer Imagen versions (e.g. Imagen 3 Fast or future iterations) without code changes or restarts.

## Risks / Trade-offs

- **[Risk] Missing or invalid `GEMINI_API_KEY`**: If the bot is configured with DeepSeek without a Gemini API key, image generation cannot proceed.
  - *Mitigation*: The tool verifies the Gemini API key, returning a clear message: "Cần cấu hình Gemini API Key để sử dụng tính năng tạo hình ảnh."
- **[Risk] Zipline not configured**: Zalo cannot receive local buffers without a hosted URL.
  - *Mitigation*: The tool warns the user/admin that Zipline must be configured in Admin Settings to enable sending photos.
- **[Risk] Image safety / content policy filters**: Imagen models may block certain prompts.
  - *Mitigation*: Catch API errors and safety blocks gracefully, returning an informative message to the user rather than failing silently or crashing.
- **[Risk] Generation latency**: Image synthesis can take 4-8 seconds.
  - *Mitigation*: The tool runs asynchronously within the LLM step execution. Fastify webhook responds promptly or processes within allowable HTTP timeout.
