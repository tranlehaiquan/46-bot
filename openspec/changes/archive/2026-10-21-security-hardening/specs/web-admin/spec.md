## MODIFIED Requirements

### Requirement: Admin authentication
The system SHALL secure all `/api/admin/*` endpoints using token-based authentication verified with `ADMIN_PASSWORD`. Requests to `POST /api/admin/login` with a matching password SHALL return a signed, time-limited HMAC authentication token. Protected endpoints SHALL reject requests lacking a valid, unexpired HMAC token with HTTP 401 Unauthorized, and SHALL NOT accept the raw `ADMIN_PASSWORD` directly as a Bearer token. Furthermore, `POST /api/admin/login` SHALL enforce rate limiting to restrict brute-force attempts, returning HTTP 429 Too Many Requests when limits are exceeded.

#### Scenario: Successful login
- **WHEN** client posts the correct `ADMIN_PASSWORD` to `/api/admin/login` within rate limits
- **THEN** system responds with HTTP 200 and a signed HMAC authentication token with expiration

#### Scenario: Failed login
- **WHEN** client posts an incorrect password to `/api/admin/login`
- **THEN** system responds with HTTP 401 Unauthorized

#### Scenario: Accessing protected endpoint without authentication
- **WHEN** client requests `GET /api/admin/channels` without credentials or with an expired/tampered token
- **THEN** system responds with HTTP 401 Unauthorized

#### Scenario: Raw password rejected as Bearer token
- **WHEN** client requests a protected endpoint supplying the raw `ADMIN_PASSWORD` in `Authorization: Bearer <password>` without logging in
- **THEN** system responds with HTTP 401 Unauthorized

#### Scenario: Rate limit exceeded on login
- **WHEN** client exceeds the allowed login attempt threshold within the rate limit window
- **THEN** system responds with HTTP 429 Too Many Requests and a `Retry-After` indication

## ADDED Requirements

### Requirement: HTTP security headers
The system SHALL attach secure HTTP response headers across all admin API endpoints and static admin dashboard assets using Helmet standards (including `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` or frame-ancestors directive, Strict-Transport-Security in production, and standard Referrer-Policy).

#### Scenario: Inspecting response headers on admin routes
- **WHEN** a client or browser makes a request to any `/api/admin/*` or `/admin/*` route
- **THEN** the response includes standard security headers such as `X-Content-Type-Options: nosniff` and prevents embedding in unauthorized external iframes
