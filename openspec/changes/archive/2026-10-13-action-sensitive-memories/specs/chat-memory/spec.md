## ADDED Requirements

### Requirement: Action-sensitive formatting and expiry handling in system prompt
When injecting memories into the system prompt under "Things you know about this family:", any memory whose `expiresAt` timestamp has elapsed SHALL be excluded from prompt context. For active memories containing `condition` or `avoidAction`, the system prompt line SHALL include cautionary notes (e.g., `(Lưu ý: <avoidAction> | Điều kiện: <condition>)`).

#### Scenario: Excluding expired memories from system prompt
- **WHEN** an active memory has an `expiresAt` timestamp in the past
- **THEN** it is filtered out of the memories formatted into the system prompt

#### Scenario: Formatting avoid-action directives in system prompt
- **WHEN** an active memory includes an `avoidAction` string
- **THEN** it is formatted as `- <subject>: <fact> (Lưu ý: <avoidAction>)` in the prompt
