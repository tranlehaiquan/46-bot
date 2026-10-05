# Spec Delta

## ADDED Requirements

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
