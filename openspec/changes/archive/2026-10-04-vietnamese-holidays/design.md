## Context

Vietnam has a combination of official public holidays where workers are legally entitled to paid time off (theo Điều 112 Bộ luật Lao động 2019) and traditional lunar cultural festivals that are deeply observed by Vietnamese families. The events system previously introduced supports both solar and lunar recurring events, but currently requires users to manually enter every holiday.

This design introduces a standardized holiday catalog in `src/holidays/index.ts`, a holiday occurrence calculation engine, and LLM tools to list upcoming holidays or import them into the chat's event schedule.

## Goals / Non-Goals

**Goals:**
- Provide a typed, deterministic catalog of official Vietnamese public paid holidays and traditional cultural festivals.
- Calculate upcoming solar occurrences accurately for both solar and lunar holidays (reusing the Ho Ngoc Duc UTC+7 lunar engine in `src/lunar/index.ts`).
- Expose `holiday_list_upcoming` tool with filtering for official days off (`publicOnly`).
- Expose `holiday_import` tool to batch-import official public holidays into the chat's `events` repository idempotently (no duplicate titles).
- Enhance the bot persona to answer questions about holidays and public days off naturally in plain text.

**Non-Goals:**
- Changing labor law regulations dynamically via external scraper.
- Auto-scheduling government-declared compensatory bridge days (ngày nghỉ bù/hoán đổi ngày làm việc) which are announced yearly by the Prime Minister (can be handled via regular `event_add`).

## Decisions

### Decision 1: Structured Holiday Catalog
Define `VIETNAMESE_HOLIDAYS` in `src/holidays/index.ts`:
```ts
export type HolidayDefinition = {
  id: string;
  name: string;
  calendar: 'solar' | 'lunar';
  day: number;
  month: number;
  daysOfLeave?: number;
  isPublicHoliday: boolean; // true if worker has paid day off by law
  description?: string;
};
```
Official public holidays (Điều 112 BLLĐ 2019):
- Tết Dương lịch (1/1) - 1 ngày
- Tết Âm lịch / Tết Nguyên Đán (1/1 âm lịch, tính từ 29/30 tháng Chạp) - 5 ngày
- Giỗ Tổ Hùng Vương (10/3 âm lịch) - 1 ngày
- Ngày Chiến thắng (30/4) - 1 ngày
- Ngày Quốc tế Lao động (1/5) - 1 ngày
- Quốc khánh (2/9) - 2 ngày

Traditional festivals:
- Ông Táo chầu trời (23/12 âm lịch)
- Tết Nguyên Tiêu / Rằm tháng Giêng (15/1 âm lịch)
- Tết Đoan Ngọ (5/5 âm lịch)
- Lễ Vu Lan / Rằm tháng Bảy (15/7 âm lịch)
- Tết Trung Thu (15/8 âm lịch)

### Decision 2: Occurrence Resolution
Reuses `lunarToSolar` from `src/lunar/index.ts` to convert lunar festival dates to their upcoming solar equivalents. For any reference date `refDate`, the engine computes `occurrenceDate`, `occurrenceDateStr`, and `daysRemaining >= 0`.

### Decision 3: Idempotent Holiday Import
When the user asks to import or save holidays into the chat's schedule, `holiday_import`:
- Checks existing events in the chat via `eventsRepo.getEventsByChat(chatId)`.
- Only creates events that do not already exist (matched by title/name).
- Sets `kind: 'event'`, recurrence: `'yearly'`, and appropriate solar/lunar calendar attributes.

## Risks / Trade-offs

- **[Risk]** Variable government bridge days (hoán đổi ngày làm việc): The Government often issues specific directives for compensatory long weekends.
  → **Mitigation**: Mark standard statutory days off clearly, and explain in the system prompt that specific government swap holidays can be scheduled as one-off custom reminders.
