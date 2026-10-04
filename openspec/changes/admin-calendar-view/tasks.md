## 1. Backend: Calendar API Endpoints

- [x] 1.1 Add `GET /api/admin/holidays?year=YYYY` route in `src/admin/routes.ts` that calls `getUpcomingHolidays({ windowDays: 400, referenceDate: Jan 1 of requested year })` and returns the full holiday array
- [x] 1.2 Add `GET /api/admin/calendar/events?year=YYYY&month=MM[&chatId=xyz]` route in `src/admin/routes.ts` that fetches all events (or filtered by chatId), runs `getNextOccurrence()` for each, filters to those whose occurrence falls in the requested month, and returns occurrence-resolved objects including `channelName` from `channelRepo`
- [x] 1.3 Add `getHolidays` and `getCalendarEvents` methods to `web/src/api.ts` client

## 2. Frontend: Shared CalendarMonthGrid Component

- [x] 2.1 Create `web/src/components/CalendarMonthGrid.tsx` — pure component accepting `year`, `month`, `holidays[]`, `events[]`, `showChannelLabels` props; renders a 7-column month grid with today highlighted
- [x] 2.2 Implement day cell rendering: solar date number (large), lunar date footnote for holiday cells (small, muted), event/holiday badge chips truncated at 3 with `+N more` overflow
- [x] 2.3 Implement month navigation controls (prev/next arrows, current month label) as part of the component or as a sibling `CalendarNav` component
- [x] 2.4 Style holiday badges: red/amber for statutory public holidays (`isPublicHoliday: true`), purple/rose for cultural observances — using CSS variables from `index.css`
- [x] 2.5 Style channel event badges: distinct chip style with channel name label when `showChannelLabels` is true

## 3. Frontend: Global Calendar Page

- [x] 3.1 Create `web/src/components/CalendarPage.tsx` — full-page Global Calendar view that fetches holidays and all-channel events, renders `CalendarMonthGrid`, and includes filter bar (channel dropdown + holiday toggle)
- [x] 3.2 Add `page: "channels" | "calendar"` state to `App.tsx` and pass `onNavigate` prop to `Navbar`
- [x] 3.3 Update `App.tsx` to conditionally render `<CalendarPage />` vs the existing channels grid based on `page` state
- [x] 3.4 Update `Navbar.tsx` to add a "📅 Calendar" tab button that calls `onNavigate("calendar")`, and a "💬 Channels" tab that calls `onNavigate("channels")`, with active tab styling

## 4. Frontend: Channel Calendar View

- [x] 4.1 Add calendar state (`calYear`, `calMonth`) to `ChannelDetail.tsx` reminders tab section
- [x] 4.2 Fetch holidays (via `api.getHolidays`) and channel events for the current calendar month (via `api.getCalendarEvents(chatId, year, month)`) when the reminders tab is active or calendar month changes
- [x] 4.3 Render `<CalendarMonthGrid>` above the existing flat event list inside the reminders tab, with `showChannelLabels={false}`

## 5. API Client Types

- [x] 5.1 Add `HolidayOccurrence` type to `web/src/api.ts` matching the holidays endpoint response shape
- [x] 5.2 Add `CalendarEventOccurrence` type to `web/src/api.ts` matching the calendar events endpoint response shape

## 6. Verification

- [x] 6.1 Verify `GET /api/admin/holidays?year=2026` returns correct occurrence dates for both solar (01/01) and lunar (Tết Nguyên Đán) holidays
- [x] 6.2 Verify `GET /api/admin/calendar/events?year=2026&month=10` returns events from all channels with computed `occurrenceDateStr` within October 2026
- [x] 6.3 Verify Global Calendar page renders correctly, navigating months updates event and holiday badges
- [x] 6.4 Verify Channel Detail reminders tab shows the calendar grid above the event list for the selected channel
- [x] 6.5 Verify channel filter dropdown on Global Calendar page correctly filters channel events while keeping Vietnam holidays visible
