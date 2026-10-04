# long-term-memory Specification

## Purpose

Enable the family assistant to persist personal facts, traits, and preferences across conversation turns in SQLite, maintain a searchable Family Memory Book for family milestones and stories, and enforce privacy protections against storing sensitive credentials.

## Requirements

### Requirement: Storing and updating short family facts
The system SHALL provide tools for storing, updating, and removing persistent family facts in a `memories` SQLite table with columns `id`, `chat_id`, `subject`, `fact`, `created_by`, and `ts`. When saving a fact for a subject (e.g. "Bố"), if an existing fact about that subject is conflicting or nearly identical, the system SHALL update the existing fact rather than creating duplicate entries.

#### Scenario: Storing a new fact
- **WHEN** a family member says "Bố thích uống cà phê đen không đường"
- **THEN** the bot executes `remember` with subject "Bố" and fact "Thích uống cà phê đen không đường", persisting it to SQLite

#### Scenario: Updating a conflicting fact
- **WHEN** a previously saved fact for "Bé Na" says "Học lớp 3", and a user states "Bé Na năm nay lên lớp 4 rồi"
- **THEN** the existing memory entry for "Bé Na" is updated with the new fact instead of keeping both

#### Scenario: Forgetting a fact
- **WHEN** a user asks the bot to forget a fact or subject
- **THEN** the bot executes `forget` and removes matching records from the `memories` table

#### Scenario: Listing memories
- **WHEN** a user asks what the bot remembers about a person or the family
- **THEN** the bot executes `list_memories` and returns stored facts for that `chat_id`

### Requirement: Searchable Family Memory Book
The system SHALL provide a `memory_book` SQLite table with columns `id`, `chat_id`, `title`, `story`, `people`, `happened_on`, `created_by`, and `ts`. The system SHALL provide tools `memory_book_add` to record memorable events or family stories, and `memory_book_search` to find stories by keyword, people involved, or approximate date.

#### Scenario: Adding a story to Memory Book
- **WHEN** a user shares a family milestone or memory (e.g., "Chuyến đi Đà Lạt đầu tiên của cả nhà vào hè 2024")
- **THEN** the bot executes `memory_book_add` recording the title, story, people involved, and date

#### Scenario: Searching Memory Book by keyword or person
- **WHEN** a user asks "Cả nhà mình đi Đà Lạt lần đầu khi nào nhỉ?"
- **THEN** the bot executes `memory_book_search` with query "Đà Lạt", finds the matching story, and recounts the details to the family

### Requirement: Disambiguation between memory and other tools
The system prompt SHALL instruct the LLM with clear disambiguation guidelines for tool selection:
- Use `remember` for stable facts, preferences, and traits (e.g. food allergies, hobbies, shoe sizes).
- Use `event_add` for dated events, appointments, and recurring calendar celebrations (e.g. birthdays, death anniversaries, dental appointments).
- Use `list_add_item` for shopping and to-do list items.
- Use `memory_book_add` for rich family stories, past memories, and milestones.

#### Scenario: LLM chooses remember over event_add for preference
- **WHEN** a user says "Mẹ không ăn được hành tây nhé"
- **THEN** the bot calls `remember` rather than `event_add` or `list_add_item`

#### Scenario: LLM chooses memory_book_add for past story
- **WHEN** a user shares a detailed story of when the children learned to swim
- **THEN** the bot calls `memory_book_add` to preserve the story

### Requirement: Sensitive data protection
The bot SHALL NOT store passwords, bank account details, credit card numbers, or government ID numbers in memories or the memory book. When asked to remember such sensitive data, the LLM SHALL politely decline to store it for privacy and safety.

#### Scenario: Sensitive credential rejection
- **WHEN** a user says "Nhớ số thẻ visa của bố là 4111 2222..."
- **THEN** the bot declines to save the sensitive information in memory
