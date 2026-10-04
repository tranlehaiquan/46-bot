## 1. Prompt Security Core & Sanitization Utilities

- [x] 1.1 Create `src/llm/prompt-security.ts` with heuristic detection rules for instruction overrides, system prompt extraction, and jailbreaks
- [x] 1.2 Implement delimiter escaping and sanitization utilities for user text and dynamic context
- [x] 1.3 Add unit tests in `src/llm/prompt-security.test.ts` covering adversarial injection phrases, delimiter collision, and benign family queries

## 2. System Prompt & Context Framing Hardening

- [x] 2.1 Update `DEFAULT_SYSTEM_PROMPT` in `src/llm/client.ts` with strict instruction hierarchy, delimiter explanation, and prompt confidentiality rules
- [x] 2.2 Update `formatMemoriesSection` and `buildSystemPrompt` to wrap memory items in `<memory_context>` with sanitized subjects and facts
- [x] 2.3 Update `generateReply` in `src/llm/client.ts` to encapsulate chat history and incoming user turns inside structured `<user_message>` XML delimiters
- [x] 2.4 Update `src/llm/client.test.ts` to verify structured prompt framing and memory formatting

## 3. Memory Tool Security & Storage Validation

- [x] 3.1 Enhance `remember` and `memory_book_add` validation in `src/llm/tools/memory.ts` to reject prompt injection attempts before persisting to database
- [x] 3.2 Add unit tests in `src/llm/tools/memory.test.ts` verifying rejection of injection payloads in memory facts

## 4. Webhook Pipeline Integration & Verification

- [ ] 4.1 Integrate prompt security pre-filter in `src/webhook/llm-reply.ts` (or `src/webhook/group-discovery.ts`) to return safe standard refusal without calling LLM
- [ ] 4.2 Add integration tests for prompt injection refusal in webhook handler tests
- [ ] 4.3 Run full test suite (`pnpm test`) and frontend verification to ensure complete system stability
