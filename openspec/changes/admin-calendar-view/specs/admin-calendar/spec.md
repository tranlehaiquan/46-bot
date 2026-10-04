## ADDED Requirements

### Requirement: Global Calendar page
The system SHALL provide a dedicated Global Calendar admin page accessible via a top-level navigation tab that displays Vietnam national and traditional holidays alongside events from all active channels for a selected month and year.

#### Scenario: Admin opens Global Calendar
- **WHEN** the admin clicks the "Calendar" tab in the navigation bar
- **THEN** the system SHALL display a full-month calendar grid for the current month showing all Vietnam holidays and all channel events

#### Scenario: Admin navigates months
- **WHEN** the admin clicks the previous or next month arrow
- **THEN** the grid SHALL update to show holidays and events for the newly selected month

#### Scenario: Admin filters by channel
- **WHEN** the admin selects a specific channel from the channel filter dropdown
- **THEN** only events belonging to that channel SHALL be shown (Vietnam holidays remain always visible)

#### Scenario: Admin toggles holiday display
- **WHEN** the admin unchecks the "Vietnam Holidays" toggle
- **THEN** Vietnam holiday badges SHALL be hidden from all calendar cells while channel events remain

### Requirement: Channel Calendar view
Within each channel's Reminders & Events tab, the system SHALL display a calendar month grid showing that channel's own events merged with Vietnam national and traditional holidays.

#### Scenario: Admin opens channel reminders tab
- **WHEN** the admin selects a channel and clicks the "Reminders & Events" tab
- **THEN** a calendar month grid SHALL appear above the existing event list, showing Vietnam holidays and this channel's events for the current month

#### Scenario: Channel calendar month navigation
- **WHEN** the admin clicks previous or next month in the channel calendar
- **THEN** the grid SHALL update to show that month's computed event occurrences and holidays for this channel only

### Requirement: Calendar day cell content
Each calendar day cell SHALL display the solar date number prominently and, for cells coinciding with a Vietnam holiday, SHALL display a small lunar date indicator derived from the holiday's original lunar date metadata.

#### Scenario: Solar date display
- **WHEN** the calendar renders any day cell
- **THEN** the cell SHALL show the solar day number in a large, readable font

#### Scenario: Lunar date indicator on holiday cells
- **WHEN** a calendar day coincides with a Vietnam lunar holiday
- **THEN** the cell SHALL show the holiday's original lunar date (e.g., "10/3 ÂL") in a smaller muted style beneath the solar date

### Requirement: Holiday badge differentiation
Vietnam holiday badges SHALL be visually distinct from channel event badges, and statutory public holidays (with days-off) SHALL be further distinguished from cultural/traditional observances.

#### Scenario: Public holiday badge
- **WHEN** a calendar day has a statutory Vietnamese public holiday (e.g., National Day 02/09)
- **THEN** the badge SHALL use a red/amber color scheme and display a government flag icon or "Nghỉ lễ" label

#### Scenario: Cultural observance badge
- **WHEN** a calendar day has a cultural/traditional Vietnamese holiday (e.g., Vu Lan, Trung Thu)
- **THEN** the badge SHALL use a purple/rose color scheme distinct from the public holiday style

### Requirement: Backend holidays endpoint
The system SHALL expose a `GET /api/admin/holidays?year=YYYY` endpoint (authenticated) that returns all Vietnam holiday occurrences computed for the requested year.

#### Scenario: Valid year request
- **WHEN** an authenticated admin requests `GET /api/admin/holidays?year=2026`
- **THEN** the response SHALL include an array of holiday objects each containing `id`, `name`, `calendar`, `originalDate`, `occurrenceDateStr`, `daysOfLeave`, `isPublicHoliday`, and `description`

#### Scenario: Default year fallback
- **WHEN** the `year` query parameter is omitted
- **THEN** the endpoint SHALL default to the current calendar year

### Requirement: Backend calendar events endpoint
The system SHALL expose a `GET /api/admin/calendar/events?year=YYYY&month=MM[&chatId=xyz]` endpoint (authenticated) that returns channel events with their computed occurrence dates for the specified month/year.

#### Scenario: All channels events for a month
- **WHEN** an authenticated admin requests `GET /api/admin/calendar/events?year=2026&month=10` without a chatId
- **THEN** the response SHALL return computed occurrences for all channel events whose next occurrence falls within that month, each including `eventId`, `chatId`, `channelName`, `title`, `kind`, `calendar`, and `occurrenceDateStr`

#### Scenario: Single channel events for a month
- **WHEN** an authenticated admin requests `GET /api/admin/calendar/events?year=2026&month=10&chatId=abc`
- **THEN** the response SHALL return only events belonging to that chatId
