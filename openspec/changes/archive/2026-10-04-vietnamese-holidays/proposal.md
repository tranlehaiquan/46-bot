## Why

Family members often need to know when upcoming Vietnamese public paid holidays (ngày lễ, ngày nghỉ theo luật lao động) and major traditional festivals are approaching, plan family trips, gatherings, and time off work or school without having to look up calendar tables manually. Providing standard holiday definitions with automatic lunar-to-solar date resolution and tools to query or import holidays directly into the family event schedule makes holiday planning effortless.

## What Changes

- Add a comprehensive Vietnamese holiday definitions module (`src/holidays/index.ts`) cataloging:
  - Official public paid holidays per Vietnamese Labor Law (Điều 112 Bộ luật Lao động): Tết Dương lịch (1/1), Tết Nguyên Đán (từ 29/30 tháng Chạp đến mùng 4 hoặc 5 tháng Giêng), Giỗ Tổ Hùng Vương (10/3 âm lịch), Ngày Chiến thắng (30/4), Quốc tế Lao động (1/5), Quốc khánh (2/9).
  - Traditional Vietnamese lunar cultural festivals: Ông Táo chầu trời (23 tháng Chạp), Tết Nguyên Tiêu (15 tháng Giêng), Tết Đoan Ngọ (5/5 âm lịch), Lễ Vu Lan (15/7 âm lịch), Tết Trung Thu (15/8 âm lịch).
- Provide functions to calculate the upcoming solar occurrences of holidays for any given reference date and time window using the Vietnamese lunar engine.
- Expose LLM tools:
  - `holiday_list_upcoming`: Query upcoming Vietnamese holidays and days off within a time window (e.g. 30, 90, or 365 days).
  - `holiday_import`: Populate/sync official holidays into the current chat's events repository so they appear in regular family event listings and reminders.
- Wire holiday tools into `delivery.ts` and update LLM persona instructions to recognize requests about Vietnamese holidays and public days off.

## Capabilities

### New Capabilities
- `vietnamese-holidays`: Deterministic catalog and occurrence calculator for Vietnamese official public paid holidays and traditional festivals, with LLM tools to list and import holidays into family chat schedules.

### Modified Capabilities
<!-- None -->

## Impact

- Runtime: New tools `holiday_list_upcoming` and `holiday_import` available to the LLM agent during message delivery.
- Database: Can optionally insert events into the existing `events` table when importing holidays.
- LLM Persona: Instructs the bot to answer questions about Vietnamese holidays, days off, and holiday schedules accurately.
