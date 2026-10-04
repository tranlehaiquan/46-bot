## 1. Multi-Channel Configuration & Delivery Filtering

- [x] 1.1 Update `src/config.ts` to parse `FAMILY_CHAT_IDS` (comma-separated, with backward compatibility for `FAMILY_CHAT_ID`) into `familyChatIds: string[]`.
- [x] 1.2 Update `src/delivery.ts`: when `familyChatIds` is empty, log delivery and generate conversational LLM reply for any channel if mentioned or in DM.
- [x] 1.3 Update `src/delivery.ts`: when `familyChatIds` is configured and an unlisted group addresses the bot, reply with onboarding message containing `<chat_id>`.
- [x] 1.4 Update `src/config.test.ts` and `src/server.test.ts` for multi-channel allowlist and unlisted group onboarding.

## 2. Database & Reminder Repository Enhancements

- [x] 2.1 Add `isReminderSent` and `recordReminderSent` helper methods to `src/db/repositories/events.ts` interacting with `reminders_sent`.
- [x] 2.2 Add query helper to find events due for reminders (day-of or advance `remind_days_before`) for a given reference date.
- [x] 2.3 Unit test reminder tracking and query methods in `src/db/repositories/events.test.ts`.

## 3. Notification Message Formatters

- [x] 3.1 Implement morning briefing formatter in `src/scheduler/formatters.ts` consolidating today's events, Vietnamese holidays, and 7-day milestones.
- [x] 3.2 Implement weekly summary formatter in `src/scheduler/formatters.ts` for Sunday evening outlook.
- [x] 3.3 Implement targeted event reminder formatter in `src/scheduler/formatters.ts` for day-of and advance alerts.
- [x] 3.4 Unit test message formatters in `src/scheduler/formatters.test.ts`.

## 4. Background Scheduler Engine & Jobs

- [x] 4.1 Implement scheduler engine in `src/scheduler/index.ts` with injectable clock and `Asia/Ho_Chi_Minh` time resolution.
- [x] 4.2 Implement job dispatching to each configured channel in `familyChatIds` (and `event.chatId` for events) with idempotency check.
- [x] 4.3 Implement startup catch-up for today's reminders missed within the previous 2 hours.
- [x] 4.4 Integrate scheduler startup and shutdown into the Fastify server lifecycle in `src/server.ts` / `src/index.ts`.

## 5. Testing & Verification

- [x] 5.1 Test scheduler time triggers with fake clock (07:00 morning briefing, Sunday 20:00 weekly outlook, 08:00 reminders).
- [x] 5.2 Test multi-channel delivery: verify messages are delivered to each allowed channel.
- [x] 5.3 Test idempotency: verify restarts and re-runs do not duplicate sends recorded in `reminders_sent`.
- [x] 5.4 Run full test suite and TypeScript verification to ensure zero regressions.
