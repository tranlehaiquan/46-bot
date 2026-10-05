# Tasks

## 1. Lookup persistence

- [ ] 1.1 Add `scheduled_lookups` and `scheduled_lookup_runs` to `src/db/migrations.ts` and verify a migrated in-memory database accepts a lookup row and rejects a second run row for the same lookup and `fire_date`.
- [ ] 1.2 Add a lookup repository with create, list, update, cancel, due-query, and run-claim methods, and verify repository tests cover daily, weekly, and monthly matching, the February day-31 clamp, a unique claim, attempt counting, and reclaiming a `running` row older than 10 minutes.

## 2. Scheduler execution

- [ ] 2.1 Run due lookups from `src/scheduler/index.ts` with an injectable clock, and verify scheduler tests send one plain-text message on the fire day, send it again on a later same-day tick after a restart, and do not send a second message after `sent`.
- [ ] 2.2 Call the model with only `weather_check`, `web_search`, and `holiday_list_upcoming`, no chat history, and the saved instruction wrapped as user data, and verify a scheduler test asserts that tool set and the delimited instruction.
- [ ] 2.3 Skip `pending` and `disabled` channels without inserting a run, and verify a scheduler test delivers that same occurrence once the channel is `active` later that local day.
- [ ] 2.4 Retry a failed run up to 3 times on the same local day, then store `failed` and the error without calling `sendMessage`, and verify the scheduler test covers both the retry and the silent final failure.
- [ ] 2.5 Pass the lookup repository, channel repository, and LLM client into `startScheduler` from `src/index.ts`, and verify the existing morning-briefing, weekly-outlook, and event-reminder scheduler tests still pass unchanged.

## 3. Conversation tools

- [ ] 3.1 Add `lookup_schedule_create`, `lookup_schedule_list`, `lookup_schedule_update`, and `lookup_schedule_cancel` bound to the current chat, and verify tool tests reject a missing clock time, missing weekday, missing day-of-month, and a prompt-injection instruction, and that a morning request with no clock time saves 07:00.
- [ ] 3.2 Register those tools in `src/delivery.ts` and point `DEFAULT_SYSTEM_PROMPT` at them for internet lookups while leaving calendar requests on `event_add`, and verify `src/llm/client.test.ts` asserts the prompt names the lookup tools and a unit test shows an active chat receives those four tools.
- [ ] 3.3 Document the four tools in `readme.md` and verify the tools table names them and describes a daily internet lookup.

## 4. Admin channel controls

- [ ] 4.1 Add authenticated `GET`, `PATCH`, and `DELETE` lookup routes under `/api/admin/channels/:chatId/lookups`, and verify `src/admin/admin-api.test.ts` covers list with a `failed` last run, pause, resume, delete, and HTTP 401 without a session.
- [ ] 4.2 Add a lookups section to the channel detail screen with instruction, schedule, active state, last-run status, pause, resume, and delete, and verify `pnpm --dir web build` succeeds and the section is rendered from the channel detail view.

## 5. Integration

- [ ] 5.1 Run `pnpm test` and `pnpm typecheck` and verify both complete with no failures.
