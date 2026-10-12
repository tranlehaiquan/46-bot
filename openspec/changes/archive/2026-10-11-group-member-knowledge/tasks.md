## 1. Database Schema & Migration

- [x] 1.1 Add `group_members` table migration in `apps/backend/src/db/migrations.ts` with columns (`id`, `chat_id`, `sender_id`, `sender_name`, `alias`, `relationship`, `notes`, `created_at`, `last_seen_at`) and unique index on `(chat_id, sender_id)`.
- [x] 1.2 Add schema verification tests in database test suite to ensure table creation and constraints work as expected.

## 2. Group Member Repository

- [x] 2.1 Create `apps/backend/src/db/repositories/group-members.ts` providing `recordActivity`, `listMembers`, `getMember`, `updateMember`, and `findByAliasOrName`.
- [x] 2.2 Add unit tests in `apps/backend/src/db/repositories/group-members.test.ts` testing member upsert, listing, and updates.

## 3. LLM Tools

- [x] 3.1 Create `apps/backend/src/tools/group-members.ts` implementing `list_group_members` to return registered members, aliases, roles, and notes.
- [x] 3.2 Implement `update_group_member` tool in `apps/backend/src/tools/group-members.ts` with sensitive data guards and prompt injection checks.
- [x] 3.3 Write unit tests in `apps/backend/src/tools/group-members.test.ts` covering member listing, profile updates, and safety rejections.

## 4. Delivery Pipeline & Prompt Integration

- [x] 4.1 Update `apps/backend/src/delivery.ts` to call `groupMemberRepo.recordActivity` on incoming group messages to auto-discover and update members.
- [x] 4.2 Update system prompt builder in `apps/backend/src/llm/client.ts` to include `<group_members>` context block with active speaker details when in group chats.
- [x] 4.3 Expose `list_group_members` and `update_group_member` tools to `generateReply` in `apps/backend/src/delivery.ts`.
- [x] 4.4 Add integration tests verifying member discovery, prompt enrichment, and tool execution in `server.test.ts`.
