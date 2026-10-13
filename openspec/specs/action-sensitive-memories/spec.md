# action-sensitive-memories Specification

## Purpose
TBD - created by archiving change action-sensitive-memories. Update Purpose after archive.
## Requirements
### Requirement: Action boundary capture and lifecycle tracking
The system SHALL support capturing action boundaries on stored memories:
- `condition`: String describing under what preconditions or approval requirements the memory applies.
- `avoidAction`: String describing specific tempting actions, assumptions, or reminders the bot must avoid.
- `expiresAt`: Millisecond timestamp or ISO date string after which the memory constraint expires.

#### Scenario: Storing a memory with avoid-action and condition
- **WHEN** a family member says "Bố dạo này đau lưng, tạm thời đừng nhắc bố chạy bộ hay tập gym nặng nhé"
- **THEN** the bot executes `remember` with subject "Bố", fact "Dạo này bị đau lưng", avoidAction "Không nhắc bố chạy bộ hay tập gym nặng", and condition "Đến khi đỡ đau lưng"

#### Scenario: Storing a memory with expiry date
- **WHEN** a family member says "Mẹ đi công tác Đà Nẵng từ nay đến hết 20/10"
- **THEN** the bot records the memory with an `expiresAt` timestamp corresponding to 2026-10-20T23:59:59

### Requirement: Automatic expiry filtering from active prompt injection
The system SHALL automatically exclude any memory record whose `expiresAt` is in the past (`expiresAt < Date.now()`) when querying active memories for system prompt budgeting.

#### Scenario: Expired memory omitted from active prompt
- **WHEN** a memory has `expiresAt` timestamp that has already elapsed
- **THEN** `listActiveMemories` excludes it from the active memories returned for system prompt injection

#### Scenario: Unexpired memory included in active prompt
- **WHEN** a memory has `expiresAt` timestamp in the future (or null)
- **THEN** `listActiveMemories` includes it within the active prompt budget

### Requirement: Contextual prompt rendering of action boundaries
When action-sensitive memories with active `avoidAction` or `condition` boundaries are injected into the system prompt, the system SHALL format each entry with explicit cautionary directives.

#### Scenario: Formatted rendering in system prompt
- **WHEN** a memory has subject "Bố", fact "Đau lưng", and avoidAction "Không nhắc tập gym"
- **THEN** it is formatted as "- Bố: Đau lưng (Lưu ý: Không nhắc tập gym)" in the prompt

