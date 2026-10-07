# Spec Delta

## Purpose

Enables querying official Vietnamese lottery results (XSMB, XSMN, XSMT, Vietlott) and automatically verifying ticket numbers across all prize tiers with official Vietnamese lottery rules.

## ADDED Requirements

### Requirement: Vietnamese lottery result lookup
The system SHALL provide a tool to query official lottery results for Vietnamese traditional lotteries (Northern XSMB, Central XSMT, Southern XSMN provinces) and Vietlott games for a specified draw date.

#### Scenario: Lookup by province station and date
- **WHEN** a lottery lookup is requested with a valid province station (e.g. 'TP.HCM', 'Bình Dương') and draw date
- **THEN** the system returns structured prize results containing all prize tiers (Giải Đặc Biệt down to lowest tier) for that draw

#### Scenario: Date or station with no results yet
- **WHEN** a lottery lookup is requested for a date or station where results are not yet drawn or available
- **THEN** the system returns a status indicating results are not available yet for that draw date

### Requirement: Automated lottery ticket prize verification
The system SHALL evaluate ticket numbers against official prize results for the specified station and draw date, checking all standard Vietnamese prize tiers including Special Prize, lower tiers, Giải Phụ Đặc Biệt (An Ủi), and Giải Khuyến Khích.

#### Scenario: Winning ticket verification
- **WHEN** a ticket number matches one or more winning prize rules for the specified station and draw date
- **THEN** the system returns the winning status, matching prize tier names, and applicable prize amounts

#### Scenario: Non-winning ticket verification
- **WHEN** a ticket number does not match any winning prize rules for the specified station and draw date
- **THEN** the system returns a status indicating the ticket did not win any prize

### Requirement: Lottery result caching and resilience
The system SHALL cache retrieved lottery results in memory by station and draw date and gracefully handle external network timeouts or failures with appropriate fallback messages.

#### Scenario: Caching repeated requests
- **WHEN** multiple requests query lottery results for the same station and draw date within cache TTL
- **THEN** the system serves subsequent requests from memory without redundant network requests

#### Scenario: Network failure resilience
- **WHEN** external lottery data retrieval fails or times out
- **THEN** the tool returns a clean error response without throwing unhandled exceptions to the conversational pipeline
