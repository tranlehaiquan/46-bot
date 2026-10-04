# group-discovery Specification

## Purpose

Learn the family group id from a live Zalo delivery, and ensure the bot only participates in group conversations when explicitly addressed by mention or reply.

## Requirements

### Requirement: Unset family chat allows every group
While `FAMILY_CHAT_ID` is empty, the process SHALL log `chat.id`, `chat_type`, sender id, and sender display name for every delivery that has a message id. The process SHALL send the exact text `Mình nhận được.` for an incoming group text message whose sender is not a bot.

#### Scenario: Group mention during discovery
- **WHEN** `FAMILY_CHAT_ID` is empty and a group text message arrives
- **THEN** the log includes that message's `chat.id` and `chat_type` of `GROUP`, and that group receives one message whose text is exactly `Mình nhận được.`

#### Scenario: Private message is logged during discovery
- **WHEN** `FAMILY_CHAT_ID` is empty and a person sends a private text message
- **THEN** the log includes `chat_type` of `PRIVATE`

### Requirement: Matching group text requires mention or reply
When `FAMILY_CHAT_ID` is set, the process SHALL process incoming text messages in that group ONLY when the bot is @mentioned or when the message is a direct reply to one of the bot's messages. Messages that do not mention the bot or reply to the bot SHALL be ignored silently. When triggered, the process SHALL generate and send a conversational LLM reply instead of a static canned message.

#### Scenario: Family group message with mention
- **WHEN** `FAMILY_CHAT_ID` is set and a group member sends a message mentioning the bot
- **THEN** the bot processes the message and responds with an LLM-generated answer

#### Scenario: Family group message without mention or reply
- **WHEN** `FAMILY_CHAT_ID` is set and a group member chats without mentioning or replying to the bot
- **THEN** no Zalo message is sent and the message is ignored

#### Scenario: Family group reply to bot
- **WHEN** a group member replies directly to a previous message sent by the bot
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
When `FAMILY_CHAT_ID` is set, the process SHALL NOT send a message for a group delivery whose `chat.id` differs from `FAMILY_CHAT_ID`.

#### Scenario: Different chat id
- **WHEN** `FAMILY_CHAT_ID` is set and a text message arrives for a different group `chat.id`
- **THEN** no Zalo message is sent

### Requirement: Non-text events are not answered
The process SHALL respond only to text messages. Image, sticker, voice, and unsupported events in the family group SHALL be logged and SHALL NOT be answered.

#### Scenario: Image in the family group
- **WHEN** `FAMILY_CHAT_ID` is set and the family group delivers an image event
- **THEN** no Zalo message is sent
