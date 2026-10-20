## ADDED Requirements

### Requirement: Zipline storage settings configuration and test API
The system SHALL support managing and verifying Zipline image storage settings via admin REST endpoints (`GET /api/admin/settings`, `PATCH /api/admin/settings`, `POST /api/admin/settings/test-zipline`), persisting values in the `system_settings` table under keys `zipline_url` and `zipline_token`.

#### Scenario: Retrieving masked Zipline settings
- **WHEN** authenticated admin requests `GET /api/admin/settings`
- **THEN** response includes `ziplineUrl`, `hasZiplineToken` (boolean), `ziplineTokenMasked` (masked string or null), and `ziplineTokenSource` (`db`, `env`, or `none`)

#### Scenario: Updating Zipline settings in database
- **WHEN** authenticated admin sends `PATCH /api/admin/settings` with `ziplineUrl` and optional `ziplineToken`
- **THEN** system persists the values in `system_settings` with keys `zipline_url` and `zipline_token` and updates effective settings immediately

#### Scenario: Testing Zipline connectivity
- **WHEN** authenticated admin sends `POST /api/admin/settings/test-zipline` with optional candidate URL and token
- **THEN** system performs a test upload/ping against the specified or configured Zipline endpoint and returns `{ success: true, message: "..." }` or `{ success: false, error: "..." }`

### Requirement: Zipline configuration UI in admin settings page
The Admin Web SPA Settings page SHALL display a Zipline image storage configuration card with an endpoint URL input, token input with toggleable visibility, token source indicator badge, and a "Test Connection" button.

#### Scenario: Admin views Zipline settings
- **WHEN** admin navigates to the Settings page in the Admin SPA
- **THEN** a Zipline card displays current URL, masked token status, source badge, input fields, and a test action button

#### Scenario: Admin tests Zipline connection from settings page
- **WHEN** admin clicks "Test Connection" in the Zipline section
- **THEN** the UI triggers `POST /api/admin/settings/test-zipline` and displays a toast notification with the result

#### Scenario: Admin updates Zipline configuration
- **WHEN** admin updates Zipline URL or token and clicks "Save Settings"
- **THEN** the UI persists the updates and displays a success toast notification
