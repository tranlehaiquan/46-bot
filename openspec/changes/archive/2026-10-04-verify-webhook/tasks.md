# Tasks

## 1. Scaffold

- [x] 1.1 Create the Node.js 22 ESM TypeScript package with `fastify`, `zod`, and `zalo-bot-js`, and verify `npm install` and `tsc --noEmit` succeed
- [x] 1.2 Add zod env validation and `.env.example`, and verify tests cover a missing webhook URL, `MODE=polling`, an empty `FAMILY_CHAT_ID`, a secret outside 8–256 characters, and errors that omit the token and secret

## 2. Webhook HTTP

- [x] 2.1 Add Fastify with a raw-body parser and a 64 KiB limit, exposing only `GET /health` and `POST /webhooks/zalo`, and verify tests cover `200` on `/health`, `404` on any other path, and `413` on an oversized body
- [x] 2.2 Acknowledge a matching secret with `200` and `{"message":"Success"}` before parsing, reject a missing or wrong secret with `401`, and verify tests cover a wrong secret, a missing secret, a non-JSON body, and a JSON body with no message id

## 3. Group discovery

- [x] 3.1 Normalize the documented Zalo envelope, keep the raw object, and enqueue work after the `200` on a single in-memory queue that sends at most once per message id, and verify a duplicate message id in one process does not send twice
- [x] 3.2 Implement discovery logging and the canned reply, and verify tests cover an empty `FAMILY_CHAT_ID` (log `chat.id` and `chat_type`, no send), a matching `GROUP` text message (exact `Mình nhận được.` to `chat.id`), a bot sender, a different chat id, a `PRIVATE` chat, and a non-text event

## 4. Registration and shutdown

- [x] 4.1 Register the webhook only after listen: `setWebhook` when the URL differs, `testWebhook` when it matches, and verify tests cover both branches and that logged outcomes omit the secret
- [x] 4.2 Redact `/bot…/` path segments in logged errors and drain the queue on SIGTERM, and verify a token-bearing URL is logged without the token

## 5. Deploy packaging

- [x] 5.1 Add a multi-stage `node:22-slim` Dockerfile running as non-root and a compose file with service `bot`, `env_file: .env`, no published ports, named volume `bot-data` at `/data`, and a Node healthcheck for `GET /health`, and verify `docker compose config` succeeds
- [x] 5.2 Document the Dokploy deploy for this slice, including the exact `WEBHOOK_URL`, the empty-`FAMILY_CHAT_ID` boot, and the second boot that expects `Mình nhận được.`, and verify the README contains those steps
