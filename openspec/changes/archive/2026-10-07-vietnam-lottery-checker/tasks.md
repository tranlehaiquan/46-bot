# Tasks

## 1. Core Verification Logic & Station Aliasing

- [x] 1.1 Define lottery data types, station normalizer, and province aliases in `apps/backend/src/tools/lottery.ts` covering XSMB, XSMN, XSMT, and Vietlott. Verify station normalization resolves variations like 'TPHCM', 'Sài Gòn', 'Đà Lạt', 'Bình Dương' to standard codes.
- [x] 1.2 Implement the prize matching algorithm in `apps/backend/src/tools/lottery.ts` for 5-digit (XSMB), 6-digit (XSMN/XSMT), and Vietlott tickets (checking Giải Đặc Biệt, Giải Nhất đến Tám, Giải Phụ Đặc Biệt / An Ủi, and Giải Khuyến Khích).
- [x] 1.3 Write comprehensive unit tests in `apps/backend/src/tools/lottery.test.ts` testing prize matching for all prize tiers, near-misses, consolation prizes, and invalid ticket numbers.

## 2. Lottery Data Fetcher & Cache

- [x] 2.1 Implement `fetchLotteryResults` in `apps/backend/src/tools/lottery.ts` with dependency-injected `fetchFn`, date parsing, and in-memory caching by station and draw date.
- [x] 2.2 Add unit tests in `apps/backend/src/tools/lottery.test.ts` verifying API fetch handling, cache hits on repeated queries, and resilient fallback when results are pending or unavailable.

## 3. Tool Definition & Multimodal LLM Integration

- [x] 3.1 Create `createLotteryTool` conforming to Vercel AI SDK `tool()` definitions and export it from `apps/backend/src/tools/index.ts`.
- [x] 3.2 Update `DEFAULT_SYSTEM_PROMPT` in `apps/backend/src/llm/client.ts` with explicit instructions on processing lottery ticket photos (extracting station, draw date, ticket number, calling `lottery_check`, and outputting plain-text Vietnamese responses).
- [x] 3.3 Wire `createLotteryTool` into `handleDelivery` in `apps/backend/src/delivery.ts` alongside other assistant tools.

## 4. Verification and Regression Testing

- [x] 4.1 Run test suite across backend packages (`pnpm test`) to verify all lottery tests pass and no regression is introduced in existing delivery and LLM pipelines.
