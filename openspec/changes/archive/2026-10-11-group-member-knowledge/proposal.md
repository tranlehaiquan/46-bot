## Why

When 46-bot is used in family groups, conversations involve multiple members (e.g. Bố, Mẹ, Con gái, Anh Hai). Currently, the bot records raw `senderId` and `senderName` from webhook deliveries, but does not maintain a member directory for the group. It cannot distinguish member family roles, nicknames, or individual preferences, nor can it answer questions about who the members are or associate individual member knowledge with the person currently speaking.

Providing group member awareness, profile management, and a tool to list and recognize members enables the bot to address family members accurately, personalize answers per person, and maintain persistent individual context within group chats.

## What Changes

- **Group Member Registry & Auto-Discovery**: Automatically register or update members in a `group_members` database table whenever they interact in a group chat, recording `chatId`, `senderId`, `senderName`, `alias` (e.g. family title or nickname), `notes`, and `lastSeenAt`.
- **Member Distinction & Profiles**: Allow the bot to manage individual member profiles (e.g. associating "Bố" with a specific member ID, saving roles and personal notes) via tools.
- **List Members Tool**: Provide a `list_group_members` tool so the LLM can list who is in the group, their aliases/roles, and notes when asked (e.g., "nhóm này có những ai?", "ai là Bố?").
- **Update Member Profile Tool**: Provide an `update_group_member` tool allowing the assistant to update a member's alias/nickname, relationship, or notes when instructed during conversation.
- **LLM Context Enhancement**: Inject known group members (names, aliases, roles) and identify the current active speaker in the prompt so the LLM understands who is speaking and who is being referred to.

## Capabilities

### New Capabilities
- `group-member-knowledge`: Manages group member tracking, persistent member profiles (aliases, roles, notes), and provides LLM tools to list members and update member profile information in groups.

### Modified Capabilities
- `llm-conversation`: Injects known group member identities and roles into the system prompt context when in group chats, allowing the LLM to distinguish speakers and refer to members accurately.

## Impact

- **Database**: Adds `group_members` table (or schema migration) tracking members per `chat_id`.
- **Backend Repositories**: Adds `GroupMemberRepository` to manage member CRUD and upsert operations on incoming messages.
- **LLM Tools**: Adds `list_group_members` and `update_group_member` tools made available during group chat interactions.
- **Delivery Pipeline**: Automatically discovers/updates member activity during incoming message handling in `delivery.ts`, and feeds known members into LLM prompt generation.
