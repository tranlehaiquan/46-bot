## Context

Memories were previously simple subject-fact strings. However, family interactions contain temporal bounds ("cho đến cuối tuần"), avoidance rules ("đừng nói với con chuyện này", "tránh rủ đi nhậu vì đau dạ dày"), and preconditions ("chỉ làm khi được bố mẹ đồng ý"). Without preserving these boundaries, the assistant risks giving inappropriate advice, reminding family members of sensitive topics, or applying temporary states forever.

## Goals / Non-Goals

**Goals:**
- Extend the `memories` schema with `condition`, `avoid_action`, and `expires_at` fields.
- Provide safe schema migration compatible with existing SQLite databases.
- Allow `remember` tool to accept action boundary arguments (`condition`, `avoidAction`, `expiresAt`).
- Automatically exclude expired memories from active prompt injection (`listActiveMemories`) while preserving them for audit/history.
- Format active action constraints into system prompt context with cautionary guidance.
- Surface action boundaries in `list_memories` and `memory_search` responses.

**Non-Goals:**
- Building a complex temporal workflow engine or cron runner (scheduled tasks already handle recurring timed executions).
- Replacing prompt-security injection filters.

## Decisions

1. **Nullable Schema Columns on `memories`**:
   - *Decision*: Add `condition`, `avoid_action`, and `expires_at` as nullable columns directly onto `memories`.
   - *Rationale*: Keeps fact and its action boundary co-located in a single record without extra joins. Existing queries continue working without modification.

2. **Automatic Filtering in `listActiveMemories`**:
   - *Decision*: Query active memories where `status = 'active' AND (expires_at IS NULL OR expires_at > now)`.
   - *Rationale*: Prevents expired temporary rules (e.g. "bận đến 15/10") from polluting prompt budget and misleading the model after the expiry timestamp.

3. **Human-Readable Prompt Injection Format**:
   - *Decision*: Format action boundaries in the prompt as:
     `- <Subject>: <Fact> [Tránh: <avoidAction> | Điều kiện: <condition>]`
   - *Rationale*: Compact and unambiguous for LLM instruction following.

4. **Flexible Date Parsing**:
   - *Decision*: In `remember`, accept `expiresAt` as an ISO string, a `YYYY-MM-DD` date, or relative days, and normalize to epoch milliseconds before saving.

## Risks / Trade-offs

- **[SQLite Migration Compatibility]** → Running migrations on existing databases.
  - *Mitigation*: Use PRAGMA table_info to inspect existing columns before running `ALTER TABLE ADD COLUMN` to ensure idempotency.
