## Context

Phase 1 established SQLite persistence, webhook processing, group mention filtering, and conversation generation with Gemini / DeepSeek. Phase 2 introduces tool calling so that family members can create, update, check off, and display shared lists (e.g. shopping, chores, packing) directly from conversation.

## Goals / Non-Goals

**Goals:**
- Implement SQLite tables `lists` and `list_items` behind a `ListRepository`.
- Ensure lists are scoped by `chat_id` and identified case-insensitively (e.g. "mua sắm" matches "Mua Sắm").
- Implement tools `list_create`, `list_add_item`, `list_remove_item`, `list_check_item`, and `list_show` using `zod` schemas and Vercel AI SDK `tool()` definitions.
- Cap tool loop execution at `maxSteps: 4` per request.
- Provide clean, friendly summaries of list contents with markdown-friendly check status (`[x]` / `[ ]`).

**Non-Goals:**
- Event scheduling or reminders (deferred to Phase 3).
- Long-term memory or memory book (deferred to Phase 5).
- Cross-chat list sharing (each chat has its own isolated lists).

## Decisions

### 1. Schema & Constraints
- Table `lists`: `(id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL)`.
  Unique index on `(chat_id, LOWER(name))` to prevent duplicate list names in the same chat.
- Table `list_items`: `(id INTEGER PRIMARY KEY AUTOINCREMENT, list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, added_by TEXT NOT NULL, ts INTEGER NOT NULL)`.
  Index on `(list_id, done, ts ASC)`.

### 2. Name Resolution & Fuzzy Item Matching
- List lookups match `name.trim().toLowerCase()`.
- If a user asks to add items to a list that does not exist yet, the tool automatically creates the list or allows `list_add_item` with `autoCreate: true` so family members don't have to run a separate create step before adding items.
- Item removal and checking accept either item ID or case-insensitive text substring match.

### 3. Tool Loop in LLM Client
- Tools are passed into `generateText` with `maxSteps: 4`.
- The system prompt is enriched with instructions on when to use list tools and how to present list items.

## Risks / Trade-offs

- **[Risk] Multiple items added in one sentence ("mua trứng, sữa, và bánh mì")** → Mitigation: `list_add_item` accepts an array of strings (`items: string[]`) or the LLM can call `list_add_item` with multiple items at once.
- **[Risk] Accidental item deletion** → Mitigation: `list_check_item` marks items as done instead of permanently deleting them, preserving completed items for review until explicitly removed.
