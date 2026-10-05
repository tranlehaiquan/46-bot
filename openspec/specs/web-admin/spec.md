# web-admin Specification

## Purpose
Provide a web-based dashboard and supporting REST APIs to manage bot channels, inspect messages, manage scheduled reminders/events, inspect/edit long-term memory, and view integrated calendars with Vietnamese holidays.

## Requirements

### Requirement: Admin authentication
The system SHALL secure all `/api/admin/*` endpoints using `ADMIN_PASSWORD`. Requests to `POST /api/admin/login` with a matching password SHALL return an authentication token (or set an authenticated session cookie). Unauthenticated requests to protected endpoints SHALL return HTTP 401 Unauthorized.

#### Scenario: Successful login
- **WHEN** client posts the correct `ADMIN_PASSWORD` to `/api/admin/login`
- **THEN** system responds with HTTP 200 and an authentication credential

#### Scenario: Failed login
- **WHEN** client posts an incorrect password to `/api/admin/login`
- **THEN** system responds with HTTP 401 Unauthorized

#### Scenario: Accessing protected endpoint without authentication
- **WHEN** client requests `GET /api/admin/channels` without credentials
- **THEN** system responds with HTTP 401 Unauthorized

### Requirement: Channel management API
The system SHALL provide endpoints to list channels (`GET /api/admin/channels`) with optional filtering by status, and update channel metadata or status (`PATCH /api/admin/channels/:chatId`).

#### Scenario: List channels
- **WHEN** authenticated admin requests `GET /api/admin/channels`
- **THEN** system responds with a list of all recorded channels including their status and last active timestamp

#### Scenario: Update channel status to active
- **WHEN** authenticated admin sends `PATCH /api/admin/channels/group-1` with `{ "status": "active" }`
- **THEN** system updates the channel status in the database and returns HTTP 200

### Requirement: Channel message management
The system SHALL allow reading recent messages for a channel via `GET /api/admin/channels/:chatId/messages`. The admin web UI SHALL display channel messages in read-only mode; sending messages from the admin UI is not supported.

#### Scenario: View messages
- **WHEN** authenticated admin requests `GET /api/admin/channels/group-1/messages`
- **THEN** system returns recent user and assistant messages for that channel

#### Scenario: Messages tab is read-only
- **WHEN** the admin opens the Messages tab for any channel
- **THEN** the UI SHALL display the conversation history with no input field or send button

### Requirement: Channel reminders and events management
The system SHALL allow viewing, creating, and deleting events and scheduled reminders for a specific channel.

#### Scenario: List channel events
- **WHEN** authenticated admin requests `GET /api/admin/channels/group-1/events`
- **THEN** system returns all events and reminders associated with that chat ID

#### Scenario: Create channel event
- **WHEN** authenticated admin sends `POST /api/admin/channels/group-1/events` with valid event details
- **THEN** system creates the event in the database associated with that chat ID

#### Scenario: Delete channel event
- **WHEN** authenticated admin sends `DELETE /api/admin/channels/group-1/events/12`
- **THEN** system removes the event from the database

### Requirement: Channel memory management
The system SHALL allow viewing, creating, and deleting long-term memories (facts) and memory book stories for a specific channel.

#### Scenario: List channel memories
- **WHEN** authenticated admin requests `GET /api/admin/channels/group-1/memories`
- **THEN** system returns facts and memory book stories for that chat ID

#### Scenario: Create channel fact
- **WHEN** authenticated admin sends `POST /api/admin/channels/group-1/memories/facts` with subject and fact
- **THEN** system inserts the memory into the memories table

#### Scenario: Delete channel fact
- **WHEN** authenticated admin sends `DELETE /api/admin/channels/group-1/memories/facts/5`
- **THEN** system deletes the memory record from the database

### Requirement: Single page application delivery
The system SHALL serve the compiled React SPA at `/admin` and handle client-side routing fallbacks to `index.html`.

#### Scenario: Admin route access
- **WHEN** a web browser accesses `/admin` or `/admin/channels/group-1`
- **THEN** system serves the SPA frontend HTML document

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

### Requirement: Channel lookup management
The system SHALL allow an authenticated admin to list recurring lookups for a channel, including each lookup's instruction, schedule, active flag, and last-run status. The admin SHALL be able to pause, resume, and delete a lookup for that channel. Unauthenticated requests SHALL return HTTP 401.

#### Scenario: List lookups and last-run status
- **WHEN** an authenticated admin requests `GET /api/admin/channels/group-1/lookups`
- **THEN** the system returns that channel's lookups, and a lookup whose latest occurrence failed includes status `failed`

#### Scenario: Pause a lookup
- **WHEN** an authenticated admin sends `PATCH /api/admin/channels/group-1/lookups/4` with `{ "active": false }`
- **THEN** lookup 4 is no longer due and the response confirms it is inactive

#### Scenario: Resume a lookup
- **WHEN** an authenticated admin sends `PATCH /api/admin/channels/group-1/lookups/4` with `{ "active": true }`
- **THEN** lookup 4 becomes active again

#### Scenario: Delete a lookup
- **WHEN** an authenticated admin sends `DELETE /api/admin/channels/group-1/lookups/4`
- **THEN** lookup 4 is removed and is no longer listed for that channel

#### Scenario: Channel screen exposes the same actions
- **WHEN** the admin opens a channel's lookup section
- **THEN** the screen lists the channel's lookups and offers pause, resume, and delete

