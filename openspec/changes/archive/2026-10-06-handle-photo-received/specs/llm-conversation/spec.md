## ADDED Requirements

### Requirement: Multimodal vision processing for photo messages
The system SHALL support processing incoming photo messages with vision-capable LLM models. When Gemini (`@ai-sdk/google`) is configured and an incoming message contains a photo URL, the system SHALL construct multimodal user content including the image and caption. When a text-only provider (e.g. DeepSeek) is configured, the system SHALL include an image description wrapper in the text prompt and proceed with generation without failing. In canned mode without LLM, the system SHALL reply with the standard canned reply. The system SHALL store the photo message in message history with a visual reference tag.

#### Scenario: Photo analysis with Gemini
- **WHEN** a user sends a photo with or without caption and Gemini is the active LLM provider
- **THEN** the model receives the image content along with user caption and responds grounded in both the image and conversational context

#### Scenario: Photo message with text-only provider
- **WHEN** a user sends a photo with a caption and DeepSeek is the active LLM provider
- **THEN** the system forwards the caption and an indication of the attached photo without throwing an error

#### Scenario: Photo message stored in conversation history
- **WHEN** an incoming photo message is processed
- **THEN** the message repository stores the user entry with caption and photo reference so future conversation turns retain context
