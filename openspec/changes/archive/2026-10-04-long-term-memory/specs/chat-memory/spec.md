## ADDED Requirements

### Requirement: Active memory injection into system prompt
The system SHALL query all stored facts from the `memories` table for the current `chat_id` and inject them into the system prompt under a dedicated section titled "Things you know about this family:" on every LLM request. The memory prefix SHALL remain stable across requests to maximize LLM prompt caching efficiency.

#### Scenario: Memories loaded into system prompt
- **WHEN** a user message arrives in a chat that has stored memories about family members
- **THEN** all stored memories for that chat are formatted and included in the system prompt before user turns are processed

#### Scenario: Chat with no memories
- **WHEN** a message arrives in a chat with no stored memories
- **THEN** the system prompt is generated without the memories list and conversation proceeds normally
