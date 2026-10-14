## 1. Zalo Client Reliability

- [x] 1.1 Add `isLocalRejection` validation to `bot.sendMessage` in `apps/backend/src/zalo-client.ts` so `local-` IDs trigger plain-text fallback
- [x] 1.2 Ensure plain-text fallback throws when `local-` ID is returned
- [x] 1.3 Add test cases in `apps/backend/src/zalo-client.test.ts` verifying fallback triggers on `local-` message IDs

## 2. Outbound Chunking Safety

- [x] 2.1 Update chunking threshold to 1200 characters in `apps/backend/src/delivery.ts`
- [x] 2.2 Update chunking threshold to 1200 characters in `apps/backend/src/scheduler/tasks.ts`

## 3. Verification & Testing

- [x] 3.1 Run backend unit and integration tests (`pnpm --filter @bot/backend test`)
- [x] 3.2 Run workspace-wide typecheck (`pnpm typecheck`) and build (`pnpm build`)
