## MODIFIED Requirements

### Requirement: Conversational Vietnamese generation with Gemini or DeepSeek
The system SHALL use the Vercel AI SDK to prompt the configured LLM provider (Gemini via `@ai-sdk/google` or DeepSeek via `@ai-sdk/deepseek`). The prompt SHALL enforce a warm, informal, family-friendly Vietnamese persona by default (or English if the user writes in English), keeping answers concise and grounded. The prompt construction SHALL enforce strict instruction hierarchy and wrap user turns and memories in structured XML delimiters to isolate untrusted text from system directives.

#### Scenario: General question in Vietnamese
- **WHEN** a family member asks a general question in Vietnamese
- **THEN** the model responds in Vietnamese with a warm, natural, and concise answer enclosed in standard persona guidelines

#### Scenario: Question in English
- **WHEN** a user addresses the bot in English
- **THEN** the model generates the reply in English

#### Scenario: Untrusted content wrapped in delimiters
- **WHEN** user messages and historical context are prepared for the LLM
- **THEN** user inputs are wrapped in `<user_message>` tags and memory facts are wrapped in `<memory_item>` tags

## ADDED Requirements

### Requirement: Prompt security integration in conversational reply pipeline
The system SHALL evaluate incoming conversation messages against prompt security validation before triggering LLM generation. When a security violation or injection attempt is detected, the pipeline SHALL send a safe refusal reply directly and skip LLM generation.

#### Scenario: Security rejection in reply pipeline
- **WHEN** an incoming message to the bot triggers prompt security detection
- **THEN** the system sends the friendly safety refusal without calling the LLM API
