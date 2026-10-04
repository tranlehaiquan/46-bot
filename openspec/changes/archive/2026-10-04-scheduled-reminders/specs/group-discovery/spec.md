## MODIFIED Requirements

### Requirement: Unset family chat allows every group
While `FAMILY_CHAT_IDS` is empty (or unset), every group is treated as an unlisted new chat. The process SHALL log `chat.id`, `chat_type`, sender id, and sender display name for every delivery that has a message id. If an incoming group text message addresses the bot (via @mention or direct reply), the process SHALL reply with the onboarding message: `Nhóm này chưa nằm trong danh sách cho phép. Vui lòng thêm chat ID "<chat_id>" vào FAMILY_CHAT_IDS để kích hoạt bot nhé.` displaying that group's actual `chat.id`. If a group message does not address the bot, the process SHALL remain silent.

#### Scenario: Group mention when FAMILY_CHAT_IDS is empty
- **WHEN** `FAMILY_CHAT_IDS` is empty and a member mentions the bot in group "group-1"
- **THEN** the bot replies with `Nhóm này chưa nằm trong danh sách cho phép. Vui lòng thêm chat ID "group-1" vào FAMILY_CHAT_IDS để kích hoạt bot nhé.`

#### Scenario: Group message without mention when FAMILY_CHAT_IDS is empty
- **WHEN** `FAMILY_CHAT_IDS` is empty and members chat without mentioning or replying to the bot
- **THEN** the delivery is logged for discovery, and no Zalo message is sent

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

### Requirement: Every other group stays silent
When `FAMILY_CHAT_IDS` is configured and an incoming group message arrives for a new or unlisted `chat.id` not present in `FAMILY_CHAT_IDS`, the process SHALL reply with `Nhóm này chưa nằm trong danh sách cho phép. Vui lòng thêm chat ID "<chat_id>" vào FAMILY_CHAT_IDS để kích hoạt bot nhé.` substituting the group's actual `chat.id` if the bot is @mentioned or replied to, and SHALL stay silent and send no message if the bot is not addressed.

#### Scenario: Unlisted group mentions bot
- **WHEN** `FAMILY_CHAT_IDS` is set to ["group-1"] and a member mentions the bot in unlisted "group-2"
- **THEN** the bot replies to "group-2" with `Nhóm này chưa nằm trong danh sách cho phép. Vui lòng thêm chat ID "group-2" vào FAMILY_CHAT_IDS để kích hoạt bot nhé.`

#### Scenario: Unlisted group chat without mention
- **WHEN** `FAMILY_CHAT_IDS` is set to ["group-1"] and members chat in unlisted "group-2" without mentioning the bot
- **THEN** no Zalo message is sent
