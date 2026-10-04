# Proposal

## Why

The family bot is already in the Zalo group, and nothing is deployed behind it. An @mention currently has nowhere to go. The official docs disagree about whether group delivery is generally available, and the published message sample is a private chat, so the first deploy has to prove that Zalo can call us and that we can send one message back before any model or database is added.

## What Changes

- Add a single-process bot that runs on Dokploy via Docker Compose and exposes `GET /health` and `POST /webhooks/zalo`.
- Register the webhook only after the HTTP server is listening. Re-register when `WEBHOOK_URL` differs. When the URL already matches, probe with `testWebhook` instead of calling `setWebhook` again.
- Acknowledge every request that carries the correct secret with `200` before parsing the body. Log the raw JSON. Persist nothing.
- Leave `FAMILY_CHAT_ID` empty on the first boot: log `chat.id`, `chat_type`, and sender identity, and reply nothing.
- After `FAMILY_CHAT_ID` is set to a `GROUP` chat, reply to each text mention with the fixed sentence `Mình nhận được.` and with no other text.
- Refuse `MODE=polling` at startup so this production token cannot call `deleteWebhook`.
- Out of scope: DeepSeek, SQLite, conversation history, lists, events, reminders, scheduled messages, memory, rate limiting, and backups.

## Capabilities

### New Capabilities

- `zalo-webhook`: Webhook ingress, secret check, immediate acknowledgement, raw payload logging, and startup registration.
- `group-discovery`: Discovery logging while the family chat id is unset, and the canned group reply once it is set.

### Modified Capabilities

- None. The project has no existing specs.

## Impact

- New Node.js 22 TypeScript service, `Dockerfile`, `docker-compose.yml`, and `.env.example`. No `.env` is committed.
- Zalo Bot API via `zalo-bot-js`: `getWebhookInfo`, `setWebhook`, `testWebhook`, and `sendMessage`. The bot token appears in the API path and must be masked in logs.
- Dokploy supplies environment variables and routes public HTTPS to container port 3000. The first boot is log-only. The second boot, after `FAMILY_CHAT_ID` is set, is the one that speaks.
- `zalo-bot-js` typed fields drop unknown keys (the documented photo field is `photo`; the SDK reads `photo_url`). The raw body is the source of truth for this slice.
