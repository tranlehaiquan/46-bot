## Why

Currently, allowed family channels are hardcoded via the `FAMILY_CHAT_IDS` environment variable, requiring application restarts or manual configuration changes whenever a new group or private chat needs onboarding. Furthermore, administrators lack visibility and control over channel conversations, scheduled reminders, and long-term memory. 

Introducing a web admin interface and dynamic channel management allows automatic discovery of new channels with a `pending` state, seamless admin enablement, and full management of messages, reminders, and memories directly from a web browser.

## What Changes

- **Dynamic Channel Storage & Lifecycle**: Introduce a `channels` database table storing channel details (`chat_id`, `name`, `chat_type`, `status: pending | active | disabled`, `last_active_at`).
- **Auto-Discovery Onboarding**: New incoming deliveries from unrecorded channels automatically insert a channel record in `pending` status. When mentioned or replied to in a pending group, the bot replies that the channel is awaiting administrator approval.
- **Web Admin Backend API**: Fastify endpoints under `/api/admin/*` protected by `ADMIN_PASSWORD` authentication:
  - Authentication (login/logout).
  - Channel management (list, filter by status, approve/enable, disable, rename).
  - Messages management (view channel message history, send direct bot messages).
  - Reminders & events management (list, create, edit, delete events).
  - Memory management (list, create, edit, delete facts and memory book stories).
- **React + Vite Admin SPA**: Modern web dashboard built with React and Vite, served statically via Fastify in production and proxying in development.
- **Config & Environment Updates**: Add `ADMIN_PASSWORD` to environment configuration; retain `FAMILY_CHAT_IDS` as an optional seed list for backward compatibility.

## Capabilities

### New Capabilities
- `channel-management`: Dynamic channel registration, channel statuses (`pending`, `active`, `disabled`), and runtime gating for message delivery processing.
- `web-admin`: Authentication via `ADMIN_PASSWORD`, REST endpoints for channels/messages/reminders/memories, and a React + Vite Single Page Application.

### Modified Capabilities
- `group-discovery`: Transitions from strictly static `FAMILY_CHAT_IDS` matching to dynamic channel status checks in SQLite, onboarding new channels into `pending` status upon receipt of deliveries.

## Impact

- **Database**: New migration creating the `channels` table and indexing `status` / `last_active_at`.
- **Runtime & Delivery**: `handleDelivery` in `src/delivery.ts` checks channel status in the database instead of strictly comparing against static `config.familyChatIds`.
- **Server**: `src/server.ts` mounts admin REST routes and `@fastify/static` serving the compiled React frontend at `/admin`.
- **Frontend Workspace**: New frontend directory `web/` containing React + Vite application with its own build pipeline.
- **Configuration**: Addition of `ADMIN_PASSWORD` validation in `src/config.ts`.
