## 1. Database Schema and Repositories

- [x] 1.1 Update `src/db/migrations.ts` to create `lists` and `list_items` tables with unique and lookup indices
- [x] 1.2 Implement `src/db/list-repo.ts` with methods for list creation, item insertion, completion toggling, removal, and queries
- [x] 1.3 Add unit tests in `src/db/list-repo.test.ts` for all repository operations

## 2. Shared Lists Tools

- [x] 2.1 Implement `src/tools/lists.ts` defining `list_create`, `list_add_item`, `list_check_item`, `list_remove_item`, and `list_show` using `zod` schemas
- [x] 2.2 Add unit tests in `src/tools/lists.test.ts` testing tool execution and error handling

## 3. LLM Multi-step Tool Calling

- [x] 3.1 Update `src/llm/client.ts` to accept tool definitions and configure `maxSteps: 4` in `generateText`
- [x] 3.2 Update system prompt in `src/llm/client.ts` with guidance on using list tools and formatting list items

## 4. Wiring and Integration Verification

- [x] 4.1 Wire `ListRepository` and list tools into `src/index.ts`, `src/server.ts`, and `src/delivery.ts`
- [x] 4.2 Add integration tests in `src/server.test.ts` for creating, adding to, checking off, and viewing lists through conversational requests
- [x] 4.3 Verify full test suite passes with `pnpm test`, `pnpm build`, and `pnpm typecheck`
