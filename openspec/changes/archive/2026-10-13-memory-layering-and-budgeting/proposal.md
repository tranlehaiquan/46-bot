## Why

Currently, 46-bot fetches every stored fact in the `memories` table for a chat and injects all of them into the LLM system prompt on every single turn. As a family chat accumulates facts over weeks and months (dietary preferences, habits, minor notes, updates), this causes prompt token bloat, increases LLM response latency and cost, and risks diluting the instruction hierarchy.

This change introduces memory layering and budgeting inspired by OpenClaw's memory architecture: separating compact, durable Core Profile facts (injected into prompt under a strict budget cap) from detailed/episodic working facts (stored in DB and retrieved on-demand via tools), with explicit support for superseding outdated facts.

## What Changes

- **Memory Layering Schema**: Enhance the `memories` schema to support categories/tiers (such as `core` for essential profile traits like allergies, permanent habits, and relationships vs `general` for episodic or secondary facts) and an active/superseded status.
- **System Prompt Budgeting**: Enforce a strict budget (e.g. maximum count / token limit, defaulting to top 15-20 core items) when formatting `<memory_context>`. Never dump unbounded memory records into the prompt.
- **Superseding & Deduplication**: Improve `remember` tool behavior to allow explicitly superseding/updating older facts when preferences change (e.g. "Bé Na học lớp 4" supersedes "Bé Na học lớp 3") instead of loose overwrites or duplication.
- **Memory Retrieval Tooling**: Update `list_memories` and introduce on-demand fact lookup so that the bot can query facts outside the core prompt budget when relevant to the conversation.
- **Graceful Migration**: Ensure existing records in `memories` table are automatically backfilled with default core/active categories without data loss.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `chat-memory`: Update active memory injection requirement so the system injects only budgeted Core Profile memories into the system prompt up to a configured threshold, rather than querying and injecting all stored facts unconditionally.
- `long-term-memory`: Update requirements for storing, superseding, and categorizing family facts, adding tier/category attributes (`core` vs `general`) and budget-conscious on-demand retrieval.

## Impact

- **Database**: Add `category` (or `tier`) and `status` columns with default values to the `memories` table via migration/connection schema in `apps/backend/src/db/schema/index.ts`.
- **Repositories**: Update `MemoryRepository` methods in `apps/backend/src/db/repositories/memory.ts` to support category filtering, budgeting, and superseding.
- **LLM Prompting**: Update `formatMemoriesSection` and `buildSystemPrompt` in `apps/backend/src/llm/client.ts` to respect memory budgeting and formatting rules.
- **Tools**: Update `createMemoryTools` in `apps/backend/src/tools/memory.ts` to support categorized memories and on-demand lookups.
- **Tests**: Update and add unit tests across DB repository, tools, prompt formatting, and delivery.
