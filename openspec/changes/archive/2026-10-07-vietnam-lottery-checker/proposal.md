# Proposal

## Why

Family chat group members in Vietnam often share photos of lottery tickets (vé số kiến thiết truyền thống Miền Nam, Miền Trung, Miền Bắc hoặc Vietlott) and ask whether they won. Cross-referencing 5-6 digit numbers across multiple prize tiers (Đặc Biệt, Nhất đến Tám, An Ủi, Khuyến Khích) on ad-laden result websites is tedious and error-prone. 

Because the bot already supports multimodal image recognition with Gemini and tool execution via the Vercel AI SDK, adding a dedicated Vietnamese lottery checking tool empowers family members to simply snap a photo of their ticket and ask the bot to check the results. The bot reads the ticket details (đài/tỉnh, ngày quay, số vé), retrieves official winning numbers, validates against Vietnamese prize structures, and gives a warm, accurate result breakdown.

## What Changes

- **Add Vietnamese Lottery Lookup Tool (`lottery_check`)**:
  - Implement a new tool in `apps/backend/src/tools/lottery.ts` capable of querying lottery results by region/province station (XSMB, XSMN, XSMT stations) or Vietlott games for a specific draw date.
  - Support automatic ticket number verification: compares user ticket digits against all prize tiers (Giải Đặc Biệt, Giải 1 đến Giải 8, Giải Phụ Đặc Biệt / An Ủi, Giải Khuyến Khích) with exact Vietnamese lottery matching rules.
  - Return clear, structured results (trúng giải gì, số tiền trúng theo quy chuẩn, hoặc chưa may mắn) alongside the full prize table for transparency.
- **Lottery Data Fetcher & Cache**:
  - Implement a resilient HTTP fetcher for Vietnamese lottery results using open/public endpoints or reliable RSS/APIs (with mock/fallback support for offline testing).
  - Cache results by date and station in memory to minimize network requests and improve latency.
- **Multimodal Prompt Guidance**:
  - Update system prompt instructions in `apps/backend/src/llm/client.ts` to instruct the assistant on recognizing lottery tickets from photos, extracting the correct province/station name, draw date, and ticket digits, and invoking `lottery_check`.
- **Tool Integration in Delivery Pipeline**:
  - Wire `lottery_check` into `apps/backend/src/delivery.ts` and `apps/backend/src/tools/index.ts`.

## Capabilities

### New Capabilities
- `vietnamese-lottery`: Query official Vietnamese lottery results (XSMB, XSMT, XSMN, Vietlott) by draw date and station, evaluate ticket numbers against prize structures, and return structured winning statuses and prize tables.

### Modified Capabilities
- `llm-conversation`: Expand system prompt instructions and tool registrations to support automated lottery ticket OCR interpretation and conversational result reporting.

## Impact

- **Backend code**:
  - `apps/backend/src/tools/lottery.ts` (new)
  - `apps/backend/src/tools/lottery.test.ts` (new unit tests)
  - `apps/backend/src/tools/index.ts` (tool export)
  - `apps/backend/src/delivery.ts` (tool registry)
  - `apps/backend/src/llm/client.ts` (system prompt guidance)
- **External Dependencies**:
  - Uses native `fetch` with Zod validation. No new third-party npm runtime dependencies required.
- **Breaking Changes**: None. Backwards-compatible addition to the tool suite.
