# event-schedule-image Specification

## Purpose
Provide visual event schedule graphic generation (PNG format) for weekly, monthly, and yearly timeframes, and deliver formatted calendar images directly to group chat channels via Zalo photo messaging.

## Requirements

### Requirement: Multi-Scope Event Graphic Image Generation
The system SHALL generate a clean, visually structured image (PNG format) summarizing scheduled events, reminders, birthdays, giỗ, and appointments for a requested timeframe:
- **Weekly**: A 7-day breakdown (Monday through Sunday) showing daily events with solar and lunar dates.
- **Monthly**: A month overview showing day numbers, day of week, lunar dates, and categorized event badges.
- **Yearly**: A 12-month summary highlighting key birthdays, anniversaries, giỗ, and appointments across the year.

The graphic SHALL include a formatted header (timeframe title and date range), solar and lunar date indications, event titles, and categorical visual badges.

#### Scenario: Successfully generating a weekly event image
- **WHEN** an image is requested with `scope: "week"`
- **THEN** an image is produced containing 7-day columns/rows with events placed on their corresponding occurrence days

#### Scenario: Successfully generating a monthly event image
- **WHEN** an image is requested with `scope: "month"`
- **THEN** an image is produced displaying all events occurring within that month organized chronologically

#### Scenario: Successfully generating a yearly event image
- **WHEN** an image is requested with `scope: "year"`
- **THEN** an image is produced displaying events grouped by month across the entire year

#### Scenario: Generating an image when no events exist in the period
- **WHEN** an image is generated for a week, month, or year with no scheduled events
- **THEN** an image is produced displaying an empty-period message (e.g. "Không có sự kiện nào trong thời gian này") while retaining the header and layout

### Requirement: Image Hosting and Zalo Delivery
The system SHALL upload the rendered calendar image buffer to the external Zipline image storage service to obtain a public URL, and send it as a photo message to the originating chat channel using `ZaloClient.sendPhoto(chatId, caption, photoUrl)`. The system SHALL NOT host or serve static event images from the bot's local HTTP web server.

#### Scenario: Delivering photo to group channel
- **WHEN** `event_send_image` completes image rendering and uploads the buffer to Zipline
- **THEN** the bot receives a public Zipline image URL, calls `sendPhoto` with the public image URL and a friendly caption to the chat ID, and returns a success payload to the LLM

#### Scenario: Image delivery when Zipline upload fails
- **WHEN** Zipline is unconfigured or image upload fails
- **THEN** `event_send_image` returns an informative error message indicating image storage failure without crashing the conversation
