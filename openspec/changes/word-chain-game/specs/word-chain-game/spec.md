## ADDED Requirements

### Requirement: Word chain game session lifecycle
The system SHALL manage word chain game sessions scoped to individual channels, allowing users to start, play, stop, or timeout a game round without cross-channel interference.

#### Scenario: Starting a new word chain game
- **WHEN** a user initiates a word chain game in a channel where no active session exists
- **THEN** the system initializes a new active session, picks or accepts a valid starting 2-syllable Vietnamese phrase, announces the starting phrase and rules to the channel, and starts the turn timer

#### Scenario: Starting when a game is already active
- **WHEN** a user requests to start a game while an active game is already in progress in that channel
- **THEN** the system informs the user that a game is already running and displays the current word waiting to be chained

#### Scenario: Stopping an active game
- **WHEN** a user requests to stop the game (`!dungnoichu` or "dừng nối chữ") in a channel with an active game
- **THEN** the system ends the current session, summarizes the final round statistics (total words chained, participating players, points earned), and marks the session as finished

#### Scenario: Turn inactivity timeout
- **WHEN** no valid word is submitted before the turn timeout expires (e.g. 60 seconds)
- **THEN** the system ends the game due to timeout, announces the final chain length and points earned, and clears the active session status

### Requirement: Vietnamese word chain validation
The system SHALL validate submitted words against Vietnamese word chain rules, requiring valid 2-syllable phrases, continuity with the previous word's trailing syllable, dictionary presence, and uniqueness within the current round.

#### Scenario: Valid chained word submission
- **WHEN** a user submits a 2-syllable phrase whose first syllable matches the second syllable of the current phrase, exists in the Vietnamese dictionary, and has not been used in this round
- **THEN** the system accepts the word, updates the active chain's current word, awards points and streak progress to the player, and resets the turn timer

#### Scenario: Invalid starting syllable
- **WHEN** a user submits a phrase whose first syllable does not match the previous phrase's second syllable
- **THEN** the system rejects the submission with an informative feedback message explaining the mismatch, leaving the current word unchanged

#### Scenario: Word not in dictionary
- **WHEN** a user submits a phrase that matches the starting syllable but does not exist in the recognized Vietnamese dictionary
- **THEN** the system rejects the submission, explaining that the phrase is not recognized as a valid Vietnamese term, and invites another attempt

#### Scenario: Duplicate word in same round
- **WHEN** a user submits a phrase that has already been successfully played in the current session
- **THEN** the system rejects the submission, notifying the channel that this phrase has already been used in this round

#### Scenario: Invalid format or word count
- **WHEN** a message submitted during an active game does not have exactly two syllables or contains invalid characters
- **THEN** the system ignores non-game chat messages or politely informs the user that word chain phrases must consist of exactly two words

### Requirement: Scoring and streak calculation
The system SHALL calculate points and streak multipliers for valid submissions and maintain player round statistics.

#### Scenario: Scoring consecutive correct words
- **WHEN** a player successfully plays a valid word that continues the chain
- **THEN** the system awards base points plus streak bonus points based on consecutive correct submissions by the player or collective chain length

#### Scenario: Consecutive player turns
- **WHEN** multiple players take turns in a group channel
- **THEN** the system tracks individual player contributions to the collective chain length and updates each player's accumulated score

### Requirement: Leaderboard and player statistics
The system SHALL persist player performance statistics and provide commands to view channel-level and global leaderboards.

#### Scenario: Viewing top leaderboard
- **WHEN** a user requests the word chain leaderboard (e.g. `!bxh noichu` or "bảng xếp hạng nối chữ")
- **THEN** the system returns a formatted leaderboard list showing top players ranked by total points, win count, and highest word streak

#### Scenario: Viewing individual player statistics
- **WHEN** a user requests their own word chain statistics or another player's stats
- **THEN** the system returns detailed personal metrics including total games played, total words chained, highest streak, and current leaderboard rank

#### Scenario: Empty leaderboard state
- **WHEN** a leaderboard request is made in a channel with no recorded games
- **THEN** the system returns a friendly message stating that no games have been played yet and encouraging users to start a game
