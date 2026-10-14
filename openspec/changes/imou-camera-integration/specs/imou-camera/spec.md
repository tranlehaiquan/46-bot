## ADDED Requirements

### Requirement: Imou OpenAPI authentication and signature generation
The system SHALL communicate with the Imou Cloud Open Platform API using secure MD5 request signatures. Each API request payload SHALL contain a `system` object including `ver: "1.0"`, `appId`, `time` (epoch seconds), a unique `nonce`, and `sign` calculated as the lowercase 32-character hexadecimal MD5 hash of `time:${time},nonce:${nonce},appSecret:${appSecret}`. The client SHALL authenticate using `POST /openapi/accessToken`, extract the `accessToken` and `expireTime`, and cache the token in-memory to prevent unnecessary authentication requests.

#### Scenario: Successful token acquisition and caching
- **WHEN** client makes an API request and has no cached token or the token has expired
- **THEN** system dispatches `POST /openapi/accessToken` with signed payload, caches the returned `accessToken`, and uses it for subsequent calls

#### Scenario: Nonce uniqueness
- **WHEN** concurrent or sequential requests are dispatched
- **THEN** each request uses a newly generated unique nonce to prevent replay rejection (error `SN1005`)

### Requirement: On-demand camera snapshot capture
The system SHALL request live device snapshots from the Imou Cloud Open Platform. The client SHALL dispatch `POST /openapi/setDeviceSnapEnhanced` with device ID and channel ID. If the device does not support enhanced snapshot or returns an error, the client SHALL automatically fallback to `POST /openapi/setDeviceSnap`. Upon receiving a successful image URL from the Imou API, the system SHALL download the image and persist it into the camera images directory.

#### Scenario: Enhanced snapshot capture
- **WHEN** user requests a snapshot for a supported camera
- **THEN** system calls `setDeviceSnapEnhanced`, receives temporary image URL, downloads the JPEG, and saves it locally

#### Scenario: Fallback to standard snapshot
- **WHEN** `setDeviceSnapEnhanced` fails due to unsupported method or device incompatibility
- **THEN** system retries using `setDeviceSnap` and saves the resulting image

### Requirement: Static camera snapshot HTTP serving
The Fastify backend server SHALL serve camera snapshots at `GET /images/camera/:filename`. The route SHALL sanitize the requested filename against directory traversal, verify existence in candidate image directories, set cache control headers, and stream the image with `image/jpeg` content type.

#### Scenario: Successfully fetching camera image
- **WHEN** an HTTP client requests `GET /images/camera/camera_sample.jpg` for an existing file
- **THEN** system responds with HTTP 200, content-type `image/jpeg`, and the binary image stream

#### Scenario: Image not found
- **WHEN** an HTTP client requests a non-existent filename
- **THEN** system responds with HTTP 404 and `{ "message": "Image not found" }`

### Requirement: Camera toolset for LLM function calling
The system SHALL provide `camera_list` and `camera_capture` tools to the LLM agent.
- `camera_list` SHALL return all configured cameras with their identifier, display name, and channel.
- `camera_capture` SHALL accept optional `cameraId`, optional `sendPhoto` (default true), optional `caption`, and optional `question`.
When `sendPhoto` is true and a public webhook URL is configured, the system SHALL send the photo to the Zalo chat via `zalo.sendPhoto(chatId, photoUrl, caption)`.

#### Scenario: Listing cameras
- **WHEN** user asks what cameras are available or configured
- **THEN** the model invokes `camera_list` and reports the camera names and IDs

#### Scenario: Capturing snapshot and sending to Zalo
- **WHEN** user asks the bot to take a picture of a camera (e.g., "Chụp ảnh camera phòng khách")
- **THEN** the model invokes `camera_capture`, system captures the image, hosts it at `/images/camera/:filename`, and sends the photo to the Zalo conversation

### Requirement: AI Vision inspection on camera snapshots
When the user asks an observational question about what is happening in the camera (e.g., "Kiểm tra xem bé đã ngủ chưa", "Có ai ở phòng khách không?"), the `camera_capture` tool SHALL accept the `question` parameter. The system SHALL capture a fresh snapshot, invoke the Gemini Vision model to inspect the image and answer the question, and return the visual description to the primary model.

#### Scenario: Visual inspection question
- **WHEN** user asks "Bot ơi kiểm tra camera phòng khách xem cửa đã đóng chưa?"
- **THEN** `camera_capture` captures a live snapshot, passes the image to Gemini Vision with the question, returns the visual findings in the tool output, and the bot replies with the visual assessment while also delivering the photo
