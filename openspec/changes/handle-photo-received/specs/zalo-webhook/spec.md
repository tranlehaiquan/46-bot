## ADDED Requirements

### Requirement: Inbound photo message normalization and dispatch
The system SHALL normalize and accept `message.image.received` deliveries from Zalo Bot webhook events. The normalization SHALL extract `photo` (image URL), `caption`, `message_id`, `chat.id`, `chat_type`, `from.id`, `from.display_name`, and any mentions or quotes. When evaluating addressing in groups, the system SHALL check both explicit user mentions and mentions inside the caption.

#### Scenario: Private photo received
- **WHEN** a user sends a photo in a private chat (`chat_type: PRIVATE`) with event `message.image.received`
- **THEN** the system normalizes the message with `photo` and optional `caption`, marks it as addressed to the bot, and dispatches it for processing

#### Scenario: Group photo received with mention
- **WHEN** a group member sends a photo in an active group chat mentioning the bot in `mentions` or in the `caption` text
- **THEN** the system accepts the message as addressed to the bot and dispatches it for processing

#### Scenario: Group photo received without mention
- **WHEN** a group member sends a photo in a group chat without mentioning the bot or quoting a bot message
- **THEN** the system ignores the message and does not respond
