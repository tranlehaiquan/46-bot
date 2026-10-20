## MODIFIED Requirements

### Requirement: Image Hosting and Zalo Delivery
The system SHALL upload the rendered calendar image buffer to the external Zipline image storage service to obtain a public URL, and send it as a photo message to the originating chat channel using `ZaloClient.sendPhoto(chatId, caption, photoUrl)`. The system SHALL NOT host or serve static event images from the bot's local HTTP web server.

#### Scenario: Delivering photo to group channel
- **WHEN** `event_send_image` completes image rendering and uploads the buffer to Zipline
- **THEN** the bot receives a public Zipline image URL, calls `sendPhoto` with the public image URL and a friendly caption to the chat ID, and returns a success payload to the LLM

#### Scenario: Image delivery when Zipline upload fails
- **WHEN** Zipline is unconfigured or image upload fails
- **THEN** `event_send_image` returns an informative error message indicating image storage failure without crashing the conversation
