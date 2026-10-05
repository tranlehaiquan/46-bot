## MODIFIED Requirements

### Requirement: Event Management Tools for LLM
The system SHALL expose tools to the LLM: `event_add`, `event_list_upcoming`, `event_update`, `event_delete`, and `event_send_image`, bound to the chat session where the request originates.

#### Scenario: Adding a reminder or birthday via tool
- **WHEN** the user asks to remember a birthday or add a reminder
- **THEN** the LLM invokes `event_add` with title, calendar, date, and recurrence parameters, and receives confirmation with the event ID

#### Scenario: Querying upcoming events
- **WHEN** the user asks what events or anniversaries are coming up
- **THEN** the LLM invokes `event_list_upcoming` and presents the chronologically sorted events with their dates and remaining days

#### Scenario: Requesting an event summary image for a week, month, or year
- **WHEN** the user asks to see or send an image overview of events for a week, month, or year
- **THEN** the LLM invokes `event_send_image` specifying `scope` ('week', 'month', or 'year') along with optional `month`, `year`, or reference `date`

## ADDED Requirements

### Requirement: Timeframe-Scoped Event Query
The system SHALL provide a query `getEventsForRange(chatId, startDate, endDate)` in the events repository to calculate and return all events occurring within the requested date window, resolving recurring events (yearly, monthly, weekly, daily) and converting lunar dates to their corresponding solar dates in UTC+7. Helper methods for standard scopes (`getEventsForWeek`, `getEventsForMonth`, and `getEventsForYear`) SHALL be provided.

#### Scenario: Querying events in a specific week
- **WHEN** events for a target 7-day week are queried for a chat
- **THEN** all occurrences falling within Monday 00:00 to Sunday 23:59:59 are returned sorted chronologically

#### Scenario: Querying events in a month with solar and lunar recurrences
- **WHEN** events for a month (e.g. October 2026) are queried for a chat
- **THEN** all one-off events, yearly solar birthdays, and yearly lunar giỗ dates falling within that month are returned sorted chronologically by day

#### Scenario: Querying events for an entire year
- **WHEN** events for a year (e.g. 2026) are queried for a chat
- **THEN** all solar and lunar occurrences across the 12 months are returned sorted chronologically
