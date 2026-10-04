## Context

The bot maintains events, lunar calendar dates, and Vietnamese public holidays in SQLite. Phase 4 introduces:
1. Multi-channel family group support via `FAMILY_CHAT_IDS` (comma-separated list).
2. Proactive scheduled messaging:
   - Daily morning briefing at 07:00 (`Asia/Ho_Chi_Minh`).
   - Sunday weekly outlook at 20:00 (`Asia/Ho_Chi_Minh`).
   - Event reminders at 08:00 (`Asia/Ho_Chi_Minh`) for day-of and advance thresholds (`remind_days_before`).
3. Friendly onboarding: when an unlisted group addresses the bot, the bot replies with an onboarding message displaying that group's `<chat_id>`.
4. Open chat when unconfigured: when `FAMILY_CHAT_IDS` is empty, the bot responds conversationally to any channel where it is mentioned/chatted with, rather than sending a canned string.

## Goals / Non-Goals

**Goals:**
- Parse `FAMILY_CHAT_IDS` (and `FAMILY_CHAT_ID` fallback) into an array of allowed group/chat IDs.
- If `FAMILY_CHAT_IDS` is empty: process incoming messages conversationally through LLM for any channel if mentioned or in private chat.
- If `FAMILY_CHAT_IDS` is populated and an unlisted group addresses the bot (@mention or direct reply): reply with a clear onboarding message instructing the admin to add `<chat_id>` to `FAMILY_CHAT_IDS`.
- Zero-external-dependency periodic scheduler runner with injectable clock interface (`clock.now()`) for deterministic unit testing in `Asia/Ho_Chi_Minh` timezone.
- Dispatch scheduled messages to each configured channel in `FAMILY_CHAT_IDS` (and event reminders to `event.chat_id`).
- Strictly idempotent reminder delivery via `reminders_sent(event_id, occurrence_date, sent_at)`.
- Support startup catch-up for today's reminders if restarted within 2 hours.

**Non-Goals:**
- Dynamically editing `.env` file from chat (admin updates env in Dokploy / host).

## Decisions

### 1. `FAMILY_CHAT_IDS` Configuration Parsing
- **Choice**: In `src/config.ts`, parse `env.FAMILY_CHAT_IDS ?? env.FAMILY_CHAT_ID`:
  Split on commas, trim whitespace, filter empty strings.
  Result: `familyChatIds: string[]`.
  Expose `familyChatIds` and a helper property/getter `familyChatId` (returning the first element or empty string) for backward compatibility.

### 2. Group Filtering & Onboarding Prompt
- **Choice**: In `src/delivery.ts`:
  - If `config.familyChatIds.length === 0`:
    - All channels allowed! If mentioned/replied to in a group, or in private chat, proceed to LLM conversational pipeline. Log chat ID for discovery.
  - If `config.familyChatIds.length > 0`:
    - If `message.chatType === "GROUP"` and `!config.familyChatIds.includes(message.chatId)`:
      - If mentioned or replied to: send a friendly onboarding reply:
        `"Nhóm này chưa nằm trong danh sách cho phép. Vui lòng thêm chat ID \"${message.chatId}\" vào FAMILY_CHAT_IDS để kích hoạt bot nhé."`
      - If not mentioned: stay completely silent.

### 3. Scheduler Engine & Multi-Channel Delivery
- **Choice**: Zero-dependency periodic interval checking current time in `Asia/Ho_Chi_Minh`.
- **Targeting**:
  - Morning Briefing & Weekly Summary: Iterates over each `chatId` in `familyChatIds`. Fetches that group's upcoming events + Vietnamese holidays. If items exist, sends a consolidated summary to that group.
  - Event Reminders: For each event due today or at advance threshold, sends to `event.chatId` (or the matching family channel) and records in `reminders_sent`.

### 4. Idempotency via `reminders_sent`
- **Choice**: Checks `(event_id, occurrenceDateStr)` in `reminders_sent`. Inserts upon delivery.
- **Startup Catch-up**: If current time is 07:00–09:00 or 08:00–10:00, evaluates today's jobs and dispatches unsent alerts.

### 5. Lifecycle Management
- Start scheduler on `startServer()` and stop gracefully on server shutdown.

## Risks / Trade-offs

- **[Risk] Bot spamming unlisted groups.**
  - *Mitigation*: The onboarding message is ONLY sent if someone explicitly mentions or replies to the bot in that unlisted group. Normal chitchat is completely ignored.
