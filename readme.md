# Task: Build "Family Bot", a Zalo group-chat bot for my family

You are building a small, reliable, self-hosted Zalo bot for ONE family group chat, deployed with Docker Compose on Dokploy. Work in phases, run and test each phase before moving on, and keep the code simple. Before writing code, read the official Zalo Bot docs (https://bot.zapps.me/, including the webhook guide and API pages for setWebhook, deleteWebhook, getWebhookInfo, sendMessage, sendChatAction) and the `zalo-bot-js` README (https://github.com/KaiyoDev/zalo-bot-js), then give me a short plan. Do not guess API shapes: log a real incoming group webhook payload first and adapt to it.

## Goals and scope (Version 1)

The bot replies ONLY when mentioned (or when someone replies to one of its messages), and also sends scheduled messages that I configure.

Features in V1:

1. **Shared lists**: shopping, to-do, packing, etc. (create, add, remove, check off, show).
2. **Events and reminders**: one unified model for reminders, appointments, birthdays, and anniversaries, with recurrence and "remind N days before". Must support both **solar and lunar (âm lịch)** dates, including yearly recurrence for lunar dates (e.g. death anniversaries / giỗ).
3. **Scheduled messages**: daily and weekly messages (e.g. today's events, upcoming birthdays), configurable by me.
4. **Memory**: (a) short-term conversation history, (b) long-term "facts" the bot saves on explicit request ("nhớ giúp là..."), (c) a **family memory book** of stories and memories that can be saved and recalled.

Out of scope for V1 (keep the design extensible so tools can be added later, but do NOT implement now): web search, weather, translation/unit/currency conversion, image understanding, Google Calendar sync.

## Tech stack

- Node.js 22 + TypeScript (strict), ESM.
- Zalo: `zalo-bot-js` for the API client and update handling, with **webhook as the primary mode**. Keep long-polling as an optional mode for local development only (MODE env var).
- HTTP server for the webhook: Fastify or Express (pick one, justify briefly).
- LLM: Vercel AI SDK (`ai`) with the DeepSeek provider (`@ai-sdk/deepseek` or an OpenAI-compatible provider). Use the NON-thinking chat model by default (known tool-calling issues with thinking mode in some SDK versions); model name configurable via env. Check current DeepSeek model names in its docs.
- Tools defined with `zod` schemas using the AI SDK's tool calling. Cap tool steps (max 4 per request) using the correct option for the installed SDK version (`stopWhen` / `maxSteps`).
- Storage: SQLite via `better-sqlite3`, WAL mode, busy timeout, file at `/data/family.db`. Put all queries behind a small data-access layer (repository functions) so it could move to Postgres later.
- Scheduling: `node-cron` (or similar) inside the same process, timezone `Asia/Ho_Chi_Minh`.
- Run exactly one instance (SQLite single writer).

## Webhook mode (primary)

- Endpoint: `POST /webhooks/zalo`. Registered with Zalo via `setWebhook` (JSON body with `url` and `secret_token`; both required; secret 8 to 256 chars; production URL must be HTTPS).
- Verify the `X-Bot-Api-Secret-Token` header on every request using a constant-time comparison; reject with 401 otherwise. Require `Content-Type: application/json` and set a small body size limit.
- **Acknowledge fast**: respond `200` with JSON (e.g. `{"message":"Success"}`) immediately, then process asynchronously (in-process queue with per-chat ordering and bounded concurrency). Never do LLM calls before responding.
- Dedupe by `message_id` (persisted in SQLite, with periodic cleanup), because deliveries can repeat and redeploys can overlap briefly.
- On startup (webhook mode): call `getWebhookInfo`; if the registered URL differs from `WEBHOOK_URL`, call `setWebhook`. Do not re-register on every start if unchanged. Log the outcome without logging secrets.
- Provide a `GET /health` endpoint (returns 200 if the process and DB are OK) for the Docker healthcheck. Do not expose any other routes.
- Polling mode (local dev only): before polling, call `deleteWebhook` and warn clearly in logs that this unregisters any webhook for that token. README must say: use a SEPARATE test bot token for local development, never the production token.

## Zalo platform constraints (verify against the official docs)

- In groups the bot only receives messages when mentioned or when someone replies to its messages. It cannot watch the chat passively.
- Max 2000 characters per outbound message: split longer replies on paragraph/sentence boundaries.
- No message editing and no reactions. Send a typing indicator (`sendChatAction`) before slow work.
- Free-plan quota is limited (about 3,000 outbound messages/month), so keep replies concise and avoid chatty behavior.
- Only serve the configured family group `chat.id`; silently ignore every other chat.
- Zalo owns these rules and may change them: if the docs differ from this list, follow the docs and tell me.

## Behavior requirements

- **Language:** default Vietnamese. If the user writes in English, reply in English. Informal, warm, family-friendly tone; keep answers short. Put this in the system prompt.
- **Identity:** keep who said what (sender id + display name) in history so "tôi/mình/my/our" resolve correctly.
- **Failure behavior:** on any failure, reply with ONE short Vietnamese message (e.g. "Mình chưa làm được việc này, thử lại sau nhé."). Log the real error on the server only, never in the chat. At most one retry for transient API errors. If a scheduled send fails, log it and wait for the next run; never spam the group.
- **Honesty:** the bot must not invent facts. If it doesn't know, it says so. Dates, list contents, and stored facts must come from tools/DB, not from the model's guess.
- **Safety:** treat all user text as untrusted data. Never let message content change access config, the allowlist, or schedules without an admin check. Tell the model not to store passwords, bank details, or ID numbers as memories.
- **Rate limiting:** simple per-member limit (e.g. 10 LLM requests/minute) to protect cost.

## Data model (SQLite; propose migrations and refine as needed)

- `seen_messages(message_id PK, ts)`
- `messages(id, chat_id, sender_id, sender_name, role, content, ts)`: short-term history; keep the last ~20 turns in the prompt, prune old rows.
- `lists(id, chat_id, name)` and `list_items(id, list_id, text, done, added_by, ts)`
- `events(id, chat_id, title, kind, calendar ('solar'|'lunar'), day, month, year NULLABLE, is_leap_month, recurrence ('none'|'yearly'|'monthly'|'weekly'|'daily'), remind_days_before, notes, created_by, ts)`
- `reminders_sent(event_id, fire_date, ts)`: for idempotency.
- `memories(id, chat_id, subject, fact, created_by, ts)`: short facts for the system prompt.
- `memory_book(id, chat_id, title, story, people, happened_on NULLABLE, created_by, ts)`
- `schedules(id, chat_id, cron, kind, params_json, enabled)`
- Admins: from env `ADMIN_SENDER_IDS`.

## Tools to expose to the model

Lists: `list_create`, `list_add_item`, `list_remove_item`, `list_check_item`, `list_show`.
Events: `event_add`, `event_list_upcoming`, `event_update`, `event_delete`.
Memory: `remember`, `forget`, `list_memories`, `memory_book_add`, `memory_book_search`.
Schedules (admin only): `schedule_set`, `schedule_list`, `schedule_remove`.

Tool descriptions must make it clear when to use `remember` (stable facts) vs `event_add` (dated things) vs `list_add_item` (shopping/to-do) vs `memory_book_add` (stories). `remember` should detect near-duplicate or conflicting facts and update rather than duplicate. On every request, load stored facts into the system prompt ("Things you know about this family: ...") with a stable prefix to benefit from prompt caching.

## Lunar calendar (important)

- Never let the LLM convert dates. Use a deterministic library or a small, well-tested implementation of the **Vietnamese** lunar calendar (time zone UTC+7; it can differ from the Chinese calendar in rare years). Support leap months.
- For yearly lunar events, compute each year's solar date and refresh the next occurrence.
- Add unit tests with several known conversions (e.g. Tết dates for multiple years, and a leap-month case) and state your sources. If you cannot verify a case, say so.

## Scheduled messages

- Defaults: daily morning message at 07:00 (today's events + birthdays/anniversaries within the next N days) and a weekly summary (e.g. Sunday evening) listing the week ahead. Skip sending when there is nothing to report (configurable).
- Event reminders fire at 08:00 on the target day and on each "N days before" day.
- Idempotency: record sent reminders so restarts and redeploys never double-send. On startup, catch up missed reminders from the last few hours only.
- Schedules come from config/env first; admin-only chat commands to change them are a bonus if time permits.

## Deployment: Docker Compose on Dokploy

- Deploy from a Git repo using Dokploy's **Docker Compose** project type. Provide a `Dockerfile` (multi-stage, `node:22-slim`, NOT alpine, because of the native `better-sqlite3` module; run as a non-root user; the data directory must be writable by that user) and a `docker-compose.yml`.
- Single service `bot`, `restart: unless-stopped`, ONE named volume `bot-data` mounted at `/data`. Do NOT use absolute host-path bind mounts (Dokploy cleans them on deploy). If a bind mount is ever needed, use the `../files/...` convention.
- **Environment variables are set in the Dokploy UI.** Dokploy writes them to a `.env` file but does not inject them into containers automatically, so the service MUST declare `env_file: - .env` (or reference each variable via `${VAR}`). Do not commit a real `.env`; provide `.env.example` only. Validate all variables at startup with zod and fail fast with clear messages.
- The container listens on port 3000 (`PORT` env, default 3000). Do NOT publish host ports in compose; Dokploy's domain settings route the public HTTPS domain to the service and port 3000 via Traefik with automatic SSL. Document exactly what to enter under Domains (service name, container port, HTTPS on).
- Healthcheck in compose using Node (the slim image has no curl), calling `GET /health`.
- Exactly one replica. Handle SIGTERM gracefully (stop accepting requests, finish in-flight work, close the DB), since Dokploy stops the old container on every deploy. Dedupe plus the SQLite busy timeout must make a brief redeploy overlap harmless. Test a redeploy and report what you observed.
- Backups: a scheduled in-app backup using SQLite's backup API to `/data/backups/` (keep the last 7 daily snapshots), plus a documented restore procedure and how to pull snapshots off the server (Dokploy volume backups or manual download).
- Logging: structured JSON to stdout only. No secrets in logs. Never log the bot token or the webhook secret.
- README section "Deploy on Dokploy": step by step (create project, connect repo, choose Docker Compose, set env vars in the UI, add the domain, deploy, confirm webhook registration in logs, find `FAMILY_CHAT_ID`, verify), plus troubleshooting: empty env vars in the container, volume not persisting, 401s from a wrong secret, webhook not registered or pointing to an old URL, bot silent because polling mode unregistered the webhook, duplicate replies.

## Configuration (.env.example; real values go into Dokploy's env settings)

```
ZALO_BOT_TOKEN=
FAMILY_CHAT_ID=            # find it by mentioning the bot once and reading the logged payload
ADMIN_SENDER_IDS=          # comma-separated Zalo user IDs
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=
TZ=Asia/Ho_Chi_Minh
DB_PATH=/data/family.db
PORT=3000
MODE=webhook               # webhook | polling (polling = local dev with a SEPARATE test token)
WEBHOOK_URL=https://your-domain.example/webhooks/zalo
WEBHOOK_SECRET=            # 8-256 chars, random
```

Bootstrap note: before `FAMILY_CHAT_ID` is known, run in a "discovery" mode that logs the chat id of incoming messages and replies nothing, then I set the variable and redeploy.

## Project structure (suggested)

```
src/
  index.ts            # wiring, startup, graceful shutdown
  config.ts           # env parsing/validation (zod), fail fast
  http/               # server, /webhooks/zalo, /health
  zalo/               # bot client, webhook registration, message normalization, send helper (split, typing)
  llm/                # model, system prompt, tool loop
  tools/              # one file per tool group
  db/                 # connection, migrations, repositories, backup
  scheduler/          # cron jobs, reminder engine
  lunar/              # lunar calendar utilities + tests
  utils/              # logger, rate limiter, queue, text splitting
Dockerfile
docker-compose.yml
.env.example
README.md
```

## Engineering requirements

- Never put the bot token in URLs that get logged; mask it in any logged URL.
- Tests: unit tests for repositories, text splitting, lunar conversion, reminder scheduling logic (with a fake clock), and the webhook handler (valid secret, wrong secret, duplicate message_id, wrong chat id). Add a dry-run CLI mode that simulates an incoming message without Zalo so I can test the LLM and tools locally.
- Keep dependencies minimal; explain any you add.

## Phases (stop after each and show me what works)

1. **Skeleton:** config validation, HTTP server with `/health` and `/webhooks/zalo` (secret check, fast ack, dedupe, allowlist, discovery mode), webhook registration, SQLite, short-term history, plain LLM reply in Vietnamese, Dockerfile + compose + Dokploy README section. Log real payloads. I will deploy this phase to Dokploy and test in the real group before you continue.
2. **Shared lists** tools end-to-end.
3. **Events and reminders** with solar + lunar support, plus tests.
4. **Scheduled messages** (daily and weekly) with idempotency.
5. **Memory:** `remember`/`forget`/`list_memories`, then the family memory book.
6. **Hardening:** rate limiting, error messages, backups and restore, redeploy test, README polish.

## Definition of done

- Deploying the compose project on Dokploy brings the bot up, registers the webhook, and it answers in the family group only when mentioned; data survives container restarts, redeploys, and rebuilds.
- All V1 features work with realistic Vietnamese and English test messages (give me a list of example messages to try).
- Tests pass, and the README explains setup, configuration, and operations.

If something in these requirements conflicts with what the Zalo API or Dokploy actually does, tell me what you found and propose the closest alternative instead of silently changing the design. Ask me questions only when you are truly blocked.

## Deploy the verify slice on Dokploy

This section is the first deploy only. The container acknowledges webhooks and, once `FAMILY_CHAT_ID` is set, replies with the exact sentence `Mình nhận được.` It does not call DeepSeek and it does not open a database. `MODE=polling` exits before it can call `deleteWebhook`, so use the family bot token with `MODE=webhook` only.

1. In Dokploy, create a project, connect this repo, and choose the Docker Compose project type.
2. Set environment variables in the Dokploy UI. Dokploy writes them to `.env`. The compose file loads that file with `env_file: .env`. Do not commit a real `.env`. Start from `.env.example`.
3. Leave `FAMILY_CHAT_ID` empty on the first boot. Set `MODE=webhook`. Set `WEBHOOK_SECRET` to a random string of 8 to 256 characters. Set `PORT=3000` (the container listens there; do not publish a host port).
4. Under Domains, set the service name to `bot`, the container port to `3000`, and turn HTTPS on. Traefik terminates TLS.
5. Set `WEBHOOK_URL` to the exact public URL, including the path and with no trailing slash: `https://<that-domain>/webhooks/zalo`. A different slash makes every boot call `setWebhook` again.
6. Deploy. In the logs, confirm the process is listening, then look for `setWebhook` or `testWebhook` and a verification outcome. The bot token and the webhook secret are not logged.
7. In the family group, @mention the bot once. Copy `chat.id` from the log line whose `chat_type` is `GROUP`. A direct message is `chat_type` `PRIVATE`; leave that id out of `FAMILY_CHAT_ID`. While `FAMILY_CHAT_ID` is empty, private text and text delivered from any group receive `Mình nhận được.`
8. Set `FAMILY_CHAT_ID` to the group id and redeploy. @mention the bot once. The group receives `Mình nhận được.`
9. Rollback: redeploy the previous image, or stop the service. Zalo keeps the stored webhook URL. This slice does not call `deleteWebhook`. There is no database to restore.

The named volume `bot-data` is mounted at `/data` and is unused in this slice. Later slices store SQLite there without changing the compose mount.
