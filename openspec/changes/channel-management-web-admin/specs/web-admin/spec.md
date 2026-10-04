# web-admin Specification

## Purpose
Provide a web-based dashboard and supporting REST APIs to manage bot channels, inspect and send messages, manage scheduled reminders/events, and inspect/edit long-term memory.

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
The system SHALL allow reading recent messages for a channel via `GET /api/admin/channels/:chatId/messages` and sending messages to the channel via `POST /api/admin/channels/:chatId/messages`.

#### Scenario: View messages
- **WHEN** authenticated admin requests `GET /api/admin/channels/group-1/messages`
- **THEN** system returns recent user and assistant messages for that channel

#### Scenario: Send message as bot
- **WHEN** authenticated admin sends `POST /api/admin/channels/group-1/messages` with `{ "content": "Hello team" }`
- **THEN** the message is dispatched to Zalo via the ZaloClient and recorded in the messages table

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
