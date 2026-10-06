## Why

Currently, the bot only handles text messages (`message.text.received`) and silently ignores image deliveries (`message.image.received`). Users in family chats frequently share photos (receipts, schedules, notes, or general pictures) and expect the bot to see, acknowledge, understand, and answer questions about them. Supporting photo reception and multimodal image processing improves the assistant's usability and feature completeness.

## What Changes

- **Normalize Image Events**: Update webhook payload normalization to parse `message.image.received` events, extracting `photo` (image URL), `caption`, and associated sender/chat metadata.
- **Support Image Delivery Handling**: Update the delivery pipeline to accept `message.image.received` events in both private chats and group chats (when mentioned or addressed via caption/mentions).
- **Multimodal LLM Vision Support**: Enable multimodal vision inputs in the conversation client using `@ai-sdk/google` (Gemini) so the model can inspect image content along with user questions or captions.
- **Graceful Fallbacks**: Provide a clear textual fallback for text-only providers (e.g. DeepSeek) and support canned replies when LLM is not configured.
- **Chat History & Deduplication**: Record received photo messages in the database messages table with appropriate captions and image references.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `zalo-webhook`: Accept and process `message.image.received` webhook deliveries with image URLs and captions instead of discarding them.
- `llm-conversation`: Support multimodal image inputs in the conversational pipeline for vision-capable models (Gemini) with graceful text fallback for text-only models (DeepSeek).

## Impact

- `apps/backend/src/normalize.ts`: Add `photo` and `caption` fields to `IncomingMessage`, parse image payload fields.
- `apps/backend/src/delivery.ts`: Allow `message.image.received` in event filtering, handle addressing in groups via mentions or caption, pass photo URL to LLM and record in chat history.
- `apps/backend/src/llm/client.ts`: Support image content in `generateReply` via Vercel AI SDK image parts for vision providers.
- `apps/backend/src/server.test.ts` & new test files: Update test coverage to assert proper processing and replies for photo events.
