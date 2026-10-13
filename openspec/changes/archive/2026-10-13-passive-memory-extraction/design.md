## Context

In 46-bot, users converse naturally in group chats without prefixing durable facts with explicit bot commands. The sliding 20-message window in `messages` causes important long-term facts (such as health updates, changing preferences, allergies) to be lost when conversations move forward.

Phase 1 established structured memory tiers (`core` and `general`), status tracking, and prompt budgeting in `memories`. With this foundation in place, Phase 2 implements an automatic background extraction mechanism inspired by OpenClaw's silent turn / pre-compaction flush.

## Goals / Non-Goals

**Goals:**
- Implement a dedicated extractor function `extractPassiveMemories` using structured LLM output (Zod schema) to extract durable facts from recent messages.
- Filter out ephemeral, transactional, or conversational chat (weather comments, greetings, one-off lunch plans).
- Gate extracted facts against sensitive data rules (`containsSensitiveData`) and prompt injection detection (`isMemorySafe`).
- Integrate extraction into `delivery.ts` as an unawaited asynchronous background process so user-facing response times are completely unaffected.
- Deduplicate and update existing facts using `MemoryRepository.upsertMemory` with `created_by: 'auto-extracted'`.
- Provide a configuration toggle `PASSIVE_MEMORY_ENABLED` (default: `true`).

**Non-Goals:**
- Semantic vector embeddings or SQLite FTS search (reserved for Phase 3).
- Action-sensitive temporal constraints or scheduled intents (reserved for Phase 4).

## Decisions

### Decision 1: Structured Schema Extraction with Vercel AI SDK
We use a structured prompt / schema asking the model to evaluate the conversation snippet against existing memories and return an array of `{ subject, fact, category }`.
*Rationale:* Structured JSON output prevents free-form hallucination and allows precise validation before saving.

### Decision 2: Context Window for Extractor
The extractor receives:
- The recent conversation snippet (last 6-10 messages).
- The current active memories for the chat.
*Rationale:* Providing already-known active memories allows the extractor to identify what is truly new or what has changed (superseded), avoiding redundant writes.

### Decision 3: Multi-Layer Taint Gating & Safety Checks
Every extracted candidate is passed through:
1. `containsSensitiveData(subject, fact)`: rejects passwords, bank accounts, credit cards, citizen IDs.
2. `isMemorySafe(subject, fact)`: rejects prompt injection attempts disguised as memory items.
*Rationale:* Prevents malicious user messages in group chats from injecting adversarial directives into durable memory.

### Decision 4: Non-Blocking Background Hook in `delivery.ts`
After the bot finishes answering and sending replies to Zalo, the passive extraction task is spawned asynchronously:
```ts
if (config.passiveMemoryEnabled && memoryRepo && llmClient) {
  extractPassiveMemories({ chatId, history, memoryRepo, llmClient })
    .catch((err) => log.warn({ event: "passive_memory_extraction_failed", error: err.message }));
}
```
*Rationale:* Completely isolates the user-facing latency from the extraction LLM turn.

## Risks / Trade-offs

- **[Risk]** Extra LLM calls consume additional API tokens.
  → *Mitigation*: Only run extraction when user messages contain substantive text (skip short acknowledgments like "ok", "dạ", or bot-only turns) and provide a config flag to disable if desired.
- **[Risk]** The model might occasionally extract a temporary fact as durable.
  → *Mitigation*: Strict system prompt instructions distinguishing durable traits from ephemeral statements, plus users can always use `forget` tool if an unwanted fact is saved.
