## Why

The bot currently maintains only a short-term 20-message conversation window. Once conversations scroll past, the bot forgets crucial family preferences (e.g. "Ba bị dị ứng đậu phộng", "Bé Na thích màu hồng"), pet details, birthdays, and cherished family stories.

Phase 5 introduces Long-Term Memory and a Family Memory Book in SQLite. Short facts are injected into the system prompt on every request so the bot acts like a true member of the family with persistent knowledge, while memorable narratives are recorded in the Family Memory Book and searchable anytime.

## What Changes

- **Short Facts Storage (`memories` table)**:
  - SQLite table: `memories(id, chat_id, subject, fact, created_by, ts)`.
  - Supports duplicate and conflict detection (updating existing facts rather than accumulating duplicates).
  - Facts for the current `chat_id` are loaded into a stable section of the system prompt (`Things you know about this family: ...`) to benefit from LLM prompt caching.
- **Family Memory Book (`memory_book` table)**:
  - SQLite table: `memory_book(id, chat_id, title, story, people, happened_on, created_by, ts)`.
  - Stores rich stories, childhood milestones, and family moments.
- **Tools Exposed to LLM**:
  - `remember`: Record or update a stable fact/preference.
  - `forget`: Delete a fact by subject/id.
  - `list_memories`: View all facts known about the family or a specific subject.
  - `memory_book_add`: Save a memorable family story or milestone.
  - `memory_book_search`: Search family stories by keyword, people involved, or date.
- **System Prompt Disambiguation & Safety**:
  - Clear instructions guiding the model on tool routing: `remember` (stable facts/preferences) vs `event_add` (dated events/reminders) vs `list_add_item` (shopping/to-do lists) vs `memory_book_add` (stories/milestones).
  - Strict guardrail forbidding the storage of sensitive credentials (passwords, bank accounts, credit cards, ID numbers).

## Capabilities

### New Capabilities
- `long-term-memory`: Persistent short facts memory loaded into the LLM system prompt and a searchable Family Memory Book for family milestones and stories.

### Modified Capabilities
- `chat-memory`: Inject active long-term memories for the chat into the system prompt context alongside recent message history.

## Impact

- **Database (`src/db/migrations.ts`)**: Add migrations for `memories` and `memory_book` tables.
- **Repositories (`src/db/repositories/memory.ts`)**: Implement `MemoryRepository` handling fact CRUD, duplicate resolution, and memory book story search.
- **Tools (`src/tools/memory.ts`)**: Tool handlers for `remember`, `forget`, `list_memories`, `memory_book_add`, and `memory_book_search`.
- **System Prompt (`src/llm/client.ts`)**: Include dynamic memory injection and tool disambiguation guidelines.
- **Delivery Wiring (`src/delivery.ts`)**: Inject `MemoryRepository` and register memory tools in the LLM toolset.
