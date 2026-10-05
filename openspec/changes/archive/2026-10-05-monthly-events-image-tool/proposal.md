## Why

Users currently receive text lists of upcoming events and reminders, which can be hard to digest at a glance in busy family group chats. Group members frequently want an overview of events, birthdays, giỗ (death anniversaries), and appointments for a specific **week, month, or entire year** presented as a visually appealing, easily shareable image.

Adding a multi-scope event image generation tool enables the LLM assistant to proactively or on-demand create a formatted summary graphic (weekly, monthly, or yearly) and deliver it directly to the group chat channel.

## What Changes

- Add a flexible range/period event occurrence query to `EventsRepository` (`getEventsForRange` and helper scopes `getEventsForWeek`, `getEventsForMonth`, `getEventsForYear`) that resolves all solar and lunar events, including recurrences, falling within the specified timeframe.
- Add an image generation module capable of rendering week, month, and year layouts (Vietnamese typography, solar/lunar dates, event types, category badges).
- Extend `ZaloClient` and `Fastify` server to host generated images and support photo delivery via `sendPhoto` with public image URLs.
- Provide a unified LLM tool `event_send_image` allowing users to ask the bot to create and send an event summary image for a specific week, month, or year.

## Capabilities

### New Capabilities
- `event-schedule-image`: Generates an attractive graphic image of events, reminders, birthdays, and giỗ for a specified timeframe (week, month, or year), and delivers the photo directly to the target chat channel via Zalo photo delivery.

### Modified Capabilities
- `events-reminders`: Adds range-scoped event occurrence queries and exposes the `event_send_image` tool to the LLM agent.

## Impact

- **Backend**:
  - `apps/backend/src/tools/events.ts`: Expose `event_send_image` tool supporting `scope` ('week' | 'month' | 'year'), `month`, `year`, and reference `date`.
  - `apps/backend/src/db/repositories/events.ts`: Add `getEventsForRange(chatId, startDate, endDate)` (and helpers for week, month, year) resolving all recurring and one-off solar/lunar events.
  - `apps/backend/src/zalo-client.ts`: Expose `sendPhoto(chatId, caption, photoUrl)`.
  - `apps/backend/src/delivery.ts`: Provide `sendPhoto` and public URL capabilities to event tools.
  - `apps/backend/src/server.ts`: Serve generated images publicly for Zalo media ingestion.
- **Dependencies**: Image rendering dependency (`sharp` for SVG to PNG rasterization).
