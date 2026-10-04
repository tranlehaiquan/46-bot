## Why

The bot currently manages family events, lunar recurring dates, and Vietnamese holidays in SQLite, but only reports them when a user explicitly invokes a tool command. To fulfill Phase 4, the bot must proactively notify the family at scheduled times: sending a daily morning briefing (07:00), a weekly preview on Sunday evening (20:00), and timely reminders (08:00) for upcoming events.

Furthermore, families frequently have multiple group chats or dedicated channels. The configuration must support a list of family chat IDs (`FAMILY_CHAT_IDS`), and when `FAMILY_CHAT_IDS` is empty, rather than only replying with a static canned message, the bot must respond conversationally to any channel where a user chats (when mentioned in groups or in direct messages), while logging the chat ID for easy configuration.

## What Changes

- **Multi-Channel Family Configuration**: Support `FAMILY_CHAT_IDS` as a comma-separated list of chat IDs (with backward compatibility for `FAMILY_CHAT_ID`), allowing the bot to serve multiple family channels simultaneously.
- **Open Channel Interaction When Empty**: When `FAMILY_CHAT_IDS` is empty, the bot logs the incoming delivery for discovery AND generates a full conversational LLM response for any channel where users chat (requiring mention/reply in groups), replacing the static canned reply.
- **Multi-Channel Proactive Delivery**: Proactive scheduled messages (morning briefings, weekly outlooks, and event reminders) are dispatched to all channels in `FAMILY_CHAT_IDS`. If `FAMILY_CHAT_IDS` is empty, event reminders are delivered directly to the `event.chat_id` where the event was registered.
- **Background Scheduler Service**: In-process scheduler operating in `Asia/Ho_Chi_Minh` (UTC+7) time zone without external native dependencies.
- **Daily Morning Briefing (07:00)**: Evaluates today's events, active Vietnamese holidays, and upcoming birthdays/anniversaries within the next 7 days, formatting a concise, warm Vietnamese summary.
- **Sunday Weekly Summary (20:00)**: Formats and posts an outlook of the upcoming week's events and milestones to the family channels.
- **Targeted Event Reminders (08:00)**: Checks for events occurring today and events reaching `remind_days_before` thresholds, posting reminder alerts.
- **Deduplication & Idempotency**: Records delivered reminders in the `reminders_sent` table (`event_id`, `occurrence_date`, `sent_at`) to ensure container restarts or redeployments never duplicate notifications.
- **Startup Catch-up**: On bot startup, evaluates whether scheduled runs from the last 2 hours were missed and delivers them safely once.
- **Lifecycle Integration**: Scheduler starts with the Fastify server and stops cleanly on SIGTERM/SIGINT.

## Capabilities

### New Capabilities
- `scheduled-reminders`: Proactive morning briefings, weekly outlooks, and idempotent event reminders scheduled in `Asia/Ho_Chi_Minh` time zone and dispatched to configured family channels.

### Modified Capabilities
- `group-discovery`: Support `FAMILY_CHAT_IDS` list. When `FAMILY_CHAT_IDS` is empty, respond with conversational LLM to all channels if they chat (requiring mention/reply in groups), while still logging the incoming chat ID for discovery. When set, allow all matching chat IDs in the list.

## Impact

- **Configuration (`src/config.ts`)**: Parse `FAMILY_CHAT_IDS` (comma-separated) into `familyChatIds: string[]`, with backward-compatible fallback to `FAMILY_CHAT_ID`.
- **Delivery Pipeline (`src/delivery.ts`)**: In discovery mode (empty list), process messages conversationally through LLM instead of replying with a static canned string. Allow all chats matching `familyChatIds`.
- **New Modules**:
  - `src/scheduler/index.ts`: Scheduler engine, cron/timer triggers, task runner, and lifecycle methods.
  - `src/scheduler/jobs.ts` and `src/scheduler/formatters.ts`: Job handlers for morning briefing, weekly summary, and event reminder processing.
  - `src/scheduler/scheduler.test.ts`: Unit tests with mockable clock testing timing, formatting, idempotency, and multi-channel targeting.
- **Event Repository (`src/db/repositories/events.ts`)**: Helpers for querying events due for reminder and recording in `reminders_sent`.
