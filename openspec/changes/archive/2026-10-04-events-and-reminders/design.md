## Context

Family Bot needs to manage reminders, appointments, birthdays, anniversaries, and giỗ (Vietnamese death anniversaries). In Vietnam, many family events, especially giỗ and ancestral commemorations, are tracked exclusively via the lunar calendar (âm lịch), requiring yearly recurrence calculations mapped to corresponding solar dates (dương lịch) for any given year.

The current system has `lists` and `messages`, but no schema or tools for events. This design introduces the database models, Vietnamese lunar calendar logic (UTC+7), event repository, and LLM tools (`event_add`, `event_list_upcoming`, `event_update`, `event_delete`).

## Goals / Non-Goals

**Goals:**
- Provide a unified SQLite schema for `events` and `reminders_sent` (supporting idempotency for phase 4).
- Implement a deterministic, zero-dependency Vietnamese lunar calendar converter based on Ho Ngoc Duc's astronomical algorithm (UTC+7), supporting leap months and leap years.
- Compute upcoming event occurrences for both solar and lunar events accurately, including recurring events (none, daily, weekly, monthly, yearly).
- Expose four standard LLM tools: `event_add`, `event_list_upcoming`, `event_update`, `event_delete`.
- Guide the LLM to format event listings cleanly without raw markdown asterisks (fitting Zalo plain-text display conventions).

**Non-Goals:**
- Active background cron scheduling and notification delivery (that is Phase 4: Scheduled messages).
- Google Calendar / external calendar two-way synchronization.
- Complex recurrence rules like "3rd Tuesday of every month" (keep recurrence to none, daily, weekly, monthly, yearly as specified).

## Decisions

### Decision 1: Single Unified `events` Table
We use a single table `events` with columns:
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `chat_id`: TEXT NOT NULL
- `title`: TEXT NOT NULL
- `kind`: TEXT NOT NULL (`'event' | 'reminder' | 'birthday' | 'anniversary' | 'gio' | 'appointment'`)
- `calendar`: TEXT NOT NULL (`'solar' | 'lunar'`)
- `day`: INTEGER NOT NULL (1..31)
- `month`: INTEGER NOT NULL (1..12)
- `year`: INTEGER NULLABLE (for one-off events or when birth/founding year is known)
- `is_leap_month`: INTEGER NOT NULL DEFAULT 0 (1 if lunar leap month, e.g. nhuận)
- `recurrence`: TEXT NOT NULL DEFAULT 'none' (`'none' | 'yearly' | 'monthly' | 'weekly' | 'daily'`)
- `remind_days_before`: INTEGER NOT NULL DEFAULT 0 (days in advance to alert)
- `notes`: TEXT NULLABLE
- `created_by`: TEXT NOT NULL
- `ts`: INTEGER NOT NULL

*Rationale:* A unified table directly fulfills the requirement in `readme.md`, avoids fragmentation between birthdays and reminders, and allows uniform upcoming calculation.

### Decision 2: Self-Contained Vietnamese Lunar Algorithm (Ho Ngoc Duc / UTC+7)
We implement the standard Ho Ngoc Duc astronomical algorithm in `src/lunar/index.ts`.
- Computes new moons and solar terms using Sun and Moon celestial longitude based on astronomical formulas adapted for UTC+7 (105°E).
- Handles leap months (tháng nhuận) correctly according to Vietnamese calendar standards (which can differ from Chinese calendar due to timezone).
- Zero external dependencies ensures long-term stability and fast in-memory conversion.

### Decision 3: Next Occurrence Resolution Engine
A helper function `getNextOccurrence(event: EventRow, referenceDate: Date): { date: Date; daysRemaining: number } | null`:
- For **solar events**:
  - `recurrence: 'none'`: Target is `year-month-day`. If in past, no future occurrence.
  - `recurrence: 'yearly'`: Checks current year `year-month-day`; if in the past, uses `(currentYear + 1)-month-day`.
  - `recurrence: 'monthly'`: Checks current month `day`; if past, next month.
  - `recurrence: 'weekly'`: Next matching day of week.
  - `recurrence: 'daily'`: Next day.
- For **lunar events**:
  - Converts the lunar `(day, month, is_leap_month)` to a solar date in `referenceDate.getFullYear()`.
  - If that solar date has already passed, converts for `referenceDate.getFullYear() + 1`.
  - Computes `daysRemaining`.

### Decision 4: Event Tools for LLM
Four tools exposed via Vercel AI SDK:
1. `event_add`: Adds a new event/reminder/birthday/giỗ with parameters for solar/lunar calendar, day, month, optional year, recurrence, and remind_days_before.
2. `event_list_upcoming`: Queries upcoming events for the current chat within a time window (default 30 days, max 365 days), computing both solar and lunar next occurrences and sorting chronologically.
3. `event_update`: Updates an existing event's fields by ID.
4. `event_delete`: Removes an event by ID.

## Risks / Trade-offs

- **[Risk]** Lunar date conversion edge cases (leap months, invalid day for month e.g. 30th day in a 29-day lunar month).
  → **Mitigation**: Canonicalize lunar dates (clamp day to last day of lunar month), and provide extensive unit test cases comparing with verified historical calendars.
- **[Risk]** LLM confusing lunar vs solar or setting invalid recurrence.
  → **Mitigation**: Provide clear descriptions in Zod tool schemas and explicit guidelines in the system prompt.
