## Why

In family chat groups, members rarely issue explicit commands like "@bot hãy nhớ rằng...". Instead, they communicate naturally (e.g., "Dạo này ba hay bị đau lưng", "Bé Na chuyển sang thích màu xanh ngọc", "Mẹ ăn chay vào ngày rằm"). Because 46-bot only keeps a sliding window of recent messages, durable personal facts that are not explicitly remembered slide out of context and are lost forever.

This change introduces passive memory extraction (inspired by OpenClaw's pre-compaction silent flush and background dreaming), enabling the bot to automatically and quietly extract, validate, and persist durable family facts, preferences, and traits in the background without requiring explicit user commands or delaying replies.

## What Changes

- **Passive Memory Extractor Module**: Introduce an asynchronous fact extraction pipeline (`extractPassiveMemories`) that evaluates recent conversation turns using structured LLM schema output.
- **Durable Fact Filtering & Taint Gating**: Extract only stable facts (dietary preferences, health notes, hobbies, milestones) while strictly ignoring ephemeral chatter, sensitive data (passwords, banking details, citizen IDs), and prompt injection attempts.
- **Deduplication & Superseding Against Existing Memory**: Check extracted candidates against already stored memories for the chat, superseding outdated facts and avoiding duplicate active entries.
- **Non-blocking Post-Delivery Hook**: Run the extraction asynchronously after Zalo replies have been dispatched, ensuring zero added latency to user chat interactions.
- **Configurability**: Provide a configuration flag (`PASSIVE_MEMORY_ENABLED`, default `true`) so passive extraction can be enabled or disabled via environment variables or system settings.

## Capabilities

### New Capabilities
- `passive-memory-extraction`: Defines requirements for automatic, non-blocking extraction of durable personal facts and preferences from conversation history, including safety filtering, deduplication, and persistence.

### Modified Capabilities
None.

## Impact

- **Extractor Logic**: New extractor module in `apps/backend/src/llm/passive-memory.ts` using AI SDK `generateObject` or schema-driven extraction.
- **Delivery Integration**: Integration in `apps/backend/src/delivery.ts` to trigger asynchronous background extraction after message handling completes.
- **Configuration**: Add `passiveMemoryEnabled` flag in `apps/backend/src/config.ts`.
- **Database**: Reuses existing `MemoryRepository.upsertMemory` with `category` and `status` introduced in Phase 1, marking `createdBy` as `'auto-extracted'`.
- **Tests**: Comprehensive unit tests covering extraction accuracy, ephemeral message rejection, sensitive data gating, and non-blocking delivery behavior.
