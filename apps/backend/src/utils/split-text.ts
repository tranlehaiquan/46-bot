export function splitText(text: string, maxLength = 2000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try finding good split points within the first maxLength characters
    const slice = remaining.slice(0, maxLength);

    // 1. Double newline
    let splitIdx = slice.lastIndexOf("\n\n");
    if (splitIdx > 0) {
      chunks.push(remaining.slice(0, splitIdx).trimEnd());
      remaining = remaining.slice(splitIdx + 2).trimStart();
      continue;
    }

    // 2. Single newline
    splitIdx = slice.lastIndexOf("\n");
    if (splitIdx > 0) {
      chunks.push(remaining.slice(0, splitIdx).trimEnd());
      remaining = remaining.slice(splitIdx + 1).trimStart();
      continue;
    }

    // 3. Sentence boundaries (. ! ?)
    const sentenceMatch = slice.match(/([.!?])\s+(?=[^.!?]*$)/);
    if (sentenceMatch && sentenceMatch.index !== undefined && sentenceMatch.index > 0) {
      splitIdx = sentenceMatch.index + 1;
      chunks.push(remaining.slice(0, splitIdx).trimEnd());
      remaining = remaining.slice(splitIdx).trimStart();
      continue;
    }

    // 4. Space
    splitIdx = slice.lastIndexOf(" ");
    if (splitIdx > 0) {
      chunks.push(remaining.slice(0, splitIdx).trimEnd());
      remaining = remaining.slice(splitIdx + 1).trimStart();
      continue;
    }

    // 5. Hard break
    chunks.push(remaining.slice(0, maxLength));
    remaining = remaining.slice(maxLength);
  }

  return chunks.filter((c) => c.length > 0);
}
