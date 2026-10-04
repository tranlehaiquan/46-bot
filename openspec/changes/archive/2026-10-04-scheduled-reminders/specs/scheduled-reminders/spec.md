## ADDED Requirements

### Requirement: Proactive messages are dispatched strictly to configured family channels
The background scheduler SHALL isolate reminders and briefings per chat channel. When an event is scheduled from a specific chat (e.g. Chat A), its reminder SHALL be delivered exclusively to that event's `chat_id` (Chat A), and SHALL NOT be sent to any other chat. For daily morning briefings and weekly outlooks, each configured channel in `FAMILY_CHAT_IDS` SHALL receive a briefing containing only events registered for that specific channel (plus shared public Vietnamese holidays). The scheduler SHALL NEVER send proactive messages to unconfigured or unrelated groups.

#### Scenario: Reminder is delivered only to the chat that scheduled it
- **WHEN** an event was created in "chat-A" and its reminder triggers
- **THEN** the reminder message is dispatched strictly to "chat-A", and "chat-B" receives nothing

#### Scenario: Channel-specific morning briefing
- **WHEN** 07:00 arrives and "chat-A" has an event today while "chat-B" has none
- **THEN** "chat-A" receives a morning briefing with its event, while "chat-B" receives no briefing for that event

### Requirement: Daily morning briefing at 07:00
The scheduler SHALL execute a daily job at 07:00 `Asia/Ho_Chi_Minh` time. For each target channel in `FAMILY_CHAT_IDS`, the job SHALL query for:
1. Events occurring today registered under that channel's `chat_id` (solar and lunar).
2. Vietnamese statutory holidays and cultural celebrations occurring today.
3. Birthdays and anniversaries registered under that channel's `chat_id` occurring within the next 7 days.
If one or more items exist, the job SHALL format a warm Vietnamese briefing and send it to that channel. If no events or holidays match for that channel, the job SHALL skip sending to prevent noise in the chat.

#### Scenario: Morning briefing with events and holidays today
- **WHEN** 07:00 arrives and there is a birthday today and a holiday today for a channel
- **THEN** the bot formats and sends a single consolidated morning message to that channel listing today's celebration and holiday

#### Scenario: Morning briefing with upcoming milestones
- **WHEN** 07:00 arrives with no events today, but an anniversary is coming up in 3 days for that channel
- **THEN** the bot sends a briefing reminding that channel of the upcoming anniversary within the next 7 days

#### Scenario: Morning briefing when nothing is scheduled
- **WHEN** 07:00 arrives and there are no events today, no holidays today, and no milestones in the next 7 days
- **THEN** no message is sent to that channel

### Requirement: Weekly outlook on Sunday evening
The scheduler SHALL execute a weekly job on Sunday at 20:00 `Asia/Ho_Chi_Minh` time. For each target channel in `FAMILY_CHAT_IDS`, the job SHALL query for all events registered under that channel and Vietnamese holidays occurring across the next 7 days (Monday through Sunday). If items are scheduled for the coming week, it SHALL format and send a weekly summary to that channel. If the coming week has no scheduled events or holidays for that channel, it SHALL skip sending.

#### Scenario: Weekly outlook has upcoming events
- **WHEN** Sunday 20:00 arrives and there are 2 family events scheduled during the upcoming week for a channel
- **THEN** a weekly summary listing both events with their dates is sent to that channel

#### Scenario: Weekly outlook has no events
- **WHEN** Sunday 20:00 arrives and no events or holidays fall in the next week
- **THEN** no message is sent to that channel

### Requirement: Advance and day-of event reminders at 08:00
The scheduler SHALL execute an event reminder check daily at 08:00 `Asia/Ho_Chi_Minh` time. For each active event in the database, the job SHALL determine if today is:
1. The day of the event occurrence (day-of reminder).
2. An advance reminder date based on the event's configured `remind_days_before` (e.g. 1, 3, or 7 days prior).
For each matching event, the job SHALL send a targeted reminder alert strictly to that event's origin `chat_id`.

#### Scenario: Day-of event reminder sent to event chat
- **WHEN** an event created in "chat-A" occurs on the current date and has not yet received a day-of reminder
- **THEN** the bot sends an alert strictly to "chat-A" stating that the event is happening today

#### Scenario: Advance event reminder sent to event chat
- **WHEN** an event created in "chat-A" has `remind_days_before` set to `[1, 3]` and today is exactly 3 days before its next occurrence
- **THEN** the bot sends an advance reminder alert strictly to "chat-A" stating the event is in 3 days

### Requirement: Idempotent reminder delivery
The scheduler SHALL record every delivered reminder in the `reminders_sent` table with the event ID, the target occurrence date, and the sent timestamp. Before sending any event reminder, the scheduler SHALL check if a record already exists for that `(event_id, fire_date)`. If a record exists, the reminder SHALL NOT be sent again.

#### Scenario: Reminder already recorded as sent
- **WHEN** a reminder for an event on date `2026-10-05` is already logged in `reminders_sent`
- **THEN** the scheduler skips sending and does not message the chat

#### Scenario: Recording sent reminder after delivery
- **WHEN** a reminder for an event on date `2026-10-05` is delivered successfully
- **THEN** a row is inserted into `reminders_sent` with `event_id` and `fire_date = "2026-10-05"`

### Requirement: Startup catch-up for missed reminders
On application startup, the scheduler SHALL check if the current time in `Asia/Ho_Chi_Minh` is within 2 hours after a scheduled run window (e.g., between 07:00 and 09:00 for the morning briefing, or between 08:00 and 10:00 for event reminders). If a scheduled reminder for today was not yet sent, the scheduler SHALL execute the catch-up run once. The scheduler SHALL NOT fire reminders older than 2 hours to avoid stale alerts.

#### Scenario: Bot restarts shortly after 08:00
- **WHEN** the bot boots at 08:15 and today's 08:00 event reminder was not recorded in `reminders_sent`
- **THEN** the scheduler catches up and sends the missing reminder to the origin chat
