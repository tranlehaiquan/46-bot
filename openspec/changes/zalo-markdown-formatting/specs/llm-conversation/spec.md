## MODIFIED Requirements

### Requirement: Conversational Vietnamese generation with Gemini or DeepSeek
The system SHALL use the Vercel AI SDK to prompt the configured LLM provider (Gemini via `@ai-sdk/google` or DeepSeek via `@ai-sdk/deepseek`). The prompt SHALL enforce a warm, informal, family-friendly Vietnamese persona by default (or English if the user writes in English), keeping answers concise and grounded. The prompt construction SHALL enforce strict instruction hierarchy and wrap user turns and memories in structured XML delimiters to isolate untrusted text from system directives. The prompt SHALL instruct the model to use Zalo-compatible Markdown formatting (such as bold, italic, strikethrough, numbered/bulleted lists, and headers) while explicitly prohibiting Markdown tables and Markdown bracketed link syntax (`[text](url)`).

#### Scenario: General question in Vietnamese
- **WHEN** a family member asks a general question in Vietnamese
- **THEN** the model responds in Vietnamese with a warm, natural, and concise answer formatted with Zalo-compatible Markdown

#### Scenario: Question in English
- **WHEN** a user addresses the bot in English
- **THEN** the model generates the reply in English

#### Scenario: Untrusted content wrapped in delimiters
- **WHEN** user messages and historical context are prepared for the LLM
- **THEN** user inputs are wrapped in `<user_message>` tags and memory facts are wrapped in `<memory_item>` tags

#### Scenario: Prohibited Markdown syntax avoided
- **WHEN** the model generates structured information or web links
- **THEN** the model uses lists instead of Markdown tables and writes plain URLs directly without bracketed link syntax

## ADDED Requirements

### Requirement: Outbound delivery with Zalo Markdown and automatic plain-text fallback
The system SHALL deliver conversational responses to Zalo with `parse_mode: 'markdown'`. If Zalo API rejects the message due to parsing or formatting errors, the delivery layer SHALL automatically retry delivering the message as unformatted plain text so that no response is lost.

#### Scenario: Successful Markdown message delivery
- **WHEN** the assistant generates a formatted response with Markdown styling
- **THEN** the message is sent to Zalo with `parse_mode: 'markdown'` and rendered with rich text styling

#### Scenario: Markdown parse error fallback
- **WHEN** Zalo API rejects a message sent with `parse_mode: 'markdown'`
- **THEN** the delivery layer immediately resends the text without `parse_mode`, delivering the unformatted text to the chat
