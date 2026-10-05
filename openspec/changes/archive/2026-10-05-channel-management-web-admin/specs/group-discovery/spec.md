# group-discovery Specification

## MODIFIED Requirements

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

### Requirement: Every other group stays silent
When a channel has status `disabled`, the process SHALL stay silent and send no message regardless of whether the bot is @mentioned, replied to, or sent direct messages.

#### Scenario: Disabled group mentions bot
- **WHEN** a member mentions the bot in a `disabled` group
- **THEN** no Zalo message is sent and the event is ignored

#### Scenario: Disabled group chat without mention
- **WHEN** members chat in a `disabled` group without mentioning the bot
- **THEN** no Zalo message is sent
