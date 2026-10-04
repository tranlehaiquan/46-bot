## Why

Families frequently manage shared tasks, groceries, and packing lists together in their group chat. Currently, the bot can converse but has no tools to store or manipulate structured data. Adding shared list tools allows family members to collaboratively create lists, append items, mark them as completed, remove items, and display list statuses naturally via conversational Vietnamese or English.

## What Changes

- Add database schema migrations for `lists` and `list_items` tables in SQLite.
- Create a data-access repository (`ListRepository`) to create, query, update, check off, and delete lists and list items scoped to `chat_id`.
- Implement AI SDK tool definitions using `zod` schemas for:
  - `list_create`: create a new list with a name
  - `list_add_item`: add one or multiple items to a list
  - `list_check_item`: mark an item as done or undone
  - `list_remove_item`: remove an item from a list
  - `list_show`: retrieve the contents and status of a list (or all lists in the chat)
- Enable multi-step tool calling in the LLM service with `maxSteps: 4` so the model can inspect list state and confirm actions in a single turn.

## Capabilities

### New Capabilities
- `shared-lists`: Manage shared lists (shopping, todo, packing) within a chat, including creating lists, adding/removing/checking items, and displaying lists with clear completion indicators.

### Modified Capabilities
- None

## Impact

- **Database**: Adds `lists` and `list_items` tables and indices to `/data/family.db`.
- **LLM**: Extends `createLlmClient` to accept tool definitions and execute tool loops up to 4 steps.
- **Dependencies**: Uses `zod` (already installed) and `ai` tool calling.
