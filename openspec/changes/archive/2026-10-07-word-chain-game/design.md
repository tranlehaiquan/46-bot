## Context

Users want interactive community entertainment in chat groups. Vietnamese Word Chain (nối chữ) is a well-known linguistic game where players alternately provide 2-syllable Vietnamese phrases, with each new phrase starting with the previous phrase's ending syllable (e.g. *học sinh* -> *sinh viên* -> *viên phấn*).

Currently, 46-bot handles incoming messages via `delivery.ts` with SQLite/Turso persistence, supporting LLM tool calling (events, holidays, weather, lottery, lists, memory) and fast-path message processing. To ensure real-time responsiveness and low latency for word chain turns without burning LLM tokens on every word, the game engine should support both fast-path turn processing (direct command/phrase parsing) and LLM tool triggers.

## Goals / Non-Goals

**Goals:**
- Provide a robust word chain session manager scoped per chat channel.
- Efficiently validate Vietnamese phrases:
  - Exactly 2 syllables.
  - Case-insensitive, accent-preserving syllable matching between previous word's tail and current word's head.
  - Validation against a recognized Vietnamese lexicon dataset.
  - Prevention of duplicate word reuse in the same game session.
- Manage turn lifecycle: configurable inactivity timeout (default 60 seconds), voluntary game stop (`!dungnoichu`), and game start (`!noichu`).
- Maintain persistent player statistics and leaderboard rankings (channel-level and global) in SQLite/Turso.
- Deliver low-latency game feedback (<50ms for word checks) through fast-path matching in `delivery.ts` when a channel has an active game, while also exposing game tools to the LLM agent for natural conversational interaction.

**Non-Goals:**
- Multiplayer turn-order enforcement (any channel participant can jump in with a valid word, keeping group chats dynamic and fun; optional strictly turn-taking mode is non-goal for v1).
- Single-syllable or >2 syllable word games.
- Complex monetary or gambling rewards.

## Decisions

### 1. Dictionary Storage and Lookups
- **Choice**: Embed an in-memory normalized Set / Trie loaded from a pre-curated Vietnamese 2-word phrase list (`vietnamese-words.json` or bundled text file).
- **Rationale**: An in-memory Set provides $O(1)$ instantaneous validation with zero database overhead and zero LLM latency.
- **Alternatives Considered**:
  - *Querying LLM for validity*: Too slow (1-3 seconds), expensive, and non-deterministic.
  - *Querying SQLite on every word*: Slower than in-memory Set; unnecessary disk I/O for static dictionary data.

### 2. Fast-Path Turn Interception vs. LLM Tool-Only
- **Choice**: Fast-path interceptor in `delivery.ts` for channels with an active game session, combined with LLM tools for conversational requests (`startWordChainGame`, `getWordChainLeaderboard`).
- **Rationale**: Chat games require rapid feedback. If players have to wait 2 seconds for LLM generation on every single word turn, the gameplay feels sluggish. When an active game exists for a chat, incoming messages matching game command syntax or 2-syllable phrases are evaluated by `WordChainService` first.
- **Alternatives Considered**:
  - *Only LLM tools*: High latency, high API costs per word played.
  - *Pure slash commands only*: Less friendly in chat groups where users simply type the next 2 words.

### 3. Database Schema for Game Sessions and Leaderboard
- **Choice**: Add three tables via SQLite migrations:
  - `word_chain_sessions`: Tracks `id`, `chat_id`, `status` (`active`, `finished`, `timed_out`), `current_word`, `total_words`, `started_at`, `ended_at`, `updated_at`.
  - `word_chain_history`: Records words played in each session (`session_id`, `word`, `player_id`, `player_name`, `turn_index`, `points`, `created_at`).
  - `word_chain_stats`: Aggregated player stats per channel & globally (`chat_id`, `player_id`, `player_name`, `total_score`, `words_chained`, `highest_streak`, `games_played`, `games_won`, `updated_at`).
- **Rationale**: Decouples active game states from historical audit logs and leaderboard queries. Facilitates high-performance leaderboard queries indexed by `chat_id` and `total_score`.

### 4. Turn Timeout Mechanism
- **Choice**: In-memory timer (`setTimeout`) in Node.js backend linked to the active session ID, cleared and rescheduled on each successful turn, plus database timestamp check on recovery.
- **Rationale**: Standard, lightweight pattern in Node.js backend services. When timeout fires, bot sends a notification to the chat and marks session finished.

## Risks / Trade-offs

- **[Risk]** Dictionary false positives or false negatives (regional slang, new words).
  → **Mitigation**: Use an established open-source Vietnamese lexicon (e.g. VDict/Vietnamese compound words dataset), with lowercased accent-normalized matching. Optionally allow bot admin to append/whitelist words.
- **[Risk]** Active game intercepting normal conversation in group chats.
  → **Mitigation**: Only intercept messages that either start with explicit prefix (`!`, `.`) OR are strictly 2 words that match the required first syllable when a game is actively running. Ignore multi-sentence messages and long chat messages. Provide explicit `!dungnoichu` command and 60-second inactivity auto-expiration.
- **[Risk]** Server restarts during an active session.
  → **Mitigation**: Sessions are persisted in the database with `status = 'active'` and `updated_at`. On startup, expired active sessions are cleanly marked `timed_out`.

## Migration Plan

1. Create migration in `apps/backend/src/db/migrations.ts` to add `word_chain_sessions`, `word_chain_history`, and `word_chain_stats` tables with appropriate indexes.
2. Add Vietnamese lexicon dataset into backend assets/data.
3. Implement `WordChainRepository` and `WordChainService`.
4. Register tools in `apps/backend/src/tools/word-chain.ts` and wire into `delivery.ts`.
5. Automated tests covering dictionary lookup, game session lifecycle, valid/invalid turns, streak scoring, and leaderboard queries.

## Open Questions

- *Initial starting word*: Should the game automatically pick a random common starter word, or allow the game initiator to provide their own starting phrase? (Default: Random starting word provided by bot to avoid deadlocks).
