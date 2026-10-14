## Why

When Zalo messages fail or are rejected by the Zalo API (due to invalid Markdown syntax, unsupported entities, or payload limits), the underlying `zalo-bot-js` SDK does not throw an exception; instead, it returns a synthetic fallback `Message` object whose `messageId` begins with `local-`.

Because `zalo.sendMessage` in `apps/backend/src/zalo-client.ts` only relies on `try/catch` without checking the returned `messageId`, silent API rejections are treated as successful sends. As a result, the delivery layer never activates the plain-text fallback, the server falsely logs `zalo_reply_sent`, and the message is lost in the chat while the bot's conversation history believes it was successfully delivered. Additionally, the current 2000-character chunking limit can cause multi-byte Vietnamese messages (1800+ characters) to exceed Zalo's single-message size limit.

## What Changes

- Update `sendMessage` in `apps/backend/src/zalo-client.ts` to inspect the response from `bot.sendMessage`:
  - If the returned `messageId` starts with `local-`, treat it as an API rejection and throw an error.
  - In the `catch` block, retry with plain text (without `parse_mode`).
  - If the plain-text fallback also returns a `local-` message ID, throw an error so the failure is properly logged.
- Reduce the default chunk threshold from 2000 characters to a safe limit of 1200 characters in `apps/backend/src/delivery.ts` and `apps/backend/src/scheduler/tasks.ts`.
- Update unit tests in `apps/backend/src/zalo-client.test.ts` to verify that `local-` message IDs trigger the plain-text fallback.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `llm-conversation`: Update outbound message chunking to a safe 1200-character threshold and ensure Zalo API rejections (including `local-` message ID fallbacks) strictly trigger the plain-text fallback.

## Impact

- `apps/backend/src/zalo-client.ts`: Verification of message ID prefix on `bot.sendMessage`.
- `apps/backend/src/delivery.ts`: Lower chunking threshold for chat replies.
- `apps/backend/src/scheduler/tasks.ts`: Lower chunking threshold for background lookups.
- `apps/backend/src/zalo-client.test.ts`: Added test cases for `local-` rejection and fallback.
