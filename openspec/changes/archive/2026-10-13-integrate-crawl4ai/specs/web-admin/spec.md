## ADDED Requirements

### Requirement: Crawl4AI token settings configuration and test API
The system SHALL support managing and verifying the Crawl4AI API token via admin REST endpoints (`GET /api/admin/settings`, `PUT /api/admin/settings`, `POST /api/admin/settings/test-crawl4ai`), persisting token values in the `system_settings` table under the key `crawl4ai_api_token`.

#### Scenario: Retrieving masked Crawl4AI token
- **WHEN** authenticated admin requests `GET /api/admin/settings`
- **THEN** response includes `hasCrawl4aiApiToken` (boolean), `crawl4aiApiTokenMasked` (masked string or null), and `crawl4aiApiTokenSource` (`db`, `env`, or `none`)

#### Scenario: Updating Crawl4AI token in database
- **WHEN** authenticated admin sends `PUT /api/admin/settings` with `crawl4aiApiKey`
- **THEN** system persists the new token in `system_settings` with key `crawl4ai_api_token` and updates effective settings immediately

#### Scenario: Testing Crawl4AI token connectivity
- **WHEN** authenticated admin sends `POST /api/admin/settings/test-crawl4ai` with an optional candidate token
- **THEN** system performs a test ping or sample scrape to `https://api.crawl4ai.com` and returns `{ success: true, message: "..." }` or `{ success: false, error: "..." }`

### Requirement: Crawl4AI configuration UI in admin settings page
The Admin Web SPA Settings page SHALL display a Crawl4AI token configuration section with toggleable password visibility, token status indicator badge, and a "Test Connection" button.

#### Scenario: Admin views Crawl4AI settings
- **WHEN** admin navigates to the Settings page in the Admin SPA
- **THEN** a Crawl4AI card displays the masked token status, source badge (`Database`, `Environment`, or `Not set`), input field, and test action button

#### Scenario: Admin tests token from settings page
- **WHEN** admin clicks "Test Connection" in the Crawl4AI section
- **THEN** the UI triggers the test API and displays a success or failure notification
