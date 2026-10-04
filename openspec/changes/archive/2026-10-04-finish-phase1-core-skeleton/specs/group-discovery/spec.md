# group-discovery Specification

## MODIFIED Requirements

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

### Requirement: Private text triggers conversational reply
The process SHALL accept incoming text messages in private chats (direct messages) whose sender is not a bot, and respond with an LLM-generated reply. Non-text events (images, stickers, voice) in private chats SHALL NOT be answered.

#### Scenario: Direct text message
- **WHEN** a person sends a text message in a private chat
- **THEN** that chat receives an LLM-generated conversational reply

#### Scenario: Direct image
- **WHEN** a private chat delivers an image event
- **THEN** no Zalo message is sent
