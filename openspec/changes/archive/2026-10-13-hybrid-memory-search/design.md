## Context

`46-bot` maintains persistent family facts in `memories` and detailed stories in `memory_book`. Previously, finding information required knowing whether to call `list_memories` or `memory_book_search`. Furthermore, SQL `LIKE` queries failed on unaccented Vietnamese inputs (e.g., searching "ca phe" didn't match "cà phê") and offered no relevance ranking.

## Goals / Non-Goals

**Goals:**
- Provide a unified `memory_search` AI tool that queries both `memories` and `memory_book`.
- Provide ranked scoring that rewards exact phrase matches, token matches in key fields (subject/title), and `core` memory priority.
- Support diacritics-insensitive matching for Vietnamese text without requiring third-party search engines or compiled FTS5 extensions.
- Support source filtering (`all`, `facts`, `stories`) and subject filtering.

**Non-Goals:**
- External vector database / embedding model integration (avoiding external API latency and cost for family-scale data).
- Modifying SQLite schema or table layouts (operates entirely on existing schema).

## Decisions

1. **Lightweight In-Process Lexical Scoring**:
   - *Decision*: Retrieve candidates matching query tokens via SQL `LIKE`, then rank them using an in-memory scoring function.
   - *Rationale*: For family chat groups with hundreds of memory records, SQL token candidates plus in-memory ranking executes in < 2ms without requiring external dependencies, FTS5 builds, or vector embeddings.
   - *Alternative Considered*: External embedding search (OpenAI / Cohere embeddings). Rejected due to cold-start API latency, network dependency, and recurring cost.

2. **Vietnamese Diacritics Normalization**:
   - *Decision*: Normalize both query tokens and candidate texts with Vietnamese diacritic removal (`NFD` normalization with regex replacements for `đ`, `ơ`, `ư`, etc.) in addition to direct diacritic comparison.
   - *Rationale*: Family members frequently type without accents on mobile keyboards (e.g. "di da lat" instead of "đi Đà Lạt").

3. **Unified Result Schema**:
   - *Decision*: Return unified objects with `{ type: "fact" | "story", id, subject, content, score, category?, people?, happenedOn? }`.
   - *Rationale*: Allows the LLM to understand both the source and the nature of each hit in a single prompt block.

## Risks / Trade-offs

- **[Large dataset scaling]** → If memory grows to tens of thousands of rows, SQL LIKE token fetching may slow down. Mitigation: Group chats have limited bounds (< 1,000 entries); candidate fetching is indexed by `chatId`.
- **[Token noise on very short words]** → Short common words like "là", "và", "của" could inflate partial match scores. Mitigation: Filter out stop words / tokens of length <= 1 from multi-token scoring.
