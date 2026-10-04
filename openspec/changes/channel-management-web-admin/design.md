## Context

Currently, 46-bot manages chat channel access via the static `FAMILY_CHAT_IDS` environment variable. When the bot is added to a new group or receives a private message, the bot logs discovery info or sends an onboarding message instructing the user to edit `.env` and restart the process.

This design introduces dynamic channel management stored in SQLite and an integrated Web Admin interface powered by React + Vite (hosted on Fastify) secured by `ADMIN_PASSWORD`.

## Goals / Non-Goals

**Goals:**
- Provide dynamic persistence for channels (`chat_id`, `name`, `chat_type`, `status: pending | active | disabled`, `last_active_at`).
- Auto-discover new channels on incoming deliveries, storing them as `pending` without requiring bot restart.
- Allow administrators to review, approve (`active`), or block (`disabled`) channels via a web dashboard.
- Enable channel inspection and direct actions:
  - View chat history and send messages as the bot.
  - View and manage channel events and scheduled reminders.
  - View and manage channel long-term memory (facts & memory book).
- Provide a clean React + Vite SPA served via Fastify at `/admin`, protected by an `ADMIN_PASSWORD` check.

**Non-Goals:**
- Multi-user RBAC or OAuth / OpenID Connect (single administrator with `ADMIN_PASSWORD` is sufficient).
- Real-time WebSockets / SSE for live chat streaming (polling or refetch on demand is adequate for admin inspection).
- Fine-grained per-tool runtime configuration overrides per channel in this initial phase (reserved for future enhancement).

## Decisions

### 1. Database Schema for Channels
Introduce a new table `channels` in SQLite:
```sql
CREATE TABLE IF NOT EXISTS channels (
  chat_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  chat_type TEXT NOT NULL,         -- 'GROUP' | 'PRIVATE'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'disabled'
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);
```
*Rationale*: SQLite `better-sqlite3` already manages `messages`, `events`, `memories`, and `lists`. Storing channel state in the same database preserves zero external dependencies and ensures transactional consistency.

### 2. Channel Lifecycle & Delivery Pipeline Integration
- When a delivery arrives in `src/delivery.ts`:
  1. The bot inspects `channels.chat_id`. If absent, inserts `status = 'pending'`, captures sender name or group name if available, and sets `last_active_at = now`.
  2. If present, updates `last_active_at = now`.
  3. Checks `status`:
     - If `active`: proceeds through normal mention/reply checks and LLM execution.
     - If `pending`: if addressed via mention/reply (or private message), replies with an approval notice: `"Nhóm/Kênh đang chờ admin phê duyệt trên Dashboard để kích hoạt bot nhé."`.
     - If `disabled`: completely silences the bot.
*Backward Compatibility*: On first startup, any existing `FAMILY_CHAT_IDS` from `.env` are seeded into `channels` with `status = 'active'` if not already present.

### 3. Web Admin Architecture: Embedded React + Vite
- Frontend lives in `web/` using Vite, React, TypeScript, and modern responsive CSS.
- In Development: `vite` runs with HMR and proxies `/api` requests to Fastify (:3000).
- In Production: `pnpm build:web` outputs static assets to `web/dist`. Fastify registers `@fastify/static` mounted at `/admin` (with SPA fallback to `index.html`).
*Alternatives considered*:
- *Vanilla JS in Fastify templates*: Avoids build steps, but React provides better maintainability for multi-tab management (Chat log, Reminders, Memory).

### 4. Authentication Mechanism
- Environment variable `ADMIN_PASSWORD` is configured in `src/config.ts`.
- `POST /api/admin/login`: verifies password against `ADMIN_PASSWORD`, generates a signed token or sets an HTTP-only session cookie.
- Admin route pre-handler hook verifies authorization for all `/api/admin/*` endpoints.

### 5. Repository Pattern & Admin Routes
- Create `src/db/repositories/channels.ts` (`ChannelRepository`) to encapsulate channel CRUD and status transitions.
- Create `src/admin/` route module defining:
  - `POST /api/admin/login`
  - `GET /api/admin/channels`, `PATCH /api/admin/channels/:chatId`
  - `GET /api/admin/channels/:chatId/messages`, `POST /api/admin/channels/:chatId/messages`
  - `GET /api/admin/channels/:chatId/events`, `POST /api/admin/channels/:chatId/events`, `DELETE /api/admin/channels/:chatId/events/:id`
  - `GET /api/admin/channels/:chatId/memories`, `POST /api/admin/channels/:chatId/memories`, `DELETE /api/admin/channels/:chatId/memories/:id`

## Risks / Trade-offs

- **[Risk] Single Fastify port handling webhook + admin UI** → *Mitigation*: Webhook payload parsing uses strict body-limit and secret-token verification without affecting `/api` or `/admin` routes. Route prefixes keep concerns separated.
- **[Risk] Group display name unavailable in raw Zalo delivery** → *Mitigation*: Fall back to `chat_id` or sender display name when creating pending channel, allow admin to rename channel display name on the web UI.
- **[Risk] Database locking under concurrent webhook and admin writes** → *Mitigation*: SQLite WAL mode is enabled in `src/db/connection.ts`, providing safe concurrent reads and serialized fast writes.
