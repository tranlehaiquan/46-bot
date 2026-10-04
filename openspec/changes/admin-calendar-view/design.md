## Context

The Admin Dashboard (React/Vite SPA served by Fastify) currently shows channel events only as a flat list inside each channel's "Reminders & Events" tab. Vietnam's national and traditional holidays live in `src/holidays/index.ts` and are only used by the bot's LLM tool layer — they are never exposed in the admin UI. There is no cross-channel visibility of upcoming dates.

The project already has:
- `src/holidays/index.ts` — full `VIETNAMESE_HOLIDAYS` dataset with lunar/solar metadata.
- `src/lunar/index.ts` — lunar-to-solar conversion used for Âm lịch events.
- `src/db/repositories/events.ts` — `EventsRepository` with `getAllEvents()`, `getEventsByChat()`, and `getNextOccurrence()`.
- `web/src/components/ChannelDetail.tsx` — tab-based UI already showing events per channel.

## Goals / Non-Goals

**Goals:**
- Add a **Global Calendar page** (new nav tab in Navbar) showing Vietnam holidays and all channel events across all chats, month-navigable.
- Add a **Channel Calendar view** inside each channel's Reminders & Events tab showing Vietnam holidays + that channel's events in a calendar grid.
- Expose two lightweight REST endpoints for calendar data (holidays and events as computed occurrences).
- Reuse a single `CalendarMonthGrid` component across both views.
- Display lunar date below each solar date cell.
- No external dependencies (no FullCalendar or date libraries beyond what already exists).

**Non-Goals:**
- Automated holiday reminder messages sent to Zalo channels (purely admin-facing UI).
- Week or day calendar views (month grid + agenda list only).
- Editing/creating events from the Global Calendar page (read-only there; create/delete stays in Channel Detail).
- Internationalization of the UI beyond existing Vietnamese/English strings.

## Decisions

### Decision 1: Single Reusable `CalendarMonthGrid` component

Build one pure-React component `CalendarMonthGrid` that accepts `holidays[]` and `events[]` arrays of a normalized `CalendarEntry` type. Both the Global Calendar page and the Channel Calendar view render this same component with different data subsets.

**Why over separate components**: DRY, single rendering logic to maintain, consistent visual language across both contexts.

### Decision 2: Two dedicated backend endpoints

`GET /api/admin/holidays?year=YYYY` — returns all Vietnam holiday occurrences for the year using `getUpcomingHolidays({ windowDays: 400 })`.

`GET /api/admin/calendar/events?year=YYYY&month=MM[&chatId=xyz]` — fetches all events (or filtered by chatId) and computes their occurrence date within the requested month using the existing `getNextOccurrence()` utility.

**Why not reuse the existing `/api/admin/channels/:chatId/events`**: That endpoint returns raw event rows without computed occurrence dates. The new endpoint returns calendar-ready objects with `occurrenceDateStr` and `daysRemaining` for the specific month, avoiding duplicating date-math in the frontend.

### Decision 3: App-level page routing via state (no React Router)

Add a `page: "channels" | "calendar"` state to `App.tsx`. The Navbar receives an `onNavigate` prop. No additional routing library needed given the app's simplicity.

**Why not React Router**: Overkill for two pages. Keeps bundle lean and avoids adding a dependency.

### Decision 4: Lunar date display sourced from backend

The holidays endpoint returns `originalDate` strings (e.g., `"1/1 (Âm lịch)"`) already formatted by the existing `getUpcomingHolidays()` function. For calendar cells, lunar day is displayed using the existing `lunarToSolar` inverse via a lightweight client-side helper that computes the lunar date from solar date (or fetched from the holidays endpoint metadata).

**Why**: Avoid shipping a full lunar calendar library to the browser. Vietnam holidays already carry their lunar context in the metadata.

### Decision 5: Event occurrence date calculation stays server-side

The new `/api/admin/calendar/events` endpoint resolves occurrence dates using `getNextOccurrence()` on the server. The client only receives flat `{ date, title, chatId, channelName, kind, calendar }` objects.

**Why**: `getNextOccurrence` already handles lunar→solar conversion and yearly/monthly recurrence logic server-side. Porting this to the browser would be complex and duplicate logic.

## Risks / Trade-offs

- **Lunar date cell display complexity** → Mitigation: Only display for Vietnam holidays (which carry their original lunar date in metadata). Calendar cells for solar-only channel events omit the lunar footnote.
- **Many events / many channels in global view** → Mitigation: Truncate events per day cell (e.g., max 3 visible, `+N more` overflow badge). Full list visible in a day-click popover or the existing channel detail tabs.
- **Performance of `/api/admin/calendar/events`** → Mitigation: The endpoint filters by month/year in JS after fetching all events (SQLite is local; event counts are small). If dataset grows, add a date-range SQL filter later.

## Open Questions

- Should clicking a holiday badge in the Global Calendar navigate to a detail page, or just show a tooltip? → Default: tooltip/popover for simplicity.
- Should the Channel Calendar replace the existing event list or sit above it? → Decision: Sits **above** the existing list. Both are visible in the same tab scroll.
