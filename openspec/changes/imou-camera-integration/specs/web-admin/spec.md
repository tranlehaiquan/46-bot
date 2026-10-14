## ADDED Requirements

### Requirement: Imou camera settings management
The system SHALL support configuring and persisting Imou Camera parameters via `GET /api/admin/settings` and `PUT /api/admin/settings`. The settings SHALL include `imouAppId`, `imouAppSecret`, `imouBaseUrl`, and `imouCameras` (a JSON string or structured list defining camera ID, name, deviceId, and channelId). When saved, the system SHALL persist them in `system_settings` and update effective configuration immediately without server restart.

#### Scenario: Admin updates Imou camera credentials
- **WHEN** authenticated admin sends `PUT /api/admin/settings` with `imouAppId` and `imouAppSecret`
- **THEN** system saves the values to `system_settings` and returns HTTP 200

#### Scenario: Admin retrieves masked settings
- **WHEN** authenticated admin requests `GET /api/admin/settings`
- **THEN** system returns settings with `imouAppSecret` masked as `***` if set and source indicator `database` or `environment`

### Requirement: Imou camera connectivity testing endpoint
The system SHALL provide an endpoint `POST /api/admin/settings/test-imou` allowing the administrator to test Imou credentials and optionally capture a test frame from a configured camera. The test SHALL verify API connectivity and sign validation by requesting an access token from the Imou Open Platform API.

#### Scenario: Successful test connection
- **WHEN** authenticated admin sends `POST /api/admin/settings/test-imou` with valid credentials
- **THEN** system connects to Imou OpenAPI, acquires an access token, and responds with `{ success: true, message: "Kết nối thành công tới Imou Cloud Open API" }`

#### Scenario: Failed test connection
- **WHEN** authenticated admin sends `POST /api/admin/settings/test-imou` with invalid credentials
- **THEN** system responds with `{ success: false, error: "..." }` explaining the failure reason

### Requirement: Imou camera configuration UI in admin settings page
The Admin Web SPA Settings page SHALL display an Imou Camera configuration card containing fields for App ID, App Secret (with toggleable password mask), API Gateway selector (Singapore `openapi-sg.easy4ip.com`, Global `openapi.easy4ip.com`, Frankfurt `openapi-fk.easy4ip.com`, Oregon `openapi-or.easy4ip.com`), and camera list management, along with a "Kiểm tra kết nối" (Test Connection) action button.

#### Scenario: Admin views Imou camera settings
- **WHEN** admin navigates to Settings page in Admin SPA
- **THEN** the Imou Camera card displays masked secrets, current gateway, camera configurations, and test action button

#### Scenario: Admin triggers Imou test connection from UI
- **WHEN** admin clicks "Kiểm tra kết nối" in the Imou Camera section
- **THEN** the UI calls `POST /api/admin/settings/test-imou` and displays a sonner toast with the connection outcome
