# channel-management Specification

## Purpose
Manage channel lifecycle, storage, and runtime gating for both group and direct message channels interacting with 46-bot.

## Requirements

### Requirement: Dynamic channel storage
The system SHALL persist channels in a `channels` database table storing `chat_id`, `name`, `chat_type` ('GROUP' or 'PRIVATE'), `status` ('pending', 'active', or 'disabled'), `created_at`, and `last_active_at`.

#### Scenario: Channel record creation
- **WHEN** a delivery arrives from a chat whose `chat_id` does not exist in `channels`
- **THEN** the system creates a new channel record with status 'pending' and sets `last_active_at` to the current timestamp

#### Scenario: Existing channel activity update
- **WHEN** a delivery arrives from a chat whose `chat_id` exists in `channels`
- **THEN** the system updates `last_active_at` for that channel to the current timestamp

### Requirement: Initial channel seeding
The system SHALL seed channels defined in `FAMILY_CHAT_IDS` or `FAMILY_CHAT_ID` configuration into the `channels` table with `status = 'active'` upon application startup if they are not already recorded.

#### Scenario: Startup seeding
- **WHEN** the application starts up with `FAMILY_CHAT_IDS="group-1,group-2"`
- **THEN** both channels are inserted with `status = 'active'` if they do not yet exist in the database

### Requirement: Channel status gating
The system SHALL gate message processing based on the channel's `status`:
- `active`: Messages are processed by the conversational bot pipeline.
- `pending`: If addressed via mention, reply, or private message, the bot replies with an approval notice; other messages are ignored.
- `disabled`: All messages in the channel are silently ignored.

#### Scenario: Message in active channel
- **WHEN** a member mentions the bot in an `active` group channel
- **THEN** the bot processes the message and responds with an LLM reply

#### Scenario: Message in pending channel
- **WHEN** a member mentions the bot in a `pending` group channel
- **THEN** the bot replies with a notification that the channel is awaiting administrator approval

#### Scenario: Message in disabled channel
- **WHEN** a member mentions the bot in a `disabled` group channel
- **THEN** no reply is sent and the message is ignored
