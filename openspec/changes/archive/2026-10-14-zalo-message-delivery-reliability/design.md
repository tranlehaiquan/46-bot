## Context

In `zalo-bot-js`, calling `bot.sendMessage` does not throw when the Zalo API rejects a message payload; it returns a `Message` object with a synthetic fallback ID starting with `local-` (e.g. `local-1728900182000`). Consequently, in `apps/backend/src/zalo-client.ts`, `try { await bot.sendMessage(chatId, payloadText, options); } catch` was never catching Markdown rejection errors, causing formatted messages rejected by Zalo to be silently dropped without triggering the fallback.

Furthermore, multi-byte Vietnamese responses (especially long lists like 1800+ chars) easily exceed 2.5KB, potentially triggering Zalo's single-message size limits when chunked at 2000 characters.

## Goals / Non-Goals

**Goals:**
- Detect `local-` message IDs in `zalo.sendMessage` and treat them as API failures.
- Ensure the plain-text fallback executes whenever Markdown sending returns a `local-` ID or throws.
- Fail loudly if even plain-text sending returns a `local-` ID so that callers and error loggers know the message was not delivered.
- Reduce chunk size limit from 2000 to 1200 characters across `delivery.ts` and `scheduler/tasks.ts`.
- Add test coverage in `zalo-client.test.ts`.

**Non-Goals:**
- Modifying `zalo-bot-js` library internals directly (we wrap its return values).
- Changing prompt instruction rules or model settings.

## Decisions

### Decision 1: Inspect `messageId` on `bot.sendMessage` result
`zalo-client.ts` will check the returned object:
```ts
function isLocalRejection(res: unknown): boolean {
  if (res && typeof res === "object" && "messageId" in res) {
    const id = String((res as { messageId?: string }).messageId ?? "");
    return id.startsWith("local-");
  }
  return false;
}
```
If `isLocalRejection(res)` is true:
- On Markdown send: throw `new Error(...)`, triggering the `catch` block which strips `parse_mode` and retries.
- On plain-text send: throw `new Error(...)`, ensuring the error bubbles to `log.error({ event: "zalo_send_error" })` or triggers top-level error handling.

### Decision 2: Reduce chunk size to 1200 characters
By setting the split boundary to 1200 characters:
- Short messages (< 1200) still send as 1 message.
- Medium/long messages (1200–2400) cleanly split across 2 chunks, well within Zalo's single-message limits and safe for UTF-8 Vietnamese diacritics.

## Risks / Trade-offs

- **[Risk] Multiple messages for long lists** → Splitting long lists at 1200 chars may create 2 messages instead of 1, but guarantees delivery and readability on mobile screens.
