## Why

The Admin Dashboard currently manages channel events as a plain list inside each channel's detail tab. There is no unified visual calendar view, no display of Vietnam's national/traditional holidays, and no way to see all events across channels in one place — making it hard to spot conflicts, gaps, or upcoming important dates at a glance.

## What Changes

- Add a **Global Calendar page** (new top-level nav tab) that displays Vietnam national and traditional holidays alongside all channel events, navigable by month/year.
- Add a **Channel Calendar view** inside each channel's "Reminders & Events" tab, showing that channel's own events merged with global Vietnam holidays.
- Add a backend API endpoint to serve pre-computed Vietnam holiday occurrences for a given year.
- Add a backend API endpoint to serve all events (across all channels, or scoped to one channel) as calendar-friendly occurrence objects for a given month/year.
- The existing event list (create/edit/delete) remains; the calendar is an additional visual overlay.

## Capabilities

### New Capabilities
- `admin-calendar`: A reusable calendar month-grid UI component and two admin views (Global Calendar page and per-channel Calendar view) that display holidays and events side by side.

### Modified Capabilities
- `web-admin`: New navigation tab for the Global Calendar page, and enhanced Reminders & Events tab in Channel Detail to embed the calendar grid alongside the existing event list.

## Impact

- **Frontend**: New `CalendarView.tsx`, `CalendarMonthGrid.tsx` components in `web/src/components/`. App.tsx gains a top-level page-mode state. `ChannelDetail.tsx` reminders tab gains a calendar sub-view.
- **Backend**: Two new GET endpoints in `src/admin/routes.ts`:
  - `GET /api/admin/holidays?year=YYYY` — pre-computes all Vietnam holiday occurrences using existing `src/holidays/index.ts`.
  - `GET /api/admin/calendar/events?year=YYYY&month=MM[&chatId=xyz]` — returns events with resolved occurrence dates for the given month using existing `src/db/repositories/events.ts`.
- **Dependencies**: No new external dependencies. Uses existing `src/holidays/index.ts`, `src/lunar/index.ts`, and `src/db/repositories/events.ts`.
- **No messaging side-effects**: Calendar is purely a read-only admin visualization; no messages are automatically sent to Zalo channels based on holiday display.
