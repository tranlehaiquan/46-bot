## Context

46-bot currently stores family facts in a flat SQLite table `memories` (`id`, `chat_id`, `subject`, `fact`, `created_by`, `ts`). On every incoming message, `delivery.ts` retrieves all memories for that chat via `memoryRepo.listMemories(chatId)` and renders them into `<memory_context>` inside `buildSystemPrompt`.

While simple, this approach causes unbounded system prompt growth as the chat accumulates facts over time. Inspired by OpenClaw's memory layering (`USER.md` profile directives vs working memory files), this design implements tiered memory storage and prompt budgeting in 46-bot.

## Goals / Non-Goals

**Goals:**
- Extend the `memories` table schema to include `category` (`'core'` | `'general'`) and `status` (`'active'` | `'superseded'`).
- Enforce a deterministic prompt budget for `<memory_context>` (prioritizing active core facts up to a configurable cap, default: 20 items).
- Provide clean superseding semantics when facts change over time so conflicting active facts are eliminated.
- Equip the LLM with on-demand tools to query non-core or specific memories that are not present in the prompt budget.
- Maintain backward compatibility and seamless migration for existing SQLite databases.

**Non-Goals:**
- Automatic background extraction or silent-turn memory flush (reserved for Phase 2).
- Vector embeddings and semantic hybrid search (reserved for Phase 3).
- Time-based automatic expiry or cron triggers for memory (reserved for Phase 4).

## Decisions

### Decision 1: Schema Extension in SQLite / Drizzle
We add two columns to `memories`:
- `category`: text with allowed values `'core'` | `'general'`, defaulting to `'core'`.
  - `core`: Essential durable identity/profile facts (allergies, health notes, relationships, stable habits).
  - `general`: Episodic, contextual, or secondary facts.
- `status`: text with allowed values `'active'` | `'superseded'`, defaulting to `'active'`.

*Rationale:* Existing rows migrate seamlessly by defaulting to `'core'` and `'active'`. No existing family memory is lost or hidden on upgrade.

### Decision 2: Priority Ordering & Prompt Budget Cap
In `delivery.ts` and `buildSystemPrompt`:
- Query only `status = 'active'` memories for the chat.
- Order by `category = 'core'` DESC, then `ts` DESC.
- Cap the injected list at `MAX_ACTIVE_PROMPT_MEMORIES = 20`.
- If active memories exceed this cap, only the top 20 are formatted into `<memory_context>`. The rest remain accessible via tools.

*Rationale:* Simple, fast, deterministic, and cache-friendly. Eliminates token blowup while guaranteeing critical profile traits are always present in the context window.

### Decision 3: Superseding & Updating in `remember` Tool
Update `remember` tool parameters to accept an optional `category` (defaulting to `'core'`) and improve `upsertMemory`:
- If an active fact for the exact subject already exists, updating it sets the new fact and updates timestamp.
- The tool can also mark outdated conflicting entries as `superseded` when a replacement is recorded.

### Decision 4: On-Demand Tooling (`list_memories` enhancement)
Enhance `list_memories` to accept optional `category` and `query` parameters. When the LLM needs to check facts not provided in `<memory_context>`, it can query them dynamically.

## Risks / Trade-offs

- **[Risk]** Facts excluded by the budget cap might be missed if the LLM forgets to call `list_memories`.
  → *Mitigation*: Update system prompt instructions to inform the LLM that secondary memories can be looked up using `list_memories`.
- **[Risk]** Existing databases on disk lack the new columns.
  → *Mitigation*: In database connection startup (`connection.ts`), execute idempotent `ALTER TABLE memories ADD COLUMN` statements wrapped in safety checks.
