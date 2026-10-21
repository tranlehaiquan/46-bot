# secrets-encryption Specification

## Purpose
TBD - created by archiving change security-hardening. Update Purpose after archive.
## Requirements
### Requirement: At-rest encryption for sensitive settings
The system SHALL encrypt sensitive API tokens and credentials (`gemini_api_key`, `deepseek_api_key`, `tavily_api_key`, `crawl4ai_api_token`, `zipline_token`) before persisting them in the SQLite `system_settings` table using authenticated symmetric encryption (AES-256-GCM). Non-sensitive settings (such as model names or UI preferences) MAY remain unencrypted.

#### Scenario: Storing sensitive API key
- **WHEN** an admin updates an API key via the settings API
- **THEN** the value stored in the `system_settings` table is an authenticated ciphertext payload (including initialization vector and auth tag) rather than plaintext

#### Scenario: Retrieving effective settings
- **WHEN** the backend loads settings on startup or on-demand
- **THEN** ciphertext values are decrypted using the master key to restore their effective values in memory

### Requirement: Backward compatibility and graceful migration of plaintext settings
The system SHALL detect whether a stored setting value is encrypted (e.g. via format prefix `enc:v1:...`) or legacy plaintext. When reading legacy plaintext values, the system SHALL read them successfully without failing, and SHALL encrypt them upon the next update or automatic migration cycle.

#### Scenario: Reading existing plaintext setting from database
- **WHEN** the system starts up with an existing SQLite database containing unencrypted API keys
- **THEN** the system reads and parses the keys without decryption error

#### Scenario: Database backup export protection
- **WHEN** an admin triggers a database export via `/api/admin/export/db`
- **THEN** sensitive credentials contained in the exported SQLite database remain encrypted at rest, preventing credential theft from raw database file downloads

