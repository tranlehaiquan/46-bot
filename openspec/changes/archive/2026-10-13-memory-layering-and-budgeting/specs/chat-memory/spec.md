## MODIFIED Requirements

### Requirement: Active memory injection into system prompt
The system SHALL query active memories from the `memories` table for the current `chat_id`, prioritizing `core` category memories, and inject them into the system prompt under a dedicated section titled "Things you know about this family:" on every LLM request, subject to a configured prompt budget (default maximum of 20 items). Non-core memories exceeding the budget SHALL NOT be injected into the system prompt, but SHALL remain available for on-demand query via memory tools. The memory prefix SHALL remain stable across requests to maximize LLM prompt caching efficiency.

#### Scenario: Core memories loaded within budget
- **WHEN** a user message arrives in a chat that has stored active memories within the budget cap
- **THEN** all active core memories for that chat are formatted and included in the system prompt before user turns are processed

#### Scenario: Memories exceed budget cap
- **WHEN** a chat has 35 stored active memories and the budget cap is 20
- **THEN** only the top 20 prioritized active memories are injected into the system prompt, while remaining memories are excluded from the prompt and remain accessible via memory lookup tools

#### Scenario: Chat with no memories
- **WHEN** a message arrives in a chat with no stored memories
- **THEN** the system prompt is generated without the memories list and conversation proceeds normally
