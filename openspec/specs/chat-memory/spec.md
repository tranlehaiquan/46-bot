# chat-memory Specification

## Purpose

Provide persistent deduplication of webhook message deliveries and store short-term conversation turns using SQLite so the assistant maintains conversational context and avoids duplicate processing.
## Requirements
### Requirement: Persistent deduplication via SQLite
The system SHALL persist received message IDs in a SQLite table (`seen_messages`) located at `DB_PATH`. A delivery whose message ID exists in `seen_messages` SHALL be ignored and SHALL NOT be processed or answered.

#### Scenario: Duplicate message across process restarts
- **WHEN** a message is received, processed, and recorded in SQLite, and the process restarts
- **THEN** a redelivery of that same message ID is identified as seen and no response is sent

#### Scenario: First-time message
- **WHEN** a new message ID arrives that is not present in `seen_messages`
- **THEN** the ID is inserted into `seen_messages` and the message is allowed to proceed to processing

### Requirement: Short-term conversation history storage
The system SHALL persist incoming and outgoing messages in a `messages` table with columns: `id`, `chat_id`, `sender_id`, `sender_name`, `role`, `content`, and `ts`. When preparing context for an LLM query, the system SHALL retrieve the last 20 messages for that `chat_id` in chronological order.

#### Scenario: Saving user and assistant turns
- **WHEN** a valid user message is processed and an assistant reply is generated
- **THEN** both the user's message and the assistant's reply are recorded in the `messages` table under that `chat_id`

#### Scenario: Retrieving recent history
- **WHEN** a new message arrives in a chat that already contains 30 recorded messages
- **THEN** only the 20 most recent messages for that chat are passed into the LLM context window

### Requirement: Database initialization and configuration
The system SHALL connect to SQLite at `DB_PATH` (defaulting to `/data/family.db`) on startup, enable WAL mode (`PRAGMA journal_mode = WAL`), set a busy timeout of at least 5000ms, and automatically execute schema migrations if tables do not exist.

#### Scenario: Database initialization on fresh start
- **WHEN** the bot boots up and the database file does not exist
- **THEN** the database file and directory are created, WAL mode is enabled, and the required tables (`seen_messages`, `messages`) are initialized

### Requirement: Active memory injection into system prompt
The system SHALL query active memories from the `memories` table for the current `chat_id`, prioritizing `core` category memories, and inject them into the system prompt under a dedicated section titled "Things you know about this family:" on every LLM request, subject to a configured prompt budget (default maximum of 20 items). Non-core memories exceeding the budget SHALL NOT be injected into the system prompt, but SHALL remain available for on-demand query via memory tools. The memory prefix SHALL remain stable across requests to maximize LLM prompt caching efficiency.

#### Scenario: Core memories loaded within budget
- **WHEN** a user message arrives in a chat that has stored active memories within the budget cap
- **THEN** all active core memories for that chat are formatted and included in the system prompt before user turns are processed

#### Scenario: Memories exceed budget cap
- **WHEN** a chat has 35 stored active memories and the budget cap is 20
- **THEN** only the top 20 prioritized active memories are injected into the system prompt, while remaining memories are excluded from the prompt and remain accessible via memory lookup tools

#### Scenario: Chat with no memories
- **WHEN** a message arrives in a chat with no stored memories
- **THEN** the system prompt is generated without the memories list and conversation proceeds normally

### Requirement: Action-sensitive formatting and expiry handling in system prompt
When injecting memories into the system prompt under "Things you know about this family:", any memory whose `expiresAt` timestamp has elapsed SHALL be excluded from prompt context. For active memories containing `condition` or `avoidAction`, the system prompt line SHALL include cautionary notes (e.g., `(Lưu ý: <avoidAction> | Điều kiện: <condition>)`).

#### Scenario: Excluding expired memories from system prompt
- **WHEN** an active memory has an `expiresAt` timestamp in the past
- **THEN** it is filtered out of the memories formatted into the system prompt

#### Scenario: Formatting avoid-action directives in system prompt
- **WHEN** an active memory includes an `avoidAction` string
- **THEN** it is formatted as `- <subject>: <fact> (Lưu ý: <avoidAction>)` in the prompt

