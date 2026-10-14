/**
 * Cleans outbound message text before delivery to Zalo:
 * 1. Normalizes CRLF to LF.
 * 2. Strips standalone horizontal rule dividers (e.g., ---, ***, ___, - - -, etc.)
 *    since Zalo does not render horizontal lines and they leave literal characters
 *    and excessive empty space.
 * 3. Removes trailing whitespace on each line.
 * 4. Collapses 3 or more consecutive newlines (2+ blank lines) into at most 2 newlines
 *    (1 blank line), keeping spacing compact and natural for chat apps.
 * 5. Trims leading and trailing whitespace.
 */
export function cleanOutboundText(text?: string | null): string {
  if (!text) {
    return "";
  }

  return (
    text
      // 1. Normalize line endings
      .replace(/\r\n/g, "\n")
      // 2. Remove standalone horizontal rules (lines consisting only of 3+ -, *, _, or unicode dash characters)
      .replace(/^[ \t]*([-*_—–─━])[ \t]*(?:\1[ \t]*){2,}$/gm, "")
      // 3. Remove trailing whitespace on each line (including tabs, non-breaking and zero-width spaces)
      .replace(/[ \t\u00A0\u200B]+$/gm, "")
      // 4. Collapse 3+ newlines into 2 newlines (at most one blank line between paragraphs/sections)
      .replace(/\n{3,}/g, "\n\n")
      // 5. Trim leading and trailing whitespace of the whole message
      .trim()
  );
}
