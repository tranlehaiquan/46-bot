## ADDED Requirements

### Requirement: Zipline image upload
The system SHALL support uploading image binary buffers (PNG, JPEG, WebP) to an external Zipline hosting instance via `POST /api/upload` using `multipart/form-data`. The upload request SHALL include the user's API token in the `authorization` header and the binary file under field `file`. On successful upload (HTTP 200), the system SHALL extract and return the public image URL from the JSON response (`files[0]`) or raw text URL.

#### Scenario: Successful image upload to Zipline
- **WHEN** an in-memory image buffer with filename and mime type is submitted to the image storage service with valid Zipline URL and token
- **THEN** the system issues a multipart POST to `<zipline_url>/api/upload` with the `authorization` header and returns the public file URL from the response

#### Scenario: Zipline upload returns non-OK status or network failure
- **WHEN** Zipline responds with an HTTP error (e.g. 401 Unauthorized, 413 Payload Too Large, 500) or connection timeout occurs
- **THEN** the image storage service throws an informative error detailing the HTTP status and failure message

#### Scenario: Attempting upload without configured credentials
- **WHEN** image upload is requested but either Zipline URL or API token is missing or empty
- **THEN** the image storage service throws an error stating that Zipline is not configured

### Requirement: Zipline connectivity test
The system SHALL provide a test utility to verify connectivity and token authorization against the configured Zipline service without storing persistent files, by making a lightweight test request or small upload to `/api/upload` (or inspecting server status).

#### Scenario: Testing connectivity with valid endpoint and token
- **WHEN** admin invokes connection test with reachable Zipline URL and valid token
- **THEN** the system returns `{ success: true, message: "..." }`

#### Scenario: Testing connectivity with invalid credentials or unreachable URL
- **WHEN** admin invokes connection test with an invalid token or unreachable URL
- **THEN** the system returns `{ success: false, error: "..." }`
