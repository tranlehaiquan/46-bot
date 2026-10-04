# zalo-webhook Specification

## Purpose

Accept Zalo webhook deliveries, acknowledge them before doing any work, and register the public URL without replacing a registration that already matches.

## Requirements

### Requirement: Process exposes only health and webhook
The process SHALL expose exactly two HTTP routes: `GET /health` and `POST /webhooks/zalo`. Every other path SHALL respond with 404.

#### Scenario: Health check succeeds
- **WHEN** the process is running and a client requests `GET /health`
- **THEN** the response status is 200

#### Scenario: Unknown path is rejected
- **WHEN** a client requests any path other than `GET /health` or `POST /webhooks/zalo`
- **THEN** the response status is 404

### Requirement: Startup fails fast on invalid configuration
The process SHALL validate configuration before it listens for HTTP. Required values are the bot token, the public webhook URL, a webhook secret of 8 to 256 characters, and webhook mode. An empty `FAMILY_CHAT_ID` SHALL be valid configuration. When validation fails, the process SHALL exit non-zero and the error SHALL name each invalid variable. The process SHALL NOT include the bot token or the webhook secret in that error.

#### Scenario: Missing webhook URL
- **WHEN** the process starts without a webhook URL
- **THEN** it exits non-zero, names the webhook URL as invalid, and does not listen for HTTP

#### Scenario: Polling mode is refused
- **WHEN** the process starts with mode set to polling
- **THEN** it exits non-zero before calling `deleteWebhook` or opening a poll loop

### Requirement: Webhook secret is required
The process SHALL compare `X-Bot-Api-Secret-Token` with the configured webhook secret using a constant-time comparison. A missing or non-matching header SHALL produce HTTP 401 and SHALL NOT be parsed, logged as a delivery, or answered in Zalo.

#### Scenario: Wrong secret
- **WHEN** `POST /webhooks/zalo` arrives with a secret header that does not match
- **THEN** the response status is 401 and no Zalo message is sent

#### Scenario: Missing secret
- **WHEN** `POST /webhooks/zalo` arrives without `X-Bot-Api-Secret-Token`
- **THEN** the response status is 401 and no Zalo message is sent

### Requirement: Matching secret is acknowledged immediately
When the secret matches, the process SHALL respond HTTP 200 with a JSON body before it parses the payload or contacts Zalo. This includes an empty body, a non-JSON body, a body whose `Content-Type` is not `application/json`, and a JSON body with no message id. A body larger than the configured limit SHALL be rejected and SHALL NOT be acknowledged with 200.

#### Scenario: Verification probe has no message
- **WHEN** a request has the correct secret and a JSON body with no message id
- **THEN** the response status is 200 and no Zalo message is sent

#### Scenario: Non-JSON body is still acknowledged
- **WHEN** a request has the correct secret and a body that is not JSON
- **THEN** the response status is 200 and no Zalo message is sent

#### Scenario: Oversized body is rejected
- **WHEN** a request body exceeds the configured size limit
- **THEN** the response status is not 200 and no Zalo message is sent

### Requirement: Raw delivery is logged without secrets
After the 200 response, the process SHALL log each JSON delivery, including fields the client library does not map onto its typed message. While `FAMILY_CHAT_ID` is empty, the log SHALL include the raw body. After `FAMILY_CHAT_ID` is set, the log SHALL include the event name, `chat.id`, `chat_type`, sender id, and message id, and SHALL omit message text. Logs SHALL NOT contain the bot token or the webhook secret, including inside request URLs.

#### Scenario: Discovery log keeps the raw body
- **WHEN** a JSON delivery arrives while `FAMILY_CHAT_ID` is empty
- **THEN** the log includes the raw body and omits the bot token and the webhook secret

#### Scenario: Configured log omits message text
- **WHEN** a JSON delivery arrives after `FAMILY_CHAT_ID` is set
- **THEN** the log includes `chat.id`, `chat_type`, and message id, and omits the message text

### Requirement: Webhook registration happens after listen
In webhook mode the process SHALL accept HTTP connections before it calls `getWebhookInfo`, `setWebhook`, or `testWebhook`. When the registered URL differs from the configured webhook URL, the process SHALL call `setWebhook` and log the verification outcome. When the registered URL already matches, the process SHALL call `testWebhook`, log that outcome, and SHALL NOT call `setWebhook`. Logged outcomes SHALL NOT include the webhook secret.

#### Scenario: URL change registers the webhook
- **WHEN** the process is listening and the registered URL differs from the configured webhook URL
- **THEN** it calls `setWebhook` and logs the verification outcome without the secret

#### Scenario: Matching URL is probed, not rewritten
- **WHEN** the process is listening and the registered URL equals the configured webhook URL
- **THEN** it calls `testWebhook` and does not call `setWebhook`
