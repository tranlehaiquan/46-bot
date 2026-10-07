## Why

Interactive group games drive engagement and fun in chat channels. A Vietnamese word chain (nối chữ) minigame allows channel members to compete or collaborate in a traditional word game directly within their chat conversations, while persistent leaderboards foster community competition and recognition.

## What Changes

- Add a word chain minigame engine with session management per channel (start game, play word, stop game, timeout handling).
- Validate Vietnamese phrases (2-syllable phrases / từ ghép), chain continuity (next phrase starts with previous phrase's ending word), and duplicate word avoidance within the same session.
- Provide a built-in Vietnamese dictionary/lexicon lookup mechanism with fast offline verification and fallback validation.
- Implement scoring and streak tracking for participating players in active games.
- Add leaderboard and user stats tracking (channel-level and global rankings for top scores, longest streaks, and total games won).
- Integrate natural language commands or explicit game commands (e.g. `!noichu`, `!dungnoichu`, `!bxh`, or conversational triggers like "chơi nối chữ", "xem bảng xếp hạng nối chữ") via bot tools or fast-path message handlers.

## Capabilities

### New Capabilities
- `word-chain-game`: Vietnamese word chain minigame engine, rule validation, session lifecycle, dictionary verification, player scoring, and leaderboard tracking.

### Modified Capabilities
<!-- None -->

## Impact

- **Backend**:
  - New database tables/migrations for word chain sessions, words played, and player stats / leaderboards.
  - New repository for word chain game state and player statistics (`WordChainRepository`).
  - Vietnamese dictionary dataset / trie or Set for fast O(1) word validity lookups.
  - Integration into message delivery pipeline (`delivery.ts` / tools) to detect game interactions or tool triggers.
- **Dependencies**: May add lightweight Vietnamese word list / lexicon data (or bundled static json/txt list).
- **Admin / API**: Optional endpoints or stats views for leaderboard inspection.
