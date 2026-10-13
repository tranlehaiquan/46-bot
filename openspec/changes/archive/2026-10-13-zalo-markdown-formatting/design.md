## Context

Zalo Bot API now supports rich text formatting via `parse_mode: 'markdown'` and `'html'` (or explicit `text_styles` runs) on `POST /bot<TOKEN>/sendMessage`.

The underlying SDK `zalo-bot-js` (v0.2.3) already contains the signature:
```ts
sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<unknown>
```
where `SendMessageOptions` includes `{ parse_mode?: "markdown" | "html", reply_to_message_id?: string }`.

However, the bot codebase was previously engineered to prohibit all Markdown formatting across prompts, delivery mechanisms, and scheduled tasks because Zalo originally only supported plain text.

## Goals / Non-Goals

**Goals:**
- Update `ZaloClient` interface and implementation to support `options?: SendMessageOptions` (forwarding to `zalo-bot-js`).
- Add an automatic, resilient fallback in `ZaloClient.sendMessage`: if sending with `parse_mode` fails (e.g. invalid markup rejected by Zalo API), immediately retry without `parse_mode` as unformatted text.
- Update `DEFAULT_SYSTEM_PROMPT` in `apps/backend/src/llm/client.ts` to instruct the LLM on Zalo-supported Markdown syntax (bold `**`, italic `*`, strikethrough `~~`, headers `#` to `####`, lists `-` / `1.`, blockquotes `>`, and optional colors `{green}`, `{orange}`, `{red}`).
- Explicitly instruct the LLM to avoid unsupported features: no Markdown tables (`|---|---|`) and no markdown links (`[text](url)`).
- Update `SCHEDULED_LOOKUP_SYSTEM_PROMPT` in `apps/backend/src/scheduler/types.ts` to permit Markdown formatting.
- Update `delivery.ts`, `scheduler/worker.ts`, and `scheduler/in-memory.ts` to pass `{ parse_mode: "markdown" }` on outbound message delivery.

**Non-Goals:**
- Client-side rendering changes in `apps/admin` (admin UI can continue displaying raw/stored text or be upgraded in a future change).
- Custom rich text parsing via `text_styles` coordinate calculation (using `parse_mode: "markdown"` is simpler, declarative, and handled by Zalo's server).
- Sending HTML instead of Markdown (Markdown is more natural for LLMs to generate and less token-heavy).

## Decisions

### 1. Use `parse_mode: 'markdown'` rather than `text_styles` or HTML
- *Rationale*: LLMs naturally output Markdown. `text_styles` requires computing UTF-16 character offsets on raw text, which is fragile when dealing with multi-byte Vietnamese unicode characters and emojis. HTML consumes extra token budget and is more verbose.
- *Alternatives considered*:
  - `parse_mode: 'html'`: More verbose, higher token cost, LLMs occasionally emit unclosed tags like `<b>` without `</b>`.
  - `text_styles`: Requires custom offset mapping parser; unnecessary complexity when Zalo's backend provides automatic `parse_mode: 'markdown'`.

### 2. Automatic Fallback to Plain Text on API Failure
- *Rationale*: If an LLM generates malformed Markdown or edge-case markup that Zalo's parser rejects with an HTTP 400 error, falling back to sending raw text ensures the user still receives the response without any outage or loss of information.
- *Alternatives considered*:
  - Let it fail and trigger `FALLBACK_ERROR_MESSAGE`: Degrades user experience unnecessarily when the text itself is completely fine.

### 3. Prompt Guidance on Zalo Markdown Dialect
- *Rationale*: Zalo's markdown parser is not standard CommonMark. Specifically:
  - Zalo does NOT render Markdown tables (`| a | b |`).
  - Zalo does NOT support markdown hyperlink tags `[Title](https://...)` (it strips or breaks them). Raw URLs `https://...` are auto-detected by Zalo clients.
  - Zalo supports custom color and formatting tags like `{green}...{/green}`.
- *Decisions*: Update `DEFAULT_SYSTEM_PROMPT` and `SCHEDULED_LOOKUP_SYSTEM_PROMPT` with clear rules matching Zalo's exact syntax.

### 4. Splitting >2000 character messages
- *Rationale*: `splitText` divides on paragraph/sentence boundaries. While it is theoretically possible for a split to happen inside formatting tags, paragraph-boundary splitting minimizes this. With the fallback in place, any split that results in broken markup will still safely deliver as plain text.

## Risks / Trade-offs

- **[Risk]** LLM produces `[Link text](https://...)` links which Zalo does not render as hyperlinks.
  → *Mitigation*: Explicitly forbid `[text](url)` syntax in the system prompt; instruct the LLM to provide direct raw URLs (`https://...`).
- **[Risk]** LLM produces Markdown tables (`| Col 1 | Col 2 |`).
  → *Mitigation*: Explicitly forbid tables in the system prompt; instruct the LLM to format structured data as bulleted lists.
- **[Risk]** `splitText` cuts in the middle of a formatting token for long responses (>2000 chars).
  → *Mitigation*: `splitText` splits on double newline (`\n\n`) and sentence boundaries first. If a chunk fails Zalo's markdown validation, the delivery fallback retries as plain text.
