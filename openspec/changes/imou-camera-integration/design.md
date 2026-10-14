## Context

The bot (`46-bot`) operates as a family assistant on Zalo. Users want to check on their home cameras directly in their Zalo chat. The bot is deployed in a cloud/container environment (Docker on VPS/Dokploy), while Imou cameras are installed at home behind NAT routers. Therefore, integration is achieved through the **Imou Cloud Open Platform** (`open.imoulife.com` / `openapi.easy4ip.com`), enabling the bot to securely request device snapshots without opening local router ports or requiring a home VPN tunnel.

## Goals / Non-Goals

**Goals:**
- Provide a robust Node.js client for Imou OpenAPI with token caching and MD5 request signatures.
- Provide `camera_list` and `camera_capture` tools to LLM for conversational control.
- Deliver real-time camera snapshots directly into Zalo chat conversations (`zalo.sendPhoto`).
- Enable AI Vision inspection on freshly captured snapshots using Gemini Vision to answer natural questions (e.g. "Is the door closed?", "Is anyone in the living room?").
- Support configuration via both environment variables and Admin Dashboard settings (`/admin`), including connection testing.

**Non-Goals:**
- Continuous video streaming or live HLS playback in Zalo chat (Zalo messages support photos, not interactive live video streams).
- Local RTSP direct streaming (cloud deployment makes local RTSP inaccessible without VPN).
- Recording or historical DVR playback retrieval.

## Decisions

### Decision 1: Lightweight native OpenAPI client over 3rd-party dependencies
- **Approach**: Implement a dedicated `ImouClient` using standard `fetch` and Node.js built-in `node:crypto` (for MD5 hash generation and UUID nonces).
- **Rationale**: Imou OpenAPI follows a straightforward JSON RPC envelope with `system: { ver, appId, time, nonce, sign }`. There are no official, maintained Node.js npm packages for Imou OpenAPI. Building a clean, typed TypeScript client avoids unmaintained dependencies and keeps Docker image sizes minimal.
- **Alternatives considered**: Spawning Python `imouapi` subprocesses (rejected due to excessive memory footprint and complex runtime dependencies).

### Decision 2: Local snapshot caching and static image delivery
- **Approach**: When a snapshot URL is obtained from `setDeviceSnapEnhanced` (or `setDeviceSnap`), the backend downloads the JPEG immediately and saves it to `data/images/camera/:filename`, served by Fastify at `GET /images/camera/:filename`.
- **Rationale**: Temporary URLs from Imou Cloud may expire within minutes, and Zalo's media download worker requires a stable, accessible HTTP/HTTPS URL on the bot's domain (`${WEBHOOK_URL}/images/camera/...`). Additionally, having the local image buffer in-memory allows immediate handover to Gemini Vision without redundant network calls.

### Decision 3: Unified tool design for snapshot capture and visual inspection
- **Approach**: Design `camera_capture` to accept an optional `question` parameter:
  - If `question` is omitted: captures snapshot and sends the photo to the Zalo chat.
  - If `question` is present: captures snapshot, delivers the photo to the chat, passes the image to Gemini Vision with an inspection prompt, and returns the visual findings in the tool result for the primary assistant turn.
- **Rationale**: Provides a seamless conversational experience. When a family member asks "Xem camera phòng khách xem bé đã ngủ chưa?", the bot takes the picture, delivers the photo, and answers with what it sees in a single interaction.

### Decision 4: Flexible camera configuration in Database & Environment
- **Approach**: Support single-camera simplicity (`IMOU_DEVICE_ID`, `IMOU_CHANNEL_ID`, `IMOU_DEVICE_NAME`) and multi-camera JSON lists (`IMOU_CAMERAS`). Persist dynamic updates in `system_settings` via the Web Admin SPA so credentials and camera additions don't require rebuilding or redeploying containers.

## Risks / Trade-offs

- **[Risk] Cloud API rate limits / snapshot throttle**: Imou recommends $\ge 1$ second between snapshot requests on modern cameras and $\ge 3$ seconds on older hardware.
  - *Mitigation*: Debounce sequential requests to the same camera and handle rate-limiting error codes gracefully with a friendly message ("Camera đang bận chụp ảnh, vui lòng thử lại sau vài giây").
- **[Risk] Temporary snapshot URL expiration**: Imou cloud URLs expire after a short duration.
  - *Mitigation*: The bot immediately downloads the JPEG into local storage upon API response.
- **[Risk] Nonce collision**: Reusing nonces triggers Imou error `SN1005`.
  - *Mitigation*: Generate cryptographic random UUIDs (`crypto.randomUUID()`) for each request.
- **[Risk] Camera sleep/privacy mode**: If the camera is set to privacy mode, snapshots will show black/blank or fail.
  - *Mitigation*: Report clear feedback if snapshot fails or device is offline/dormant.

## Migration Plan

1. Non-breaking: Camera features are activated only when `IMOU_APP_ID` and `IMOU_APP_SECRET` (or `imou_app_id` in database) are configured. If unconfigured, the bot operates normally without camera tools.
2. Admins can configure credentials directly via the Admin Dashboard under `/admin` Settings or via `.env`.
