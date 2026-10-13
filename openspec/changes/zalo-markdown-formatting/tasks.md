## 1. Zalo Client & Fallback Layer

- [x] 1.1 Update `ZaloClient` interface and `createZaloClient` in `apps/backend/src/zalo-client.ts` to support `options?: SendMessageOptions` (`parse_mode?: "markdown" | "html"`).
- [x] 1.2 Implement automatic fallback in `ZaloClient.sendMessage`: if an invocation with `parse_mode` fails, log a warning and retry sending as plain text.
- [x] 1.3 Add unit tests in `apps/backend/src/zalo-client.test.ts` verifying option forwarding and automatic plain-text fallback on parse errors.

## 2. Prompts & Formatting Instructions

- [x] 2.1 Update `DEFAULT_SYSTEM_PROMPT` in `apps/backend/src/llm/client.ts` to teach Zalo Markdown syntax (bold `**`, italic `*`, strikethrough `~~`, headers `#`-`####`, lists, blockquotes `>`, optional color tags) and prohibit tables and bracketed link syntax (`[text](url)`).
- [x] 2.2 Update `SCHEDULED_LOOKUP_SYSTEM_PROMPT` in `apps/backend/src/scheduler/types.ts` to allow Markdown formatting for periodic reports and briefings.

## 3. Delivery Pipeline Integration

- [x] 3.1 Update outbound message delivery in `apps/backend/src/delivery.ts` to pass `{ parse_mode: "markdown" }` when sending chunks.
- [x] 3.2 Update scheduled lookup delivery and morning briefings in `apps/backend/src/scheduler/worker.ts` and `apps/backend/src/scheduler/in-memory.ts` to pass `{ parse_mode: "markdown" }`.

## 4. Testing & Verification

- [x] 4.1 Update test mocks and assertions across `server.test.ts`, `lifecycle.test.ts`, and `scheduler.test.ts` to accommodate `options` in `sendMessage`.
- [x] 4.2 Run the full test suite (`pnpm --filter backend test`) to verify all existing and new tests pass.
