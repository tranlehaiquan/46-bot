## ADDED Requirements

### Requirement: Action boundary parameters in memory tools
The `remember` tool SHALL accept optional `condition`, `avoidAction`, and `expiresAt` parameters. Stored memories SHALL persist these fields in SQLite and expose them in `list_memories` and `memory_search` responses.

#### Scenario: Tool returns action boundaries
- **WHEN** `remember` is called with `condition` and `avoidAction`
- **THEN** the returned confirmation object includes `condition` and `avoidAction` and saves them to the repository
