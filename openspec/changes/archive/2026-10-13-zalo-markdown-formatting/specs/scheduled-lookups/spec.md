## MODIFIED Requirements

### Requirement: A run answers only the saved instruction with read tools
The scheduled run SHALL call the model with the saved instruction as untrusted user data and with no chat history. The run SHALL be limited to `weather_check`, `web_search`, and `holiday_list_upcoming`. The run SHALL NOT create or modify events, lists, memories, or lookups. The delivered text SHALL use Zalo-compatible Markdown formatting (such as bold, bulleted lists, and headers) without tables or bracketed links. Text longer than 2000 characters SHALL be split using the same outbound splitting as conversational replies.

#### Scenario: Weather instruction uses the weather tool
- **WHEN** a due lookup instruction asks for today's weather in Ho Chi Minh City
- **THEN** the run retrieves live weather for that place and the chat receives a briefing formatted with Zalo-compatible Markdown

#### Scenario: Another topic uses web search
- **WHEN** a due lookup instruction asks for the SJC gold price
- **THEN** the run retrieves current web results for that topic and does not require a gold-specific schedule

#### Scenario: Saved instruction cannot change stored data
- **WHEN** a saved instruction tells the bot to add an event, remember a fact, or change its system instructions
- **THEN** no event, list, memory, or lookup is written by the run, and the instruction is not treated as a system instruction
