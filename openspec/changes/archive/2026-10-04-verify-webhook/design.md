# Design

## Context

The bot already exists in Zalo Bot Creator and has been invited into the family group. No server is deployed. See proposal.md for why this slice stops at a canned reply.

Zalo posts `{ ok, result: { event_name, message } }` to the webhook. Documented message fields use snake_case (`message_id`, `display_name`, `chat_type`). `chat.id` and `from.id` are strings. `date` is epoch milliseconds. The published sample is a private chat. Group mention and reply-to fields are not in the message table. `setWebhook` stores the URL even when its probe fails, and `getWebhookInfo` returns only `url` and `updated_at`.

`zalo-bot-js` parses that envelope and keeps the raw object, but its typed message drops unknown keys. The documented image field is `photo`; the SDK reads `photo_url`.

## Goals / Non-Goals

**Goals:**

- Make the first Dokploy deploy distinguish "Zalo never called us", "we could not call Zalo", and "the chat id is a private message".
- Satisfy the `zalo-webhook` and `group-discovery` specs.

**Non-Goals:**

- Choosing a persistence engine, a model provider, or a tool loop. Those belong to later changes.
- Interpreting mention markup or reply-to metadata. The raw log is the input to that later decision.

## Decisions

### Fastify with a raw-body parser

Use Fastify. The route needs the bytes before any JSON parse, because a matching secret must receive `200` before the body is interpreted. A custom content-type parser accepts `application/json` and every other type, enforces the size limit, and stores the buffer. Invalid JSON does not become a `400`.

The handler compares the secret, sends `200` with `{"message":"Success"}`, and only then enqueues parsing. Fastify is the HTTP server the later slices will keep: body limits and a single JSON logger are already there.

Alternative: Express with `express.raw()`. It can do this slice. It would be a second framework decision when request validation arrives.

### Body limit is 64 KiB

Reject larger bodies with `413` before the handler. A text delivery and the `setWebhook` probe are far smaller. `64 KiB` leaves room for undocumented group fields.

### `zalo-bot-js` is the API client, not the router

Use the SDK for `getWebhookInfo`, `setWebhook`, `testWebhook`, and `sendMessage`. Do not pass the webhook body through `processUpdate`. This slice's routing is discovery versus the canned reply, and that decision has to see the raw object the SDK's typed fields can drop.

A small normalizer reads `result.event_name`, `result.message.message_id`, `result.message.chat`, and `result.message.from`. Anything else stays in the logged raw value. A body that does not match is logged and dropped.

### Startup order

1. Validate env with zod. Exit non-zero and name the variables. Treat an empty `FAMILY_CHAT_ID` as valid. Treat `MODE=polling` as invalid.
2. Listen on `PORT` (default `3000`).
3. Call `getWebhookInfo`.
4. If `result.url` differs from `WEBHOOK_URL`, call `setWebhook(WEBHOOK_URL, WEBHOOK_SECRET)` and log `verification.outcome`.
5. If it matches, call `testWebhook` and log that outcome. Do not call `setWebhook`.

Compare the URL as an exact string. `WEBHOOK_URL` must be the public HTTPS URL including `/webhooks/zalo`, with no trailing-slash variant.

### Secret comparison

Hash the header and the configured secret with SHA-256 and compare the digests with `crypto.timingSafeEqual`. A missing header is a failed match. This keeps a length mismatch from skipping the comparison.

### In-process queue, concurrency 1

After the `200`, push work onto one queue. The family group is a single chat, and a canned reply has no shared writer. An in-memory `Set` of message ids enforces one send per id for the life of the process. The set is discarded on exit, which matches the spec: a redelivery after restart is answered again.

### Logging

Write JSON to stdout. During discovery, log the raw body. After `FAMILY_CHAT_ID` is set, log `event_name`, `chat.id`, `chat_type`, sender id, and `message_id`, and omit `text`. Redact any URL path segment that follows `/bot` before it is written, so an SDK error cannot print the token. Never log `WEBHOOK_SECRET` or `ZALO_BOT_TOKEN`.

### Runtime

Node.js 22, TypeScript strict, ESM. Image is `node:22-slim` (not Alpine), non-root user, container port `3000`. Compose has one service `bot`, `restart: unless-stopped`, `env_file: .env`, no published host ports, and a named volume `bot-data` mounted at `/data`. This slice does not write there. The mount exists so the next change can add SQLite without recreating the Dokploy volume. The healthcheck is a Node request to `GET /health`.

On SIGTERM, stop accepting connections, drain the queue, then exit.

### Dependencies

- `fastify` for the HTTP server and JSON logs.
- `zod` for env validation.
- `zalo-bot-js` for the Zalo client.

Tests use `node --test` against the handler with a fake Zalo client. No live token.

## Risks / Trade-offs

- [Group payload contains fields we do not branch on] → Discovery logs the raw body. The canned reply uses only `event_name`, `chat`, `from`, and `message_id`.
- [First boot registers before Dokploy's domain routes to the container] → URL is still saved. The next boot sees a match and calls `testWebhook`, so a failed probe is not sticky.
- [Restart answers a redelivery twice] → Accepted for this slice. The duplicate is one fixed sentence. SQLite dedupe is a later change.
- [SDK or proxy logs the token-bearing URL] → Redact `/bot…/` before any error string is logged.
- [`WEBHOOK_URL` trailing slash will re-register on every boot] → Document the exact URL. Compare strings, do not normalize silently.
- [Unused `/data` volume] → Empty until a later change. Avoids a compose change after the family has already deployed.

## Migration Plan

1. Deploy the compose project on Dokploy with `FAMILY_CHAT_ID` empty and `MODE=webhook`. Domain: service `bot`, container port `3000`, HTTPS on. `WEBHOOK_URL` is `https://<that-domain>/webhooks/zalo`.
2. Confirm logs show the process listening, then `verification.outcome` or the `testWebhook` outcome.
3. @mention the bot once. Copy `chat.id` from the log line whose `chat_type` is `GROUP`.
4. Set `FAMILY_CHAT_ID` and redeploy. @mention once. The group should receive `Mình nhận được.`
5. Rollback: redeploy the previous image, or stop the service. Zalo keeps the stored URL until a later `setWebhook` or `deleteWebhook`. This slice does not call `deleteWebhook`. No database to restore.

## Open Questions

None. The raw group body is learned from the first mention and does not change this slice's behavior.
