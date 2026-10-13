## Why

Currently, memory retrieval in `46-bot` is bifurcated and simplistic: `list_memories` searches the `memories` table via basic SQL LIKE matching, while `memory_book_search` searches the `memory_book` table separately. There is no unified search interface that can query across both durable facts (e.g. dietary restrictions, health, traits) and memory book stories (milestones, family trip narratives), nor does the current matching account for token scoring, exact phrase boosting, or Vietnamese diacritics insensitivity.

Inspired by OpenClaw's memory retrieval architecture, introducing hybrid memory search enables family members and the agent to find relevant context using a unified `memory_search` tool with ranked relevance scoring, query tokenization, and multi-source aggregation.

## What Changes

- **Unified Memory Search Tool (`memory_search`)**: Expose a single unified tool to search across both durable facts (`memories`) and family stories (`memory_book`), with optional filtering by type (`all`, `facts`, `stories`), subject, or category.
- **Ranked Lexical & Hybrid Scoring**: Implement a lightweight scoring algorithm combining exact phrase match boost, multi-token overlap scoring, Vietnamese diacritics-insensitive matching, and `core` category weighting.
- **Repository Search Enhancements**: Extend `MemoryRepository` with a unified `searchAll` method that aggregates and scores candidates across both memories and memory book rows.
- **Backward Compatibility**: Preserve existing `list_memories` and `memory_book_search` tools while augmenting them with improved search ranking capabilities.

## Capabilities

### New Capabilities
- `hybrid-memory-search`: Unified multi-source memory retrieval combining durable facts and memory book stories with ranked lexical scoring and Vietnamese diacritic normalization.

### Modified Capabilities
- `long-term-memory`: Augments memory tool suite with `memory_search` for unified contextual recall across both facts and stories.

## Impact

- **Database / Repository**: `MemoryRepository` in `apps/backend/src/db/repositories/memory.ts` gets `searchAll` method.
- **LLM Tool Suite**: `apps/backend/src/tools/memory.ts` exports `memory_search` tool alongside existing tools.
- **Prompt & Conversational Delivery**: Bot can retrieve relevant background facts and rich family stories in a single tool call.
