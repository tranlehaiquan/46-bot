## Why

Family members need a shared system to keep track of reminders, appointments, birthdays, anniversaries, and traditional Vietnamese lunar dates (such as giỗ / death anniversaries and Tết) directly through their Zalo group chat. Storing and querying these dates accurately—especially Vietnamese lunar calendar occurrences with leap month support—ensures the family never misses important milestones.

## What Changes

- Add database schema migrations for `events` and `reminders_sent` tables.
- Implement an accurate, deterministic Vietnamese lunar calendar calculation utility (UTC+7) supporting solar-to-lunar, lunar-to-solar conversions, leap months, and recurring yearly dates.
- Create an events repository providing CRUD and upcoming event queries with solar/lunar next-occurrence calculation.
- Expose LLM tools for event operations: `event_add`, `event_list_upcoming`, `event_update`, `event_delete`.
- Wire event tools into the delivery pipeline so the bot can schedule, update, delete, and list events and reminders when requested in group or private chat.
- Add comprehensive unit tests for lunar calendar calculations (including verified Tết dates and leap months) and event repository/tool behaviors.

## Capabilities

### New Capabilities
- `events-reminders`: Unified model for events, reminders, birthdays, appointments, and anniversaries supporting both solar and Vietnamese lunar calendar dates (UTC+7), recurrence rules, advance reminder offsets ("remind N days before"), and tool calling for event management.

### Modified Capabilities
<!-- None -->

## Impact

- Database: New tables `events` and `reminders_sent` in SQLite (`DB_PATH`).
- Dependencies: Potential lightweight astronomical calculation helper or self-contained Vietnamese lunar calendar algorithm (Ho Ngoc Duc's standard algorithm for VN lunar calendar).
- Runtime: Extended tools exposed to Vercel AI SDK during message delivery.
- LLM System Prompt: Updated to guide the model on event creation and distinctions between events, lists, and memories.
