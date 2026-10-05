# group-discovery Specification

## Purpose

Learn the family group id from a live Zalo delivery, support multiple allowed family chat IDs (`FAMILY_CHAT_IDS`), and ensure the bot only participates in group conversations when explicitly addressed by mention or reply.

## Requirements

### Requirement: Unset family chat allows every group
When a delivery arrives from a chat not previously registered in the system, the process SHALL record the channel in the database with status `pending`, capturing `chat.id`, `chat_type`, sender id, and sender display name. If an incoming group text message addresses the bot (via @mention or direct reply) while the channel is `pending`, the process SHALL reply with an onboarding message indicating that the channel is awaiting admin activation: `Kênh/nhóm này đang chờ quản trị viên phê duyệt trên Dashboard (chat ID "<chat_id>").` displaying that group's actual `chat.id`. If a group message does not address the bot, the process SHALL remain silent.

#### Scenario: Group mention when channel is pending
- **WHEN** a member mentions the bot in a group whose status is `pending`
- **THEN** the bot replies with `Kênh/nhóm này đang chờ quản trị viên phê duyệt trên Dashboard (chat ID "<chat_id>").`

#### Scenario: Group message without mention when channel is pending
- **WHEN** members chat in a pending group without mentioning or replying to the bot
- **THEN** the delivery updates channel activity and no Zalo message is sent

#### Scenario: Private message is logged during discovery
- **WHEN** a person sends a private text message from an unregistered chat
- **THEN** the channel is recorded with `chat_type` of `PRIVATE` and status `pending`

### Requirement: Matching group text requires mention or reply
When `FAMILY_CHAT_IDS` is configured with one or more chat IDs, the process SHALL process incoming text messages in any listed family group ONLY when the bot is @mentioned or when the message is a direct reply to one of the bot's messages. Messages that do not mention the bot or reply to the bot SHALL be ignored silently. When triggered, the process SHALL generate and send a conversational LLM reply.

#### Scenario: Allowed family group message with mention
- **WHEN** `FAMILY_CHAT_IDS` contains "group-1" and a member mentions the bot in "group-1"
- **THEN** the bot processes the message and responds with an LLM-generated answer

#### Scenario: Allowed family group message without mention or reply
- **WHEN** `FAMILY_CHAT_IDS` contains "group-1" and members chat without mentioning or replying to the bot
- **THEN** no Zalo message is sent and the message is ignored

#### Scenario: Allowed family group reply to bot
- **WHEN** a member in an allowed family chat replies directly to a previous message sent by the bot
- **THEN** the bot processes the message and responds with an LLM-generated answer

#### Scenario: Bot's own message is ignored
- **WHEN** a delivery in the family group has a sender marked as a bot
- **THEN** no Zalo message is sent

### Requirement: Private text triggers conversational reply
The process SHALL accept incoming text messages in private chats (direct messages) whose sender is not a bot, and respond with an LLM-generated reply. Non-text events (images, stickers, voice) in private chats SHALL NOT be answered.

#### Scenario: Direct text message
- **WHEN** a person sends a text message in a private chat
- **THEN** that chat receives an LLM-generated conversational reply

#### Scenario: Direct image
- **WHEN** a private chat delivers an image event
- **THEN** no Zalo message is sent

### Requirement: Every other group stays silent
When a channel has status `disabled`, the process SHALL stay silent and send no message regardless of whether the bot is @mentioned, replied to, or sent direct messages.

#### Scenario: Disabled group mentions bot
- **WHEN** a member mentions the bot in a `disabled` group
- **THEN** no Zalo message is sent and the event is ignored

#### Scenario: Disabled group chat without mention
- **WHEN** members chat in a `disabled` group without mentioning the bot
- **THEN** no Zalo message is sent

### Requirement: Non-text events are not answered
The process SHALL respond only to text messages. Image, sticker, voice, and unsupported events in the family group SHALL be logged and SHALL NOT be answered.

#### Scenario: Image in the family group
- **WHEN** `FAMILY_CHAT_IDS` is set and the family group delivers an image event
- **THEN** no Zalo message is sent
