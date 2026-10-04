# group-discovery Specification

## Purpose

Learn the family group id from a live Zalo mention, then prove the bot can speak in that group with one fixed sentence and no model.

## Requirements

### Requirement: Unset family chat stays silent
While `FAMILY_CHAT_ID` is empty, the process SHALL log `chat.id`, `chat_type`, sender id, and sender display name for every delivery that has a message id, and SHALL NOT send a Zalo message.

#### Scenario: Group mention during discovery
- **WHEN** `FAMILY_CHAT_ID` is empty and a group text message arrives
- **THEN** the log includes that message's `chat.id` and `chat_type` of `GROUP`, and no Zalo message is sent

#### Scenario: Private message during discovery
- **WHEN** `FAMILY_CHAT_ID` is empty and a private text message arrives
- **THEN** the log includes `chat_type` of `PRIVATE`, and no Zalo message is sent

### Requirement: Matching group text gets the canned reply
When `FAMILY_CHAT_ID` is set, the process SHALL send the exact text `Mình nhận được.` for an incoming text message whose `chat_type` is `GROUP`, whose `chat.id` equals `FAMILY_CHAT_ID`, and whose sender is not a bot. The outbound message SHALL contain no other text. The process SHALL send it to `chat.id` and SHALL NOT send it to the sender's user id.

#### Scenario: Family group mention
- **WHEN** `FAMILY_CHAT_ID` is set and a person sends a text message in that group
- **THEN** the group receives one message whose text is exactly `Mình nhận được.`

#### Scenario: Bot's own message is ignored
- **WHEN** a delivery in the family group has a sender marked as a bot
- **THEN** no Zalo message is sent

### Requirement: Every other chat stays silent
When `FAMILY_CHAT_ID` is set, the process SHALL NOT send a message for a delivery whose `chat.id` differs from `FAMILY_CHAT_ID` or whose `chat_type` is not `GROUP`.

#### Scenario: Different chat id
- **WHEN** `FAMILY_CHAT_ID` is set and a text message arrives for a different `chat.id`
- **THEN** no Zalo message is sent

#### Scenario: Private chat with the same id string
- **WHEN** `FAMILY_CHAT_ID` is set and a text message has that id with `chat_type` of `PRIVATE`
- **THEN** no Zalo message is sent

### Requirement: Non-text events are not answered
The canned reply SHALL be sent only for a text message. Image, sticker, voice, and unsupported events in the family group SHALL be logged and SHALL NOT be answered.

#### Scenario: Image in the family group
- **WHEN** `FAMILY_CHAT_ID` is set and the family group delivers an image event
- **THEN** no Zalo message is sent

### Requirement: One reply per message id while the process stays up
For the lifetime of one process, the process SHALL send the canned reply at most once for a given message id. A repeated delivery of that message id SHALL NOT produce a second send. This slice SHALL NOT persist that record across restarts.

#### Scenario: Duplicate delivery in one process
- **WHEN** the same message id is delivered twice without a restart
- **THEN** the canned reply is sent once

#### Scenario: Restart treats a redelivery as new
- **WHEN** the process restarts and Zalo delivers a message id that the previous process already answered
- **THEN** the canned reply is sent again
