## Context

46-bot serves as an interactive assistant in Zalo groups and private chats. In group environments, conversations naturally involve multiple individuals (e.g. parents, children, extended family). While incoming webhook deliveries supply `chatId`, `senderId`, and `senderName`, the bot currently lacks a persistent member directory for each group.

As a result:
1. The assistant cannot distinguish family roles (e.g., mapping a specific `senderId` to "Bố" or "Mẹ").
2. The assistant cannot answer questions regarding who the group members are ("nhóm mình có những ai?").
3. Personal preferences and profile notes cannot be cleanly associated with individual members when interacting in the shared group channel.

## Goals / Non-Goals

**Goals:**
- **Group Member Auto-Discovery**: Automatically track each active member per `chat_id` whenever an incoming message is received, recording `senderId`, `senderName`, and `lastSeenAt`.
- **Member Profiles & Distinction**: Store customizable attributes per member (`alias`/nickname, `relationship`, `notes`) and expose them to the LLM during prompt construction so the assistant immediately knows who is speaking and who is part of the family group.
- **LLM Member Management Tools**:
  - `list_group_members`: Enable the model to list all recognized members in the current group along with their aliases, roles, and notes.
  - `update_group_member`: Allow the model to set or update a member's alias/role (e.g., "Bố", "Mẹ", "Bé Bông"), relationship, or personal notes based on conversation.
- **System Prompt Enrichment**: Include a concise, structured roster of known group members in the system prompt for group conversations, highlighting the active speaker.

**Non-Goals:**
- Full group roster synchronization via external Zalo administrative APIs (members are discovered as they participate, or explicitly added/updated by family members).
- Role-based access control or permission restrictions among family members.

## Decisions

### 1. Dedicated `group_members` Table vs Embedding in Existing Channels Table
- **Decision**: Introduce a new SQLite table `group_members` with composite unique constraint `(chat_id, sender_id)`.
- **Rationale**: Keeps channel metadata clean while properly supporting one-to-many relationships (a channel has multiple members). Enables indexing and direct querying per group.
- **Columns**: `id`, `chat_id`, `sender_id`, `sender_name`, `alias`, `relationship`, `notes`, `created_at`, `last_seen_at`.

### 2. Automatic Member Upsert on Incoming Messages
- **Decision**: In `delivery.ts`, prior to reply generation, call `groupMemberRepo.recordActivity(chatId, senderId, senderName)`.
- **Rationale**: Ensures any participant who speaks is immediately registered in the group directory without requiring explicit user setup. If the member already exists, it updates `sender_name` (in case of name changes) and `last_seen_at`.

### 3. Member Directory Injection in LLM System Prompt
- **Decision**: In `client.ts` / `delivery.ts`, when preparing LLM context for a group chat, query active members via `groupMemberRepo.listMembers(chatId)` and format them into an XML block `<group_members>` in the system prompt.
- **Rationale**: Providing known members in context ensures the LLM recognizes references like "Bố", "Mẹ", "anh Tuấn", and attributes responses accurately to the current speaker without needing an extra tool call for basic recognition.

### 4. Tool Support: `list_group_members` and `update_group_member`
- **Decision**: Expose dedicated tools in `createGroupMemberTools(groupMemberRepo, context)`.
  - `list_group_members`: Returns the member roster with IDs, display names, aliases, and notes.
  - `update_group_member`: Allows setting or updating `alias`, `relationship`, or `notes` targeting a member by `sender_id` or matching `sender_name`/`alias`.
- **Rationale**: Enables conversational commands such as "nhớ Bố là Nam nhé", "đổi biệt danh của Bông thành Bé Bông", or "liệt kê các thành viên trong nhà".

## Risks / Trade-offs

- **[Risk] Multiple members having the same name or ambiguous alias references** → *Mitigation*: The repository matches by exact `senderId` first; when matching by name/alias, it returns disambiguation candidates if multiple matches are found.
- **[Risk] Prompt size growth if a group has dozens of members** → *Mitigation*: Group sizes for family chats are typically under 20. The system limits the injected prompt roster to the most recently active members (e.g., top 30) with concise fields.
- **[Risk] Privacy / Prompt injection in member notes** → *Mitigation*: Validate notes against sensitive patterns and prompt injection detectors (`isMemorySafe` / `detectPromptInjection`), consistent with `memories`.
