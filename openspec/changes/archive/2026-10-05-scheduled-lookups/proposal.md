# Proposal

## Why

Family members ask the bot to report live internet information on a clock — weather in Ho Chi Minh City at 07:00, gold prices, news — and the bot can only answer when someone messages it. Each new topic would otherwise become its own schedule, table, and formatter. One recurring lookup should run any saved instruction through the read tools the bot already has.

## What Changes

- Add a per-chat recurring lookup: a natural-language instruction plus a schedule of daily, weekly, or monthly, at a clock time in `Asia/Ho_Chi_Minh`.
- Let the conversation create, list, update, and cancel lookups. The model rewrites the request into a stable fetch instruction and confirms the schedule.
- Run due lookups from the existing in-process scheduler. Each run calls the model with only read tools (`weather_check`, `web_search`, `holiday_list_upcoming`) and sends one plain-text message to the originating chat.
- Claim each occurrence in SQLite before the run so restarts and overlapping ticks send it once. A missed occurrence is still sent later on the same local day. After three failures that day, the chat stays silent and the run is stored as failed.
- Monthly schedules use a solar day-of-month. Day 31 in a short month is delivered on the last day of that month. The confirmation says so.
- Show lookups on the channel admin screen, including last-run status, with pause and delete.
- Leave the 07:00 family briefing, Sunday outlook, and event reminders unchanged. A lookup at the same time is a separate message.
- Roadmap, not in this change: lunar monthly lookups ("mùng 1", "ngày rằm"), including leap months, using the lunar conversion events already have.

## Capabilities

### New Capabilities
- `scheduled-lookups`: Recurring per-chat internet lookups on a daily, weekly, or monthly solar schedule, executed with read-only tools and delivered once per occurrence.

### Modified Capabilities
- `web-admin`: Channel admin can list recurring lookups, see the last run status, pause or resume a lookup, and delete it.

## Impact

- **Database**: New `scheduled_lookups` and `scheduled_lookup_runs` tables.
- **Scheduler** (`src/scheduler/`): Same-day due check and claimed execution beside the existing briefing and reminder jobs.
- **LLM tools** (`src/delivery.ts`, `src/llm/client.ts`): Four lookup-management tools. Scheduled runs use a read-only tool set and treat the saved instruction as untrusted user data.
- **Admin API and SPA** (`src/admin/`, `web/`): List, pause, and delete lookups for a channel.
- **Dependencies**: No new services. Runs reuse the configured LLM, wttr.in, and Tavily.
