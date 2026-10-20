# ai-image-generation Specification

## Purpose
Provide an automated AI image generation tool powered by Google Gemini Imagen models, enabling the chatbot to generate pictures on demand based on user text requests in family chats, upload them to Zipline image storage, and send them directly to the conversation.

## Requirements

### Requirement: AI image generation tool registration
The system SHALL register an `image_generate` tool available to the LLM agent during conversation handling. The tool SHALL accept a descriptive prompt (in Vietnamese or English) and an optional aspect ratio (`1:1`, `3:4`, `4:3`, `9:16`, `16:9`).

#### Scenario: Tool availability in LLM context
- **WHEN** the chatbot processes a message where the user requests creating, drawing, or generating an image
- **THEN** the system includes the `image_generate` tool in the LLM toolset with clear parameters and descriptions

#### Scenario: LLM invokes image_generate tool
- **WHEN** the LLM calls `image_generate` with `{ "prompt": "Một chú mèo con đang ngủ trên ghế sofa" }`
- **THEN** the system executes the image generation handler with the specified prompt

### Requirement: Image generation via Google Imagen model
The system SHALL generate images using Google's Generative AI image model (configured by `GEMINI_IMAGE_MODEL`, defaulting to `imagen-3.0-generate-002`) using the active `GEMINI_API_KEY`.

#### Scenario: Successful image synthesis
- **WHEN** `image_generate` is called with a valid prompt and a valid Gemini API key is configured
- **THEN** the system invokes Google Generative AI ImageModel and receives the generated image binary buffer

#### Scenario: Image generation failure handling
- **WHEN** the Gemini API returns an error or rate limit during image generation
- **THEN** the tool returns a user-friendly error message indicating that image generation failed, without crashing the conversation handler

### Requirement: Zipline upload and Zalo dispatch
The system SHALL upload the generated image binary to the configured Zipline storage service to obtain a public URL, and then send the photo directly to the conversation chat via `zalo.sendPhoto`.

#### Scenario: Successful upload and photo dispatch
- **WHEN** the image is synthesized and Zipline storage is configured
- **THEN** the system uploads the image to Zipline, calls `zalo.sendPhoto(chatId, photoUrl, caption)`, and returns a confirmation message to the LLM

#### Scenario: Missing Zipline configuration
- **WHEN** the image is synthesized but Zipline URL or API token is not configured
- **THEN** the tool returns an informative message indicating that image storage (Zipline) must be configured in Admin Settings to deliver photos to Zalo

### Requirement: System prompt guidance for image generation
The system prompt SHALL instruct the chatbot on its capability to generate images, directing it to call `image_generate` whenever the user asks to draw, paint, create, or generate a picture or image.

#### Scenario: User asks to draw a picture
- **WHEN** a user asks "vẽ cho mình bức tranh hoàng hôn trên biển"
- **THEN** the system prompt guides the LLM to call `image_generate` with an appropriate English or Vietnamese prompt rather than declining or stating it cannot create images
