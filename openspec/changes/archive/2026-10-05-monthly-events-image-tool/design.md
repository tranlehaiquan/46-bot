## Context

The 46-bot manages family events, reminders, birthdays, and giỗ (death anniversaries) with support for both solar (dương lịch) and lunar (âm lịch) calendars. While the LLM can list upcoming events in text format via `event_list_upcoming`, users frequently want a graphical calendar view that they can easily review or save in their Zalo chat.

Chat members have diverse needs:
- Looking at what is happening this week or next week (`scope: "week"`).
- Looking at a full month overview (`scope: "month"`).
- Looking at major birthdays, anniversaries, and giỗ for the entire year (`scope: "year"`).

The bot backend uses Fastify for HTTP handling and `zalo-bot-js` for bot communication. `zalo-bot-js` provides `sendPhoto(chatId, caption, photoUrl)`, but `ZaloClient` in `apps/backend/src/zalo-client.ts` currently only exposes `sendMessage` and `sendChatAction`.

## Goals / Non-Goals

**Goals:**
- Provide `getEventsForRange(chatId, startDate, endDate)` in `EventsRepository` and scope helpers (`getEventsForWeek`, `getEventsForMonth`, `getEventsForYear`) to calculate all occurrences (solar, lunar, recurring) occurring in any specified timeframe.
- Implement an image generation module that renders aesthetically pleasing graphic overviews in PNG format for three distinct layout modes:
  - **Week**: 7-day card breakdown showing days of the week, solar and lunar dates, and daily events.
  - **Month**: Monthly calendar / chronological agenda showing dates, lunar days, and event category badges.
  - **Year**: 12-month summary highlighting key birthdays, giỗ, and milestones.
- Serve generated images statically via Fastify using the existing HTTPS public origin from `config.webhookUrl`.
- Extend `ZaloClient` to support `sendPhoto(chatId, caption, photoUrl)`.
- Expose a unified LLM tool `event_send_image` that accepts `scope` ('week' | 'month' | 'year'), reference `date`, `month`, and `year`, generates the image, delivers it directly to the chat channel via Zalo photo messaging, and informs the LLM.

**Non-Goals:**
- Heavy headless browser rendering (Puppeteer/Chromium).
- Third-party image hosting integrations (e.g. AWS S3, Cloudinary). Images are served directly from the bot's Fastify instance.
- Direct interactive calendar editing inside the image.

## Decisions

### Decision 1: Image Rendering Engine (SVG + Sharp)
- **Choice**: Generate responsive, structured SVG graphics tailored to the requested scope (`week`, `month`, `year`) and rasterize them to PNG using `sharp`.
- **Rationale**: `sharp` is fast, lightweight, provides prebuilt native binaries across macOS and Linux/Docker, has minimal memory footprint, and renders vector SVG with crisp typography and Vietnamese diacritics without needing a 300MB headless Chromium runtime.
- **Alternatives Considered**:
  - *Puppeteer/Playwright*: High overhead, high RAM consumption, slow startup.
  - *Pure HTML-canvas*: Requires system libcairo/pango compilation dependencies which complicate Docker builds.
  - *Ascii art*: Poor visual appeal on mobile devices.

### Decision 2: Image Delivery via Existing Webhook Host
- **Choice**: Fastify serves generated images under `/images/events/:filename` (stored in a configured temp or data directory). The public image URL is constructed from `new URL(config.webhookUrl).origin + "/images/events/" + filename`.
- **Rationale**: `config.webhookUrl` is already required to be a valid public HTTPS URL for the Zalo bot. Reusing this origin avoids requiring external blob storage or complex upload credentials.
- **Alternatives Considered**:
  - *Direct multipart file upload to Zalo*: `zalo-bot-js` `sendPhoto` and `uploadFile` take a `photo` or `file_url` pointing to an HTTP/HTTPS URL. Serving from Fastify fulfills this directly.

### Decision 3: Flexible Timeframe Resolution in `EventsRepository`
- **Choice**: Implement `getEventsForRange(chatId, startDate, endDate)` in `EventsRepository`.
  - Computes `[startUtc7, endUtc7]`.
  - For each event in the chat:
    - If recurrence is `none`:
      - If it has a year: evaluate date `(event.year, event.month, event.day)`. For lunar, convert via `lunarToSolar`. Check if within range.
      - If it has no year: check if occurrence in any year covered by the range falls between `startDate` and `endDate`.
    - If recurrence is `yearly`:
      - For solar: check `(targetYear, event.month, event.day)`.
      - For lunar: convert lunar date to solar date for each year spanned by the range.
    - If recurrence is `monthly`: check `event.day` for each month in the range.
    - If recurrence is `weekly`: compute all weekday occurrences within the range.
    - If recurrence is `daily`: occurs every day within the range.
  - Provide helpers:
    - `getEventsForWeek(chatId, referenceDate)` (Monday to Sunday)
    - `getEventsForMonth(chatId, year, month)` (1st to last day of month)
    - `getEventsForYear(chatId, year)` (Jan 1 to Dec 31)

### Decision 4: Tool Design & Parameter Handling
- **Choice**: `event_send_image` tool schema:
  - `scope`: enum `["week", "month", "year"]`, optional (default: `"month"`).
  - `date`: string (ISO `YYYY-MM-DD`), optional (reference date for week or relative query).
  - `month`: integer 1-12, optional (defaults to current month in UTC+7).
  - `year`: integer, optional (defaults to current year in UTC+7).
  - `caption`: string, optional (custom caption or default friendly message).
- **Execution**: The tool resolves occurrences for the selected timeframe, generates the corresponding graphic layout, saves the file to disk/cache, calls `zalo.sendPhoto`, and returns a JSON payload detailing the timeframe, count of events, and delivery status.

## Risks / Trade-offs

- **[Risk: Local development without public HTTPS]** → In unit tests and local dev environments where `webhookUrl` is localhost or mock, `zalo.sendPhoto` will be stubbed or mocked, and image generation will still produce and save the PNG file correctly.
- **[Risk: Year overview density with many events]** → Mitigation: In the yearly layout, group by month and display top/recurring highlights with a count badge if any month exceeds display limits.
- **[Risk: Font rendering for Vietnamese characters]** → Mitigation: Use standard system fonts (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`) with fallback fonts in the SVG style definitions.
