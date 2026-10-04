## Why

Family Bot operates in group chats where messages come from multiple participants, and dynamic context (such as stored memories and web search results) is injected directly into LLM prompts. Without explicit defense mechanisms, the system is susceptible to prompt injection attacks, instruction override attempts, jailbreaks, system prompt extraction, and indirect injection through poisoned memories or external content. Hardening the prompt architecture ensures the assistant remains reliable, preserves user privacy, and adheres strictly to its intended family-assistant persona.

## What Changes

- **System Prompt Hardening & Instruction Hierarchy**: Update system prompt with clear instruction priority (developer/system directives always supersede user and external data), explicit anti-jailbreak directives, and rules preventing system prompt or configuration leakage.
- **Structured Context Framing & Delimiters**: Encase dynamic and untrusted user messages, conversation history, and memory items in explicit delimiter tags (such as `<user_input>` and `<memory_context>`) to prevent the model from confusing external data with system instructions.
- **Input Pre-check & Injection Filtering**: Introduce a lightweight prompt security pre-check to detect blatant prompt injection attacks (such as "ignore all previous instructions", prompt dumping, persona hijacking) and return safe, friendly refusal responses without wasting LLM tokens.
- **Memory & Dynamic Data Sanitization**: Sanitize memory items before storage and when formatting memories into prompts to neutralize delimiter evasion and command-injection patterns.
- **Output Guardrails**: Post-process or verify model outputs to ensure internal system instructions or sensitive tokens are not inadvertently leaked in responses.

## Capabilities

### New Capabilities
- `prompt-security`: Prompt injection detection, input/memory boundary sanitization, instruction hierarchy enforcement, and system prompt leakage protection.

### Modified Capabilities
- `llm-conversation`: Update LLM prompt building and history formatting to use structured delimiter framing and integrate prompt security checks into the reply pipeline.

## Impact

- **Affected Code**: `src/llm/client.ts`, `src/llm/prompt-security.ts` (new), `src/llm/tools/memory.ts`, and conversation handler in `src/webhook/group-discovery.ts` / `src/webhook/llm-reply.ts`.
- **Dependencies**: No external network dependencies; uses fast local regex/heuristic-based pattern matching and structured prompt formatting.
- **APIs & Schema**: Internal LLM client interface updated to support security checks; existing external chat webhook and admin APIs remain backward-compatible.
