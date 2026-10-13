## Why

Memories in `46-bot` are currently treated as static declarative statements without behavioral boundaries or operational lifecycles. In real-world family life, many observations carry actionable constraints: approval requirements ("Chỉ mua sữa sau khi mẹ kiểm tra tủ lạnh"), temporary health restrictions ("Bố đau lưng, tạm thời không nhắc tập gym nặng"), expiry conditions ("Mẹ bận công tác đến hết thứ Sáu"), or directives to avoid tempting actions.

Inspired by OpenClaw's action-sensitive memory design, this change captures safe-to-act boundaries, conditions, avoid-action directives, and expiration times on memories, ensuring the bot respects family authority and does not take premature or inappropriate actions.

## What Changes

- **Schema Extension**: Add optional `condition`, `avoid_action`, and `expires_at` columns to the `memories` table via SQLite migration.
- **Action Boundary Capture in `remember`**: Allow users and the LLM to record `condition` (when or under what condition the memory applies), `avoidAction` (what the bot should avoid doing), and `expiresAt` (ISO date or timestamp when the constraint expires).
- **Automatic Expiry Filtering**: Filter out expired constraints from active system prompt injection (`listActiveMemories`) while keeping them in historical records.
- **Contextual Prompt Formatting**: Render active action-sensitive constraints with clear behavioral boundaries (e.g., `[Lưu ý: Tránh... | Điều kiện: ...]`) in the bot's system prompt context.
- **Retrieval & Search Inspection**: Include action boundaries in `list_memories` and `memory_search` results.

## Capabilities

### New Capabilities
- `action-sensitive-memories`: Captures behavioral boundaries, conditions, avoid-action rules, and expiry lifecycles on stored memories.

### Modified Capabilities
- `long-term-memory`: Expands memory persistence and tools to store and retrieve action boundaries (`condition`, `avoid_action`, `expires_at`).
- `chat-memory`: Updates prompt memory injection to format action boundaries and automatically omit expired constraints.

## Impact

- **Database**: SQLite schema and migrations in `apps/backend/src/db/`.
- **Repository**: `MemoryRepository` methods updated to accept and return action boundaries.
- **Tools & Prompting**: `createMemoryTools` (`remember`, `list_memories`), `memory_search`, and `delivery.ts` prompt enrichment.
