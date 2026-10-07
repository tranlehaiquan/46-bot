## 1. Database & Lexicon Setup

- [x] 1.1 Add database migration in `migrations.ts` for `word_chain_sessions`, `word_chain_history`, and `word_chain_stats` tables with indexes
- [x] 1.2 Bundle Vietnamese 2-syllable lexicon dataset and implement in-memory dictionary loader with diacritic-aware normalization

## 2. Core Word Chain Engine & Repository

- [x] 2.1 Implement `WordChainRepository` for session persistence, word history logging, and leaderboard statistics
- [x] 2.2 Implement `WordChainService` with turn validation (2 syllables, matching tail-to-head syllables, dictionary verification, no duplicate words in round)
- [x] 2.3 Implement session lifecycle management (start game with starter word, process turn, stop game, and turn inactivity timeout)
- [x] 2.4 Implement scoring system with base points, streak bonuses, and round summary calculation

## 3. Leaderboard & Statistics

- [x] 3.1 Implement leaderboard query functions (channel-specific and global top players by score/streak) in `WordChainRepository`
- [x] 3.2 Implement player stats query and message formatters for leaderboard and personal statistics

## 4. Bot Delivery Pipeline & Tools Integration

- [x] 4.1 Create LLM tools in `apps/backend/src/tools/word-chain.ts` for conversational game actions and leaderboard queries
- [x] 4.2 Integrate fast-path turn interceptor in `delivery.ts` for instant low-latency game turns in active channels
- [x] 4.3 Implement command triggers (`!noichu`, `!dungnoichu`, `!bxh noichu`, `!noichu stats`) and clean chat responses

## 5. Testing & Verification

- [x] 5.1 Add unit tests for dictionary loading, normalization, and word chain validation rules
- [x] 5.2 Add repository unit tests for session tracking, turn recording, and leaderboard aggregation
- [x] 5.3 Add integration tests for complete game flow (start, continuous turns, streaks, invalid inputs, stop, timeout)
- [x] 5.4 Run tests across backend test suite to ensure no regressions
