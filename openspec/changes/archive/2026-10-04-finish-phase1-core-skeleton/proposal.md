## Why

The bot currently operates as a minimal verification slice: it receives webhooks and responds with a static confirmation ("Mình nhận được.") to all text messages. To deliver Phase 1 of the Family Bot roadmap, the bot must become a real conversational assistant that uses SQLite for persistent message deduplication and history, responds only when mentioned or replied to in groups, and uses DeepSeek to produce natural, family-friendly Vietnamese responses.

## What Changes

- Add SQLite persistence via `better-sqlite3` storing data at `DB_PATH` (defaults to `/data/family.db` with WAL mode and busy timeout).
- Replace in-memory deduplication with a persistent `seen_messages` table.
- Record incoming and outgoing conversation turns in a `messages` table to provide short-term context (~20 turns) to the LLM.
- Update group delivery logic: in groups, only respond if the bot is mentioned or if the message is a reply to one of the bot's messages.
- Integrate Vercel AI SDK (`ai`) with DeepSeek (`@ai-sdk/deepseek` or OpenAI-compatible provider) to generate responses with a warm, concise Vietnamese persona.
- Add typing indicator (`sendChatAction: "typing"`) before LLM generation.
- Add outbound message splitting for messages exceeding Zalo's 2000-character limit.
- **BREAKING**: Group messages that do not mention the bot or reply to the bot will no longer receive a response. Canned response "Mình nhận được." is replaced by LLM-generated responses.

## Capabilities

### New Capabilities
- `chat-memory`: Persistent SQLite storage for message deduplication (`seen_messages`) and short-term conversation history (`messages` table) pruned to keep recent context.
- `llm-conversation`: DeepSeek integration via the AI SDK to generate context-aware conversational replies with typing indicators, fallback failure handling, and outbound message splitting.

### Modified Capabilities
- `group-discovery`: Change response behavior from static canned reply on all text to selective replies (only when mentioned or replying to bot in groups) powered by LLM conversation.

## Impact

- **Dependencies**: Adds `better-sqlite3`, `@types/better-sqlite3`, `ai`, and `@ai-sdk/deepseek` (or OpenAI provider).
- **Configuration**: Requires `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` (defaulting to e.g. `deepseek-chat`), `DB_PATH` (default `/data/family.db`), and optionally bot identity for mention matching.
- **Runtime**: Manages SQLite connection lifecycle and schema initialization on startup. Requires `/data` volume permissions in Docker.
