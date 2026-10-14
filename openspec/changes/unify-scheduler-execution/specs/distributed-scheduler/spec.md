## ADDED Requirements

### Requirement: Unified task execution pipeline
The system SHALL execute background scheduler tasks (morning briefings, weekly outlooks, event reminders, and scheduled lookups) through a unified task execution module shared by both the in-memory timer runner and distributed BullMQ workers. Both runners SHALL provide identical tool sets, system prompt formatting, text chunking, and error recording.

#### Scenario: Scheduled lookup execution parity
- **WHEN** a scheduled lookup is triggered by either the in-process timer runner or a BullMQ queue worker
- **THEN** both runners invoke the shared lookup execution service with identical tool factories (weather, holidays, Tavily web search, Crawl4AI), prompt injection validation, and Zalo Markdown chunked delivery

#### Scenario: Notification compilation and delivery parity
- **WHEN** morning briefings, weekly outlooks, or event reminders are processed
- **THEN** both runners execute identical data gathering, formatting, deduplication checks, and Zalo dispatch logic via shared execution functions
