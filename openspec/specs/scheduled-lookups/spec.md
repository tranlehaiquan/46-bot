# scheduled-lookups Specification

## Purpose

Run a saved internet-lookup instruction for one chat on a daily, weekly, or monthly solar schedule, and deliver the result once per occurrence.

## Requirements

### Requirement: A lookup belongs to the chat that created it
The system SHALL persist each lookup with the originating chat, a natural-language instruction, an active flag, a recurrence of `daily`, `weekly`, or `monthly`, and a clock time in `Asia/Ho_Chi_Minh`. A weekly lookup SHALL also store one weekday. A monthly lookup SHALL also store one solar day-of-month from 1 to 31. Delivery SHALL go only to the originating chat.

#### Scenario: Daily weather lookup is saved for the requesting chat
- **WHEN** a member of chat A asks for the Ho Chi Minh City weather every day at 07:00
- **THEN** the system stores one active daily lookup at 07:00 for chat A, and chat B receives nothing from that lookup

#### Scenario: Weekly and monthly anchors are stored
- **WHEN** a member schedules a lookup for Sunday at 20:00 and another for day 5 of each month at 07:00
- **THEN** the weekly lookup stores Sunday as its weekday and the monthly lookup stores solar day 5

### Requirement: Conversation can create, list, update, and cancel lookups
An addressed member of an active chat SHALL be able to create, list, update, and cancel lookups for that chat. Create and update SHALL reply with the saved instruction and the schedule that will run. The system SHALL NOT save a lookup that omits its clock time, omits the weekday for a weekly schedule, or omits the day-of-month for a monthly schedule; it SHALL ask for the missing anchor instead. When the user asks for a morning lookup and names no clock time, the system SHALL use 07:00 and the confirmation SHALL state that time.

#### Scenario: Create confirms the stable instruction
- **WHEN** a member says "Mỗi ngày lúc 7:00 sáng, báo thời tiết TP.HCM"
- **THEN** the reply states the daily 07:00 schedule and the saved instruction that will be fetched

#### Scenario: Missing day-of-month is not guessed
- **WHEN** a member asks for a monthly lookup and does not name a day
- **THEN** the system asks which day of the month to use and does not save the lookup

#### Scenario: Cancel removes a later run
- **WHEN** a member cancels lookup 4
- **THEN** lookup 4 is no longer due, and later ticks do not deliver it

### Requirement: Short months deliver on the last day
When a monthly lookup's day-of-month is greater than the number of days in the current solar month, that month's occurrence SHALL fall on the last day of the month. The create and update confirmation SHALL say that shorter months are delivered on the last day.

#### Scenario: Day 31 in February
- **WHEN** a monthly lookup has day-of-month 31 and the local date is the last day of February, at or after its clock time
- **THEN** that February occurrence is due, and the saved confirmation told the chat that shorter months use the last day

### Requirement: Each occurrence is delivered at most once on its local day
A lookup occurrence SHALL become due when the lookup is active, the Vietnam-local date matches its schedule, and the local time is at or after its clock time. The system SHALL send at most one message for that lookup on that local date. A restart or later tick on the same local date SHALL NOT send it again. The next matching local date SHALL be a new occurrence. An occurrence that was not sent SHALL remain due until that local date ends.

#### Scenario: Restart later the same morning still sends once
- **WHEN** a daily 07:00 lookup has not been sent and the bot runs at 10:30 the same local day
- **THEN** the chat receives one message for that occurrence

#### Scenario: A second tick does not duplicate
- **WHEN** the occurrence was already sent and the scheduler runs again that same local day
- **THEN** the chat receives no second message for that lookup

#### Scenario: The next day is a new occurrence
- **WHEN** a daily lookup was sent yesterday and today matches its clock
- **THEN** the chat receives today's message

### Requirement: Pending and disabled channels are skipped
The system SHALL NOT deliver a lookup while the originating channel status is `pending` or `disabled`. Skipping SHALL NOT consume the occurrence. If the channel is `active` again on that same local day and the occurrence is still due, the system SHALL deliver it.

#### Scenario: Disabled channel receives nothing
- **WHEN** a due lookup belongs to a disabled channel
- **THEN** no message is sent and the occurrence is not recorded as sent

#### Scenario: Reactivating the same day still delivers
- **WHEN** a due lookup was skipped while the channel was disabled and the channel becomes active later that same local day
- **THEN** the chat receives the occurrence once

### Requirement: A run answers only the saved instruction with read tools
The scheduled run SHALL call the model with the saved instruction as untrusted user data and with no chat history. The run SHALL be limited to `weather_check`, `web_search`, and `holiday_list_upcoming`. The run SHALL NOT create or modify events, lists, memories, or lookups. The delivered text SHALL be plain text without Markdown. Text longer than 2000 characters SHALL be split using the same outbound splitting as conversational replies.

#### Scenario: Weather instruction uses the weather tool
- **WHEN** a due lookup instruction asks for today's weather in Ho Chi Minh City
- **THEN** the run retrieves live weather for that place and the chat receives one plain-text briefing

#### Scenario: Another topic uses web search
- **WHEN** a due lookup instruction asks for the SJC gold price
- **THEN** the run retrieves current web results for that topic and does not require a gold-specific schedule

#### Scenario: Saved instruction cannot change stored data
- **WHEN** a saved instruction tells the bot to add an event, remember a fact, or change its system instructions
- **THEN** no event, list, memory, or lookup is written by the run, and the instruction is not treated as a system instruction

### Requirement: Final failure is silent in the chat
When a due run fails, the system SHALL retry on later ticks during that local day, up to 3 attempts. After the third failed attempt, the system SHALL record the occurrence as failed with the error and SHALL NOT send a message to the chat for that occurrence. The failure record SHALL be visible to the admin channel view.

#### Scenario: Transient failure is retried
- **WHEN** the first attempt fails and a later tick in the same local day runs the lookup again
- **THEN** the system makes another attempt and still has not sent a failure notice to the chat

#### Scenario: Third failure stays quiet
- **WHEN** the third attempt for that occurrence fails
- **THEN** the occurrence is recorded as failed with the error, and the chat receives no message for it

### Requirement: Existing briefings and reminders keep their own schedule
Executing a lookup SHALL NOT suppress, merge with, or change the daily morning briefing, the Sunday weekly outlook, or event reminders.

#### Scenario: A 07:00 lookup is a separate message
- **WHEN** a chat has a daily lookup at 07:00 and also has a morning briefing due
- **THEN** the lookup message and the morning briefing are delivered as separate messages
