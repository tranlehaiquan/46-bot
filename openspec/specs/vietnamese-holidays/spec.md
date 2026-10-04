# vietnamese-holidays Specification

## Purpose
TBD - created by archiving change vietnamese-holidays. Update Purpose after archive.
## Requirements
### Requirement: Vietnamese Holiday Definitions Catalog
The system SHALL define standard Vietnamese holidays, categorizing them into official public paid holidays (theo Điều 112 Bộ luật Lao động) and traditional cultural festivals. Each holiday definition SHALL specify its key, localized title, calendar type ('solar' | 'lunar'), day, month, duration/days of leave where applicable, and whether it is a legally mandated public holiday with paid time off.

#### Scenario: Querying official public paid holidays
- **WHEN** official public holidays are requested
- **THEN** the system returns Tết Dương lịch (1/1 dương lịch), Tết Âm lịch (từ 29/30 tháng Chạp đến mùng 4/5 tháng Giêng), Giỗ Tổ Hùng Vương (10/3 âm lịch), Ngày Chiến thắng (30/4 dương lịch), Ngày Quốc tế lao động (1/5 dương lịch), and Quốc khánh (2/9 dương lịch) with isPublicHoliday set to true

#### Scenario: Querying traditional lunar festivals
- **WHEN** traditional cultural festivals are requested
- **THEN** the system returns Ông Táo chầu trời (23 tháng Chạp), Tết Nguyên Tiêu (15 tháng Giêng), Tết Đoan Ngọ (5/5 âm lịch), Lễ Vu Lan (15/7 âm lịch), and Tết Trung Thu (15/8 âm lịch)

### Requirement: Upcoming Holiday Occurrence Calculation
The system SHALL compute the upcoming solar dates, day of week, and days remaining for each holiday relative to a reference date and within a specified day window (e.g. 30, 90, or 365 days), converting lunar holidays to accurate solar dates using the Vietnamese lunar engine.

#### Scenario: Calculating upcoming Giỗ Tổ Hùng Vương
- **WHEN** upcoming holidays are calculated for the current solar year
- **THEN** the system converts 10/3 âm lịch into the corresponding Gregorian solar date in UTC+7 and reports the exact remaining days

#### Scenario: Year rollover for Tết Nguyên Đán
- **WHEN** Tết Nguyên Đán has passed in the current Gregorian year
- **THEN** the system resolves the next occurrence to the upcoming lunar new year's solar date and calculates the remaining days

### Requirement: Holiday LLM Tools
The system SHALL expose two tools to the LLM: `holiday_list_upcoming` to list upcoming holidays (with an option to filter for official days off only), and `holiday_import` to batch-insert official holidays into the chat's event schedule.

#### Scenario: Asking about upcoming holidays
- **WHEN** the user asks what holidays or days off are coming up
- **THEN** the LLM invokes `holiday_list_upcoming` and presents upcoming dates clearly in plain text with both solar and lunar information

#### Scenario: Importing holidays into the chat schedule
- **WHEN** the user asks to add or sync Vietnamese public holidays into the group calendar
- **THEN** the LLM invokes `holiday_import`, inserting the public holidays into the chat's events repository without duplicating existing entries

