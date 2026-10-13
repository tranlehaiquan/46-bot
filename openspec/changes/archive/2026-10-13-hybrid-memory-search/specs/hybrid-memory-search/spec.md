## ADDED Requirements

### Requirement: Unified multi-source memory search
The system SHALL provide a unified `memory_search` tool that queries across both the `memories` table (durable facts) and the `memory_book` table (family milestones and stories). The tool SHALL accept a `query` string, an optional `type` filter (`"all"` | `"facts"` | `"stories"`, defaulting to `"all"`), an optional `subject` filter, and an optional result `limit` (defaulting to 10).

#### Scenario: Searching both facts and stories simultaneously
- **WHEN** a user asks "Cả nhà mình có kỷ niệm hay sở thích gì liên quan đến Đà Lạt không?"
- **THEN** the bot executes `memory_search` with query "Đà Lạt" and type "all", returning matching durable facts and memory book stories unified and sorted by relevance score

#### Scenario: Filtering search to durable facts only
- **WHEN** a user asks specifically about dietary facts with `type="facts"`
- **THEN** the `memory_search` tool returns only records from `memories`

#### Scenario: Filtering search to memory book stories only
- **WHEN** a user asks specifically about trip stories with `type="stories"`
- **THEN** the `memory_search` tool returns only records from `memory_book`

### Requirement: Ranked lexical scoring and diacritics normalization
The system SHALL score and rank search candidates using lexical relevance:
1. Exact whole-phrase matches receive top priority score.
2. Token overlap matches score proportionally to the number of query tokens present.
3. Matching in `subject` or `title` receives higher weight than matching in body text.
4. Vietnamese diacritic-insensitive normalization (e.g. "ca phe" matches "cà phê") is supported so colloquial queries match accurately.
5. `core` category memories receive an additional boost over `general` memories.

#### Scenario: Exact phrase match ranked higher than partial match
- **WHEN** a query is "cà phê đen" and candidate A contains "thích cà phê đen không đường" while candidate B contains "thích màu đen",
- **THEN** candidate A is ranked above candidate B

#### Scenario: Diacritic-insensitive matching
- **WHEN** a user queries "da lat" without accents
- **THEN** memories containing "Đà Lạt" are retrieved and ranked

### Requirement: Structured search result formatting
Each returned item in `memory_search` SHALL include a discriminator `type` (`"fact"` | `"story"`), an identifier `id`, the `title` or `subject`, the `content` (fact text or story excerpt), relevant metadata (`category` or `people`/`happenedOn`), and a computed `score`.

#### Scenario: Formatted search response
- **WHEN** `memory_search` matches one fact and one story
- **THEN** the result array contains two structured objects with clear type tags and content descriptions for LLM consumption
