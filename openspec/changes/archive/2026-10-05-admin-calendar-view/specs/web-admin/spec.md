## ADDED Requirements

### Requirement: Global Calendar navigation
The web admin SPA SHALL include a top-level "Calendar" navigation tab in the Navbar that navigates to the Global Calendar page without a full page reload.

#### Scenario: Admin navigates to Global Calendar
- **WHEN** the admin clicks the "Calendar" tab in the Navbar
- **THEN** the SPA SHALL transition to the Global Calendar page, replacing the Channels view

#### Scenario: Admin navigates back to Channels
- **WHEN** the admin clicks the "Channels" tab in the Navbar
- **THEN** the SPA SHALL return to the channel list and detail view

### Requirement: Global Calendar REST endpoints
The system SHALL expose two new authenticated REST endpoints for calendar data.

#### Scenario: Holidays endpoint returns computed occurrences
- **WHEN** an authenticated admin requests `GET /api/admin/holidays?year=2026`
- **THEN** the system SHALL return a JSON array of Vietnam holiday objects with `id`, `name`, `isPublicHoliday`, `originalDate`, `occurrenceDateStr`, `daysOfLeave`, and `description` fields

#### Scenario: Calendar events endpoint returns occurrence-resolved events
- **WHEN** an authenticated admin requests `GET /api/admin/calendar/events?year=2026&month=10`
- **THEN** the system SHALL return a JSON array of channel event occurrence objects each including `eventId`, `chatId`, `channelName`, `title`, `kind`, `calendar`, and `occurrenceDateStr`

#### Scenario: Calendar events endpoint filtered by channel
- **WHEN** an authenticated admin requests `GET /api/admin/calendar/events?year=2026&month=10&chatId=abc`
- **THEN** the system SHALL return only events belonging to that chatId

### Requirement: Channel Reminders tab embeds calendar grid
The channel reminders and events tab in Channel Detail SHALL display a calendar month grid above the existing event list, showing Vietnam holidays and the channel's own events merged together.

#### Scenario: Channel calendar renders on tab open
- **WHEN** the admin opens a channel's "Reminders & Events" tab
- **THEN** a calendar month grid for the current month SHALL be displayed above the existing flat event list

#### Scenario: Channel calendar and event list coexist
- **WHEN** the channel reminders tab is active
- **THEN** both the calendar grid and the scrollable event list SHALL be visible in the same tab without hiding either

## MODIFIED Requirements

### Requirement: Channel message management
The system SHALL allow reading recent messages for a channel via `GET /api/admin/channels/:chatId/messages`. The admin web UI SHALL display channel messages in read-only mode; sending messages from the admin UI is not supported.

#### Scenario: View messages
- **WHEN** authenticated admin requests `GET /api/admin/channels/group-1/messages`
- **THEN** system returns recent user and assistant messages for that channel

#### Scenario: Messages tab is read-only
- **WHEN** the admin opens the Messages tab for any channel
- **THEN** the UI SHALL display the conversation history with no input field or send button
