# Design

## Context

The bot operates a conversational Fastify backend receiving Zalo events (`apps/backend/src/delivery.ts`). Incoming photo messages are forwarded as multimodal inputs to Gemini (`apps/backend/src/llm/client.ts`). The assistant uses tool calling via the Vercel AI SDK (`apps/backend/src/tools/`).

Currently, the bot has vision OCR instructions in `DEFAULT_SYSTEM_PROMPT` but lacks a dedicated tool and verification logic for Vietnamese lotteries (vé số kiến thiết truyền thống Miền Nam, Miền Trung, Miền Bắc và Vietlott). See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Implement `createLotteryTool` in `apps/backend/src/tools/lottery.ts` with `lottery_check` tool definition.
- Build algorithmic prize verification in TypeScript for traditional lotteries (XSMB, XSMN, XSMT) and Vietlott to eliminate LLM arithmetic/digit hallucination.
- Map colloquial province/station names (e.g. "Sài Gòn", "TPHCM", "Bình Dương", "Đà Nẵng", "Hà Nội", "XSMB") to canonical station identifiers.
- Implement date parsing (YYYY-MM-DD, DD/MM/YYYY) and auto-fallback to the nearest draw date in GMT+7.
- Implement an in-memory cache to store fetched results by date and station.
- Support dependency injection for `fetchFn` for comprehensive unit testing without network dependencies.
- Update `DEFAULT_SYSTEM_PROMPT` in `apps/backend/src/llm/client.ts` to instruct the assistant on reading lottery tickets from photos and invoking `lottery_check`.
- Wire `createLotteryTool` into `apps/backend/src/delivery.ts` and export it in `apps/backend/src/tools/index.ts`.

**Non-Goals:**
- Purchasing or betting tickets.
- Foreign or non-Vietnamese lotteries.
- Standalone custom OCR engine (Gemini multimodal vision handles image extraction directly).

## Decisions

### Decision 1: Algorithmic Prize Verification inside the Tool
- **Approach**: The tool accepts `ticketNumber` (e.g. "123456" or "54321") and compares it against the official prize results using strict Vietnamese lottery rules:
  - **Southern & Central (XSMN / XSMT - 6 digits)**:
    - Giải Đặc Biệt: Trúng cả 6 chữ số.
    - Giải Phụ Đặc Biệt (An Ủi): Trúng 5 chữ số cuối (sai chữ số đầu tiên hàng trăm ngàn).
    - Giải Khuyến Khích: Trùng chữ số đầu tiên, chỉ sai 1 chữ số bất kỳ ở 5 vị trí còn lại so với GĐB.
    - Giải Nhất đến Giải Tám: Trùng các chữ số cuối tương ứng (5 số cho Giải 1-4, 4 số cho Giải 5-6, 3 số cho Giải 7, 2 số cho Giải 8).
  - **Northern (XSMB - 5 digits)**:
    - Giải Đặc Biệt: Trúng 5 chữ số.
    - Giải Nhất đến Giải Bảy: Trùng các chữ số cuối tương ứng.
    - Giải Phụ Đặc Biệt: Trúng 4 số cuối của GĐB.
    - Giải Khuyến Khích: Trúng 2 số cuối của GĐB.
  - **Vietlott (Mega 6/45, Power 6/55)**:
    - So khớp tập hợp các cặp số trúng thưởng theo quy chế Vietlott.
- **Rationale**: LLMs are known to hallucinate when comparing arbitrary sequences of digits (especially off-by-one errors for secondary/consolation prizes). Calculating exact matches algorithmically ensures 100% accuracy and outputs verified winning prizes and amounts.
- **Alternative considered**: Passing raw prize tables to LLM and letting it compare digits in text generation. Rejected due to high error rate.

### Decision 2: Flexible Station Resolution and Aliasing
- **Approach**: Maintain a dictionary of normalized province names, accents, and aliases (e.g., `['tphcm', 'hcm', 'tp hcm', 'tp.hcm', 'sai gon', 'thanh pho ho chi minh'] -> 'tp-hcm'`).
- **Rationale**: Users and ticket photos refer to stations by varied names ("XSKT TP. Hồ Chí Minh", "Đài Long An", "Đài Tiền Giang", "Bình Dương", v.v.).

### Decision 3: Public Result Fetching with In-Memory Caching
- **Approach**: Implement an HTTP adapter fetching from public Vietnamese lottery endpoints or standard structured feeds. Cache past dates indefinitely (since past results are immutable) and current-day results for 5 minutes.
- **Rationale**: Eliminates unnecessary external requests, stays well below rate limits, and provides instant responses.

### Decision 4: Multimodal Workflow & Prompt Alignment
- **Approach**: When a user shares a photo of a ticket:
  1. Gemini reads the ticket: station name, draw date, ticket number.
  2. Gemini invokes `lottery_check({ station, date, ticketNumber })`.
  3. `lottery_check` fetches the official results, calculates the exact winning prize(s) if any, and returns both the verification summary and the complete prize table.
  4. Gemini formulates a warm, plain-text response (no Markdown, adhering to Zalo requirements) stating the outcome clearly (trúng giải gì, trị giá bao nhiêu, hoặc chưa may mắn kèm lời chúc vui vẻ).
- **Rationale**: Seamlessly integrates into existing multimodal conversation pipeline.

## Risks / Trade-offs

- **[Risk]** External lottery API is temporarily unavailable or changes structure.  
  → **Mitigation**: Resilient error handling returning descriptive messages; unit test suite uses mocked responses; cache preserves recent lookups.
- **[Risk]** User sends photo before draw time on the draw day (e.g. at 14:00 when draw is at 16:15 or 18:15).  
  → **Mitigation**: Return status indicating draw has not occurred yet, specifying the usual draw time (XSMN: 16:15, XSMT: 17:15, XSMB: 18:15).
- **[Risk]** Image is blurry or digits partially covered.  
  → **Mitigation**: System prompt instructs assistant to politely request verification from user if digits or draw dates cannot be discerned with confidence.
