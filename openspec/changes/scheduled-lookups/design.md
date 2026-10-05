# Design

## Context

See proposal.md for why this change exists. The bot already runs an in-process scheduler in `Asia/Ho_Chi_Minh` (`src/scheduler/index.ts`) for the morning briefing, Sunday outlook, and event reminders. Live answers already come from `weather_check` (wttr.in), `web_search` (Tavily), and `holiday_list_upcoming`. Events are calendar records with their own recurrence and `reminders_sent` rows; they are the wrong store for "fetch this instruction from the internet." Channel status (`pending`, `active`, `disabled`) already gates conversation in `handleDelivery`.

## Goals / Non-Goals

**Goals:**

- One lookup record and one runner for every internet topic.
- Durable once-per-local-day delivery, including a restart later that same day.
- Read-only scheduled runs, with the saved instruction kept outside the system prompt.
- Admin pause, resume, delete, and last-run visibility on the channel screen.

**Non-Goals:**

- Lunar monthly lookups, including leap months. Roadmap: resolve a lunar day through the existing lunar calendar module and add `calendar` plus `is_leap_month` to the lookup record.
- Replacing or merging the morning briefing, weekly outlook, or event reminders.
- Full cron expressions, per-member delivery inside a group, or a shared fetch cache across chats.
- Creating lookups from the admin UI. Creation stays in conversation.
- A new table, tool, or formatter per topic.

## Decisions

### 1. Separate lookup tables

Add `scheduled_lookups`:

- `id`, `chat_id`, `instruction`, `recurrence` (`daily` | `weekly` | `monthly`)
- `hour`, `minute`
- `weekday` (0–6, Sunday = 0; required for weekly, null otherwise)
- `day_of_month` (1–31; required for monthly, null otherwise)
- `active`, `created_by`, `created_at`, `updated_at`

Add `scheduled_lookup_runs`:

- `lookup_id`, `fire_date` (`YYYY-MM-DD` in Vietnam local time)
- `status` (`running` | `sent` | `failed`)
- `attempt_count`, `last_error`, `sent_at`
- Unique `(lookup_id, fire_date)`

A lookup is not an event. Event recurrence, lunar fields, and `remind_days_before` stay on `events`.

Alternative considered: store the instruction on an `events` row with `recurrence=daily`. That overloads giỗ and birthday reminders and still cannot record a failed internet fetch.

### 2. Claim the occurrence before the model call

On each tick, and once at startup, select active lookups whose local date matches and whose local time is at or after `hour:minute`, with no `sent` or `failed` run for that `fire_date`.

Insert the run as `running` first. The unique key is the lock, so an overlapping tick does not start a second run. After a successful send, set `sent`. On failure, increment `attempt_count` and leave the row retryable until the count reaches 3, then set `failed`. A `running` row older than 10 minutes is treated as a crashed attempt and may be retried.

Skipping `pending` or `disabled` does not insert a run, so activating the channel later that day still delivers.

Alternative considered: the morning briefing's in-memory set. A restart would lose the claim and could double-send. Event reminders already persist delivery; lookups follow that pattern.

### 3. Schedule match

- `daily`: every local date.
- `weekly`: local weekday equals `weekday`.
- `monthly`: local day equals `day_of_month`, or the last day of the month when `day_of_month` is past the end of the month. Use the same clamp as `createUtc7Date`.

The existing exact-minute check (`hour === 7 && minute === 0`) remains for briefings and reminders. Lookups use "at or after the clock time, still this local date" so a delayed tick still qualifies.

### 4. Read-only runner

Build a tool set containing only `weather_check`, `web_search`, and `holiday_list_upcoming`. `holiday_import` is a write and stays out. Pass no chat history and no memory-write tools.

Use a short system prompt: answer only the saved brief, Vietnamese by default, plain Zalo text, no follow-up question, no Markdown. Wrap the instruction with the existing user-message delimiter and run it through `detectPromptInjection` before saving and before each run. A detected injection is not saved; if one is already stored, the run records `failed` without calling the model.

Call the existing `LlmClient.generateReply` with that prompt and tool set. Split outbound text with `splitText` at 2000 characters.

Alternative considered: freeze a single tool name and arguments at creation time. A later "weather and gold" instruction needs both tools, and the model already supports a 4-step tool loop. The allowlist is what keeps a new topic from becoming a new scheduler.

### 5. Conversation tools

Add four tools bound to the current chat:

- `lookup_schedule_create`
- `lookup_schedule_list`
- `lookup_schedule_update`
- `lookup_schedule_cancel`

The model writes `instruction` as the fetch brief, without the scheduling words. The tool rejects a weekly lookup without `weekday` and a monthly lookup without `dayOfMonth`. The tool result tells the model to confirm the schedule and, for monthly, the short-month rule. Prompt text in `DEFAULT_SYSTEM_PROMPT` points schedule-an-internet-lookup requests at these tools and keeps `event_add` for calendar events.

### 6. Admin surface

Authenticated routes, matching the channel event routes:

- `GET /api/admin/channels/:chatId/lookups`
- `PATCH /api/admin/channels/:chatId/lookups/:id` with `{ "active": boolean }`
- `DELETE /api/admin/channels/:chatId/lookups/:id`

The channel detail screen gets a lookups section: instruction, schedule, active state, last-run status, pause/resume, and delete. No create form.

### 7. Wiring

`createScheduler` gains the lookup repository, channel repository, and LLM client. `src/index.ts` passes the instances it already constructs. `web_search` is omitted from a run when `TAVILY_API_KEY` is absent; `weather_check` and `holiday_list_upcoming` still run. A gold-price lookup then fails through the normal 3-attempt path.

## Risks / Trade-offs

- **[Risk] The model phrases the same weather differently each morning** → The saved instruction and the short briefing prompt constrain the answer. There is no per-topic template.
- **[Risk] A lookup at 07:00 and the morning briefing both arrive** → They stay separate messages, as specified. The chat can move the lookup's clock time.
- **[Risk] LLM, Tavily, or wttr.in is slow or down** → The claim lock stops overlapping ticks. Three attempts per local day bound the cost. The chat stays silent; admin shows `failed`.
- **[Risk] Process dies after Zalo accepts the message and before `sent` is committed** → SQLite writes are synchronous, so the window is a crash between those two calls. A duplicate that morning is the accepted failure mode.
- **[Risk] Many lookups in one chat multiply model and search calls** → No cap in this version. Each lookup is an explicit family request, and chats are admin-gated.

## Migration Plan

1. Add the two tables in the existing SQLite migration path. No backfill.
2. Deploy the bot. Existing briefings and reminders keep their current triggers.
3. Rollback is a revert of the process: the new tables can remain unused. No change to `events` or `reminders_sent`.

## Open Questions

None. Lunar monthly is deferred on purpose and listed under Non-Goals.
