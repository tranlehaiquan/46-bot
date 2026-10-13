## Why

The Zalo Bot API officially supports Rich Text formatting (`parse_mode: 'markdown'` or `'html'`) on its `sendMessage` endpoint. Currently, 46-bot strictly disables Markdown in system prompts (`llm/client.ts` and `scheduler/types.ts`) and sends messages only as plain text because early versions of the Zalo Bot API lacked rich text support. Consequently, bot responses, daily morning briefings, and lookup reports cannot use bold text, headers, bulleted lists, quotes, or color highlights to improve readability. Enabling Zalo-compatible Markdown formatting will significantly improve the user experience and clarity of the bot's messages on Zalo mobile and desktop apps.

## What Changes

- **Update Zalo Client Interface & Implementation**:
  - Extend `ZaloClient.sendMessage` in `apps/backend/src/zalo-client.ts` to accept options including `parse_mode?: "markdown" | "html"`.
  - Pass `{ parse_mode: "markdown" }` to the underlying `zalo-bot-js` SDK when requested.
  - Implement automatic fallback: if sending with `parse_mode` fails (e.g. malformed markdown rejected by Zalo API), automatically retry sending the message as plain text without crashing or dropping the message.
- **Update LLM System Prompts**:
  - Update `DEFAULT_SYSTEM_PROMPT` in `apps/backend/src/llm/client.ts`: remove the strict plain-text restriction and instruct the model on Zalo's specific Markdown dialect (bold `**`, italic `*`, strikethrough `~~`, headers `#` to `####`, lists `-` / `1.`, blockquotes `>`, and optional color tags `{green}`, `{orange}`, `{red}`).
  - Add explicit rules against Markdown tables (`|---|---|`) and Markdown hyperlinks (`[text](url)`), since Zalo does not render tables or Markdown link tags.
  - Update `SCHEDULED_LOOKUP_SYSTEM_PROMPT` in `apps/backend/src/scheduler/types.ts` to permit Markdown headers, bullet points, and bold text.
- **Update Message Delivery Pipelines**:
  - In `apps/backend/src/delivery.ts`, pass `{ parse_mode: "markdown" }` when delivering conversational LLM responses.
  - In `apps/backend/src/scheduler/worker.ts` and `in-memory.ts`, pass `{ parse_mode: "markdown" }` when sending scheduled lookup and morning briefing messages.
- **Optional Admin Message Sending & Preview**:
  - Allow admin broadcast/messages in `apps/backend/src/admin/routes.ts` to optionally support `parse_mode`.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `llm-conversation`: Update outbound message formatting requirements to support Zalo-compatible Markdown with plain-text fallback, and update LLM prompt requirements to encourage Zalo Markdown formatting while prohibiting tables and bracketed link syntax.
- `scheduled-lookups`: Update report generation requirements to allow Markdown formatting (bold, headers, lists) in periodic scheduled reports.

## Impact

- **Backend**: `apps/backend/src/zalo-client.ts`, `apps/backend/src/delivery.ts`, `apps/backend/src/llm/client.ts`, `apps/backend/src/scheduler/worker.ts`, `apps/backend/src/scheduler/in-memory.ts`, `apps/backend/src/scheduler/types.ts`.
- **Dependencies**: None (`zalo-bot-js` v0.2.3 already contains typing and implementation for `parse_mode`).
- **Tests**: Update server and scheduler tests to accommodate options in `sendMessage` mock and verify fallback behavior.
