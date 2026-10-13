## ADDED Requirements

### Requirement: Unified memory search integration
The system SHALL include `memory_search` in the registered tools returned by `createMemoryTools`, providing a single multi-source search interface alongside the existing individual memory tools.

#### Scenario: Agent tool availability
- **WHEN** `createMemoryTools` is initialized with repository and chat context
- **THEN** the returned tool set contains `memory_search` along with `remember`, `forget`, `list_memories`, `memory_book_add`, and `memory_book_search`
