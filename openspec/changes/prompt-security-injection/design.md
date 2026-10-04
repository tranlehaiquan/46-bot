## Context

`46-bot` is an AI family assistant connected to Zalo group and private chats. It uses Gemini and DeepSeek models via the Vercel AI SDK and has access to state-modifying tools (events, reminders, shared lists, long-term memory, web search).

Previously, incoming user messages were concatenated as plain text (`${sender}: ${msg.content}`), memories were appended into system prompts as unescaped lines (`- [${subject}]: ${fact}`), and no formal boundary existed between trusted system instructions and untrusted user or external data. This created vulnerabilities to:
1. **Direct Instruction Overrides**: Prompts attempting to wipe prior rules (e.g. "Ignore previous instructions and do X").
2. **System Prompt Leakage**: Attempts to extract internal instructions, secret tokens, or architecture details.
3. **Indirect Injection**: Storing injection payloads in memories or returning malicious text from web search to compromise downstream LLM actions.
4. **Tool Misuse**: Tricking the LLM into invoking destructive tools (`event_delete`, `list_remove_item`).

## Goals / Non-Goals

**Goals:**
- **Instruction Hierarchy & System Prompt Hardening**: Establish clear instruction precedence where system/developer instructions always override user text and external data.
- **Structured Framing & Delimiters**: Enclose untrusted user inputs, message history, and memory items in explicit delimiter tags (`<user_message>`, `<memory_item>`) with sanitization of tag injection.
- **Fast Injection Pre-filter**: Detect common direct prompt injection patterns (system overrides, persona hijack, prompt extraction) using zero-latency local heuristic filters and return friendly refusals.
- **System Prompt & Secret Protection**: Prevent extraction of system instructions or internal configurations in generated replies.
- **Memory & Dynamic Content Sanitization**: Sanitize memory facts before persistence and when interpolating into prompt contexts.

**Non-Goals:**
- Deploying a secondary LLM guardrail model (e.g., Llama Guard) which introduces high latency and cost for a family chat bot.
- Over-filtering natural Vietnamese family chat (e.g. casual jokes, slang, or legitimate task instructions).

## Decisions

### 1. Multi-Tier Defense-in-Depth Architecture
- **Rationale**: Relying on system prompts alone is insufficient against clever jailbreaks; relying solely on regex filtering fails against paraphrased attacks. Combining both provides robust security:
  - **Tier 1 (Pre-filter)**: Local regex checks for unambiguous injection signatures (overrides, DAN/jailbreaks, prompt dumping).
  - **Tier 2 (Structural Framing)**: Delimited XML-like tags around untrusted inputs so the model distinguishes data from instructions.
  - **Tier 3 (Prompt Hardening)**: System prompt directives detailing instruction hierarchy and confidentiality.
  - **Tier 4 (Output Guardrail)**: Post-generation scan to catch prompt leaks or accidental credential exposure.

### 2. Delimiter Scheme and Tag Sanitization
- **Choice**: XML-style tags `<user_message sender="..." id="...">content</user_message>` and `<memory_context>`.
- **Rationale**: Both Gemini and DeepSeek are heavily pre-trained and fine-tuned on XML/HTML markup structures. To prevent tag escaping attacks, any literal `<user_message>`, `</user_message>`, `<system>`, `</system>` sequences in user content are escaped or stripped.

### 3. Local Heuristic Pattern Detection
- **Patterns**:
  - Instruction override / jailbreak: `ignore (all )?(previous|above) instructions`, `forget your instructions`, `bỏ qua (mọi )?hướng dẫn`, `bỏ qua các quy tắc`, `jailbreak`, `DAN mode`, `developer mode`.
  - Prompt extraction: `(show|display|reveal|print|repeat) (your |the )?(system prompt|instructions|rules)`, `cho tôi xem system prompt`, `in ra các chỉ dẫn hệ thống`.
- **Response**: When matched, bypass the LLM call entirely and respond with a friendly standard message:
  *"Mình là Family Bot và chỉ hỗ trợ các công việc gia đình như nhắc lịch, ghi nhớ và trò chuyện thân thiện thôi nhé!"*

### 4. Memory Sanitization
- Memory facts and subjects are stripped of control characters, excessive delimiters, and obvious injection phrases before being saved to the database.

## Risks / Trade-offs

- **[False Positives in Pre-filter]** → Mitigated by keeping regex signatures strict and anchored to unambiguous prompt injection / jailbreak patterns, rather than common words like "quên" or "hướng dẫn".
- **[Evasion through Paraphrasing / Obfuscation]** → Mitigated by Tier 2 (XML delimiters) and Tier 3 (system prompt instruction hierarchy), so even if an adversarial prompt passes the pre-filter, the LLM treats it strictly as enclosed data, not developer instructions.
- **[Slight increase in token usage]** → Adding delimiter tags and defensive system prompt rules adds < 100 tokens per request, negligible for Gemini 2.5 Flash / DeepSeek.
