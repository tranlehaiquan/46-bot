# shared-lists Specification

## Purpose

Provide shared list management (shopping lists, todo lists, packing lists) in family and private chats via LLM tool execution with persistent storage in SQLite.

## Requirements

### Requirement: Create and query lists by chat
The system SHALL store lists scoped to `chat_id` in SQLite. List names SHALL be unique per chat (case-insensitive). When creating a list that already exists in that chat, the system SHALL return the existing list rather than duplicating or failing.

#### Scenario: Creating a new list
- **WHEN** a user asks to create a list named "Đi chợ"
- **THEN** a new list record is created under the current `chat_id` and confirmation is returned

#### Scenario: Creating a list with existing name
- **WHEN** a list named "Đi chợ" already exists and a user requests creating "đi chợ"
- **THEN** the existing list is returned without creating a duplicate

### Requirement: Add items to list
The system SHALL allow adding one or more items to a specified list. Each item SHALL record the item text, the sender's display name or ID (`added_by`), and creation timestamp. If the specified list does not exist, the system SHALL automatically create the list.

#### Scenario: Adding items to an existing list
- **WHEN** a user says "thêm trứng và sữa vào danh sách đi chợ"
- **THEN** two new items ("trứng", "sữa") are created under the "Đi chợ" list with `done = 0`

#### Scenario: Adding items to a non-existent list
- **WHEN** a user says "thêm lều vào danh sách cắm trại" and no list named "cắm trại" exists
- **THEN** the "cắm trại" list is created automatically and the item is appended

### Requirement: Check off or uncheck items
The system SHALL allow marking list items as completed (`done = 1`) or uncompleted (`done = 0`). The item may be identified by its ID or by text match.

#### Scenario: Checking off an item
- **WHEN** a user says "đã mua trứng rồi"
- **THEN** the item matching "trứng" in the active list is marked as `done = 1`

#### Scenario: Unchecking an item
- **WHEN** a user says "chưa mua trứng, bỏ check giúp mình"
- **THEN** the item matching "trứng" is marked as `done = 0`

### Requirement: Remove items from list
The system SHALL allow removing items permanently from a list by item ID or text match.

#### Scenario: Removing an item
- **WHEN** a user asks to remove "bánh mì" from the list
- **THEN** the item is deleted from the list items table

### Requirement: Display list contents
The system SHALL retrieve and format list items for a given list name or list all lists in the current chat. Completed items SHALL be visibly distinguishable from pending items (e.g. `[ ]` vs `[x]`).

#### Scenario: Showing a list with mixed items
- **WHEN** a user asks "xem danh sách đi chợ"
- **THEN** the bot outputs the list name and all items grouped or marked with their completion status

#### Scenario: Showing empty or non-existent list
- **WHEN** a user asks to view a list that has no items
- **THEN** the bot indicates that the list is empty
