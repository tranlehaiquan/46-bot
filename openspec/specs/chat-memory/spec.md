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
