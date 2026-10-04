# events-reminders Specification

## Purpose
TBD - created by archiving change events-and-reminders. Update Purpose after archive.
## Requirements
### Requirement: Unified Event Storage
The system SHALL persist events in an `events` table in SQLite with fields for `chat_id`, `title`, `kind`, `calendar` ('solar' | 'lunar'), `day`, `month`, `year` (nullable), `is_leap_month`, `recurrence` ('none' | 'yearly' | 'monthly' | 'weekly' | 'daily'), `remind_days_before`, `notes`, `created_by`, and timestamp `ts`. The system SHALL also create a `reminders_sent` table for delivery tracking.

#### Scenario: Creating an event in the database
- **WHEN** an event is added for a specific chat
- **THEN** it is saved with all specified calendar, recurrence, and reminder attributes, and assigned an autoincrement ID

### Requirement: Vietnamese Lunar Calendar Calculation
The system SHALL provide a deterministic Vietnamese lunar calendar module (UTC+7 timezone) capable of converting between solar dates and lunar dates, supporting leap months (tháng nhuận) and leap years without relying on external network calls or LLM guesses.

#### Scenario: Solar to lunar conversion
- **WHEN** a solar date corresponding to Lunar New Year (Tết Nguyên Đán) is converted
- **THEN** the returned lunar date is day 1, month 1 of that lunar year

#### Scenario: Lunar to solar conversion
- **WHEN** a lunar date (day, month, year, leap month flag) is converted to solar
- **THEN** the exact corresponding Gregorian calendar date in UTC+7 is returned

### Requirement: Next Occurrence Calculation
The system SHALL calculate the next upcoming solar occurrence for both solar and lunar events based on their recurrence rules relative to a reference date.

#### Scenario: Yearly solar birthday
- **WHEN** a yearly solar birthday is evaluated and this year's date has passed
- **THEN** the next occurrence is resolved to next year's date with correct remaining days

#### Scenario: Yearly lunar giỗ (death anniversary)
- **WHEN** a yearly lunar giỗ is evaluated
- **THEN** the system converts the lunar date to the current solar year (or next solar year if already passed) and calculates the remaining days

### Requirement: Event Management Tools for LLM
The system SHALL expose four tools to the LLM: `event_add`, `event_list_upcoming`, `event_update`, and `event_delete`, bound to the chat session where the request originates.

#### Scenario: Adding a reminder or birthday via tool
- **WHEN** the user asks to remember a birthday or add a reminder
- **THEN** the LLM invokes `event_add` with title, calendar, date, and recurrence parameters, and receives confirmation with the event ID

#### Scenario: Querying upcoming events
- **WHEN** the user asks what events or anniversaries are coming up
- **THEN** the LLM invokes `event_list_upcoming` and presents the chronologically sorted events with their dates and remaining days

