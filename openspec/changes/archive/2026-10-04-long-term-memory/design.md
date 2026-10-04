## Context

Currently, the bot only retains the last 20 messages in conversation history. Once conversation turns roll over, family facts, member preferences, and shared stories are forgotten. Phase 5 adds:
1. A short facts table (`memories`) injected on every request into the system prompt.
2. A family storybook table (`memory_book`) with keyword and metadata search.
3. Memory management tools (`remember`, `forget`, `list_memories`, `memory_book_add`, `memory_book_search`).
4. System prompt disambiguation guidelines and privacy guardrails.

## Goals / Non-Goals

**Goals:**
- Store and retrieve family facts per `chat_id`.
- Automatically inject active memories into the system prompt with a stable prefix to support LLM prompt caching.
- Prevent duplicate facts by updating existing facts when new information about a subject arrives.
- Provide a searchable Family Memory Book for milestones and stories.
- Guard against saving sensitive credentials (passwords, bank accounts, cards, ID numbers).
- Provide clear prompt guidance so the LLM correctly distinguishes between `remember` vs `event_add` vs `list_add_item` vs `memory_book_add`.

**Non-Goals:**
- Vector database / embedding models (standard SQLite queries and text matching are fast, lightweight, and zero-dependency).
- Cross-chat memory sharing (each chat has its own isolated memories).

## Decisions

### 1. Database Schema
In `src/db/migrations.ts`:
```sql
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  fact TEXT NOT NULL,
  created_by TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_chat_subject ON memories(chat_id, subject);

CREATE TABLE IF NOT EXISTS memory_book (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  title TEXT NOT NULL,
  story TEXT NOT NULL,
  people TEXT NOT NULL,
  happened_on TEXT,
  created_by TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memory_book_chat ON memory_book(chat_id, ts DESC);
```

### 2. Fact Deduplication & Conflict Resolution
- When `remember(chatId, subject, fact, createdBy)` is called:
  - Normalize subject (trim, case-insensitive match).
  - If a memory with the same `chat_id` and normalized `subject` exists: update the `fact`, `created_by`, and `ts`.
  - Otherwise, insert a new row.

### 3. Memory Book Search
- `searchStories(chatId, query)`:
  - Tokenizes query words and searches across `title`, `story`, and `people` using SQLite `LIKE` `%word%`.
  - Returns matching stories sorted chronologically by `ts DESC`.

### 4. System Prompt Injection
- On every incoming message turn, fetch all memories for `chatId`: `memoryRepo.listMemories(chatId)`.
- Format into the system prompt:
  ```text
  ### Things you know about this family:
  - [Bố]: Thích uống cà phê đen không đường
  - [Mẹ]: Dị ứng hành tây
  - [Bé Na]: Thích màu hồng, học lớp 4
  ```
- If no memories exist, this section is omitted.

### 5. Tool Disambiguation & Privacy Guardrails
- In system prompt:
  - **Tool Routing**:
    - Use `remember`: For stable facts, habits, preferences, and traits.
    - Use `event_add`: For calendar dates, appointments, birthdays, anniversaries, and reminders.
    - Use `list_add_item`: For shopping lists and to-dos.
    - Use `memory_book_add`: For rich stories and past family memories.
  - **Privacy Guardrail**:
    - Never store passwords, bank accounts, OTPs, or government IDs. Politely decline if asked.

## Risks / Trade-offs

- **[Risk] Prompt token bloat if family has hundreds of memories.**
  - *Mitigation*: Short facts are concise single sentences. In practice, family facts range between 10–50 items (~500 tokens), which easily fits modern LLM context windows (128k+ tokens) and benefits from prompt prefix caching.
- **[Risk] User shares a sensitive password by mistake.**
  - *Mitigation*: Both the system prompt and tool definitions instruct the model never to persist credentials.
