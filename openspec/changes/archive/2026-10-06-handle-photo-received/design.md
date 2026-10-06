## Context

The Zalo Bot webhook transmits incoming photos using the event name `message.image.received`. The payload includes:
- `photo`: URL pointing to the image on Zalo servers.
- `caption`: Optional text message sent alongside the image.
- Standard routing fields: `from`, `chat`, `message_id`, `mentions`, `quote`.

Currently, `apps/backend/src/delivery.ts` drops any event that is not `message.text.received`. Furthermore, `IncomingMessage` only holds `text`. This design details how photo messages are normalized, routed, stored, and passed to LLM vision models.

## Goals / Non-Goals

**Goals:**
- Accept and parse `message.image.received` webhook events.
- Allow addressing in group chats through mentions or `@` in caption text, and always accept in private chats.
- Enable multimodal understanding with Gemini (`@ai-sdk/google`) by passing image parts to the Vercel AI SDK.
- Provide clean text-level fallback for text-only LLMs (DeepSeek).
- Persist photo references in chat history for continuous context across turns.
- Provide comprehensive test coverage for photo event processing.

**Non-Goals:**
- Supporting voice (`message.voice.received`) or sticker events in this change (can be added separately).
- Local OCR engine (the LLM's native multimodal capabilities handle OCR and image understanding).

## Decisions

### 1. Payload Normalization (`normalize.ts`)
- **Decision**: Extend `IncomingMessage` with `photo?: string` and `caption?: string`.
- **Text resolution**: Set `text = messageRecord.caption || messageRecord.text || ""`.
- **Addressing check**: When checking `@` in `isMentionedOrReplied`, inspect both `message.text` and `message.caption`.

### 2. Event Dispatching (`delivery.ts`)
- **Decision**: Update filtering condition from `if (message.eventName !== "message.text.received" || message.isBot)` to:
  ```typescript
  const isSupportedEvent = message.eventName === "message.text.received" || message.eventName === "message.image.received";
  if (!isSupportedEvent || message.isBot) {
    return;
  }
  ```
- **Prompt Injection check**: Run safety check against `message.text` (which contains the user's caption if provided).

### 3. Multimodal LLM Processing (`llm/client.ts`)
- **Decision**:
  - Update `LlmClient.generateReply` incoming message type to include optional `photo?: string`.
  - For Gemini: AI SDK supports multimodal content array for user messages:
    ```typescript
    if (params.incomingMessage.photo && options.provider === "gemini") {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: formatUserMessageTag(currentSender, params.incomingMessage.content || "Hãy mô tả hoặc phân tích hình ảnh này.") },
          { type: "image", image: new URL(params.incomingMessage.photo) },
        ],
      });
    }
    ```
  - For text-only providers (DeepSeek): Append image context indicator in text:
    ```typescript
    const promptText = params.incomingMessage.photo
      ? `${params.incomingMessage.content || ""}\n[Ghi chú: Người dùng đã đính kèm một hình ảnh]`
      : params.incomingMessage.content;
    ```

### 4. Conversation History Recording (`message-repo.ts`)
- **Decision**: Record the message in the `messages` table with an inline tag when a photo is present:
  `content: message.photo ? (message.text ? `${message.text}\n[Ảnh: ${message.photo}]` : `[Ảnh: ${message.photo}]`) : message.text`.
  This allows subsequent conversational turns to know that an image was previously shared.

## Risks / Trade-offs

- **[Risk]** Zalo image URLs may be ephemeral or expire after a certain period.
  → **Mitigation**: LLM inference occurs immediately upon webhook delivery when the URL is active and fresh. In conversational history, the URL reference suffices as a pointer; if re-fetching expires, text notes retain semantic context.
- **[Risk]** Gemini image URL fetching network errors.
  → **Mitigation**: Existing LLM error handling catches API failures and returns the polite fallback message (`FALLBACK_ERROR_MESSAGE`).
- **[Risk]** Empty caption when photo is sent.
  → **Mitigation**: If caption is empty, default prompt text guides the model to observe and describe or ask how it can help with the image.
