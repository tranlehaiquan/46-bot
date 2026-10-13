## MODIFIED Requirements

### Requirement: Storing and updating short family facts
The system SHALL provide tools for storing, updating, and removing persistent family facts in a `memories` SQLite table with columns `id`, `chat_id`, `subject`, `fact`, `category` ('core' | 'general'), `status` ('active' | 'superseded'), `created_by`, and `ts`. When saving a fact for a subject (e.g. "Bố"), if an existing fact about that subject is conflicting or superseded, the system SHALL update the existing fact or mark the previous fact as superseded rather than creating duplicate active entries.

#### Scenario: Storing a new fact
- **WHEN** a family member says "Bố thích uống cà phê đen không đường"
- **THEN** the bot executes `remember` with subject "Bố", fact "Thích uống cà phê đen không đường", and category "core", persisting it to SQLite with status "active"

#### Scenario: Updating or superseding a fact
- **WHEN** a previously saved fact for "Bé Na" says "Học lớp 3", and a user states "Bé Na năm nay lên lớp 4 rồi"
- **THEN** the existing memory entry for "Bé Na" is updated or superseded with the new fact instead of keeping conflicting active entries

#### Scenario: Forgetting a fact
- **WHEN** a user asks the bot to forget a fact or subject
- **THEN** the bot executes `forget` and removes or deactivates matching records from the `memories` table

#### Scenario: Listing memories
- **WHEN** a user asks what the bot remembers about a person or the family
- **THEN** the bot executes `list_memories` and returns stored facts for that `chat_id`, optionally filtered by category or subject

## ADDED Requirements

### Requirement: On-demand memory retrieval and search
The system SHALL provide tools for searching and retrieving stored facts on demand when they are not loaded in the system prompt budget.

#### Scenario: Looking up non-core fact on demand
- **WHEN** a user asks about a secondary detail not loaded in the prompt budget
- **THEN** the bot invokes memory lookup tools to find the relevant fact from the database and answers the user accurately
