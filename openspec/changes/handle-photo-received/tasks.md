## 1. Webhook Payload Normalization

- [x] 1.1 Extend `IncomingMessage` in `apps/backend/src/normalize.ts` with optional `photo` and `caption` fields.
- [x] 1.2 Parse `photo` and `caption` from payload in `normalizeDelivery` and ensure `text` falls back to `caption || text || ""`.
- [x] 1.3 Update `isMentionedOrReplied` in `apps/backend/src/normalize.ts` to inspect mentions and both `text` and `caption` for `@`.

## 2. Delivery Pipeline & Addressing

- [x] 2.1 Update event filtering in `apps/backend/src/delivery.ts` to allow `message.image.received` alongside `message.text.received`.
- [x] 2.2 Record photo references in message repository when saving incoming message turns in `apps/backend/src/delivery.ts`.
- [x] 2.3 Pass `photo` URL into `llmClient.generateReply` parameters.

## 3. Multimodal LLM Client Vision Integration

- [x] 3.1 Update `LlmClient` interface in `apps/backend/src/llm/client.ts` to accept optional `photo` in `incomingMessage`.
- [x] 3.2 Implement multimodal user content generation for Gemini provider using Vercel AI SDK image parts.
- [x] 3.3 Implement textual indicator fallback for text-only providers (DeepSeek).

## 4. Testing & Verification

- [x] 4.1 Update webhook tests in `apps/backend/src/server.test.ts` to assert `message.image.received` is processed and answered in private and mentioned group chats.
- [x] 4.2 Add test cases verifying multimodal vision message generation, caption parsing, and fallback formatting.
- [x] 4.3 Run `npm test` across `apps/backend` to verify all tests pass without regression.
