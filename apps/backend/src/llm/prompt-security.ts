/**
 * Prompt Security & Injection Defense
 *
 * Provides defense-in-depth protection against:
 * 1. Direct prompt injection (instruction override, jailbreaking)
 * 2. System prompt and confidential instruction extraction
 * 3. Delimiter collision & fake conversation turn synthesis
 * 4. Indirect injection through memory poisoning
 */

export const PROMPT_INJECTION_REFUSAL_MESSAGE =
  "Mình là Family Bot và chỉ hỗ trợ các công việc gia đình như nhắc lịch, ghi nhớ và trò chuyện thân thiện thôi nhé!";

// Signatures for direct instruction overrides & persona hijacks
const INSTRUCTION_OVERRIDE_PATTERNS = [
  /\bignore\s+(all\s+|any\s+)?(previous|prior|above|existing)\s+(instructions?|directions?|rules?|prompts?)\b/i,
  /\bdisregard\s+(all\s+|any\s+)?(previous|prior|above|existing)\s+(instructions?|directions?|rules?)\b/i,
  /\bforget\s+(all\s+|any\s+)?(previous|prior|above|existing)\s+(instructions?|directions?|rules?)\b/i,
  /\boverride\s+(all\s+|any\s+)?(previous|prior|system)\s+(instructions?|rules?|prompts?)\b/i,
  /\b(enter|switch\s+to|activate)\s+(dan|developer|unrestricted|god|jailbreak|unfiltered)\s+mode\b/i,
  /\bact\s+as\s+(an?\s+)?(evil|unrestricted|rogue|hacked|dan|jailbroken)\b/i,
  /\byou\s+(can\s+now|are\s+now\s+free\s+to|must)\s+do\s+anything\s+now\b/i,
  /\bstay\s+in\s+character\s+and\s+ignore\s+(safety|rules)\b/i,
  // Vietnamese overrides
  /(?:^|[\s,.:;!?])bỏ\s*qua\s*(các|những|mọi|tất\s*cả)?\s*(hướng\s*dẫn|chỉ\s*dẫn|chỉ\s*thị|quy\s*tắc|lệnh|câu\s*lệnh)/i,
  /(?:^|[\s,.:;!?])quên\s*(các|những|mọi|tất\s*cả)?\s*(hướng\s*dẫn|chỉ\s*dẫn|quy\s*tắc)/i,
  /không\s*cần\s*tuân\s*theo\s*(các|những|mọi)?\s*quy\s*tắc/i,
  /chế\s*độ\s*(nhà\s*phát\s*triển|bỏ\s*qua\s*kiểm\s*duyệt|không\s*giới\s*hạn)/i,
  /(?:hãy\s*)?đóng\s*vai\s*(một\s*)?(ai\s*độc\s*ác|hacker|dan\b)/i,
];

// Signatures for extracting system prompt or developer directives
const PROMPT_EXTRACTION_PATTERNS = [
  /\b(show|display|reveal|print|repeat|output|leak|dump)\s+(me\s+)?(your\s+|the\s+)?(system\s+prompt|developer\s+prompt|system\s+instructions?|initial\s+prompt|hidden\s+rules?)\b/i,
  /\bwhat\s+(is|are)\s+your\s+(initial|system|original|developer)\s+(prompt|instructions?|rules?)\b/i,
  /\brepeat\s+the\s+(text|words|instructions?)\s+(above|before)\s+(verbatim|word\s+for\s+word)\b/i,
  /\boutput\s+everything\s+above\b/i,
  // Vietnamese extraction
  /(cho\s*tôi\s*xem|hiển\s*thị|đọc\s*lại|in\s*ra|tiết\s*lộ|trích\s*xuất)\s*(toàn\s*bộ|các)?\s*(system\s*prompt|chỉ\s*dẫn\s*hệ\s*thống|lời\s*nhắc\s*hệ\s*thống|hướng\s*dẫn\s*ban\s*đầu|quy\s*tắc\s*gốc)/i,
  /nêu\s*lại\s*(toàn\s*bộ\s*)?văn\s*bản\s*(ở\s*trên|phía\s*trên)/i,
  /cho\s*biết\s*system\s*prompt\s*của\s*bạn/i,
];

// Disallowed tag patterns to prevent delimiter evasion / confusion
const DELIMITER_TAG_REGEX = /<\/?(?:user_message|system|assistant|memory_item|memory_context|untrusted_content)[^>]*>/gi;

export interface PromptSecurityCheckResult {
  isInjection: boolean;
  reason?: "instruction_override" | "prompt_extraction";
}

/**
 * Checks whether an incoming text matches known prompt injection or extraction signatures.
 */
export function detectPromptInjection(text: string | undefined | null): PromptSecurityCheckResult {
  if (!text) {
    return { isInjection: false };
  }

  // Normalize spaces and zero-width characters that attackers might use to bypass regex
  const normalized = text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  for (const pattern of INSTRUCTION_OVERRIDE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { isInjection: true, reason: "instruction_override" };
    }
  }

  for (const pattern of PROMPT_EXTRACTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return { isInjection: true, reason: "prompt_extraction" };
    }
  }

  return { isInjection: false };
}

/**
 * Sanitizes untrusted user or memory text by neutralizing XML-like boundary tags
 * so the LLM cannot be fooled by fake tags.
 */
export function sanitizePromptText(text: string | undefined | null): string {
  if (!text) return "";
  return text.replace(DELIMITER_TAG_REGEX, (tag) => `[${tag.slice(1, -1)}]`);
}

/**
 * Validates whether a memory item (subject + fact) contains prompt injection or override phrases.
 */
export function isMemorySafe(subject: string, fact: string): boolean {
  const combined = `${subject} ${fact}`;
  const check = detectPromptInjection(combined);
  return !check.isInjection;
}

/**
 * Formats a user message wrapped inside structured XML tags with sender attribute and sanitized content.
 */
export function formatUserMessageTag(sender: string, content: string): string {
  const cleanSender = sanitizePromptText(sender).replace(/"/g, "&quot;");
  const cleanContent = sanitizePromptText(content);
  return `<user_message sender="${cleanSender}">\n${cleanContent}\n</user_message>`;
}

/**
 * Formats a memory fact wrapped in structured XML tags.
 */
export function formatMemoryItemTag(subject: string, fact: string): string {
  const cleanSubject = sanitizePromptText(subject).replace(/"/g, "&quot;");
  const cleanFact = sanitizePromptText(fact);
  return `<memory_item subject="${cleanSubject}">${cleanFact}</memory_item>`;
}
