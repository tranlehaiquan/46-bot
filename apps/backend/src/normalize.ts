export type Mention = {
  uid: string;
  pos?: number;
  len?: number;
};

export type QuotedMessage = {
  messageId?: string;
  fromId?: string;
  fromName?: string;
  isBot?: boolean;
  text?: string;
  photo?: string;
};

export type IncomingMessage = {
  eventName: string;
  messageId: string;
  chatId: string;
  chatType: string;
  senderId: string;
  senderName: string;
  isBot: boolean;
  text: string;
  photo?: string;
  caption?: string;
  mentions: Mention[];
  quote?: QuotedMessage;
  raw: unknown;
};

export function extractPhotoUrl(record: Record<string, unknown> | undefined): string | undefined {
  if (!record) {
    return undefined;
  }
  if (typeof record.photo === "string" && record.photo.trim().length > 0) {
    return record.photo.trim();
  }
  if (typeof record.url === "string" && record.url.trim().length > 0) {
    return record.url.trim();
  }
  if (typeof record.image === "string" && record.image.trim().length > 0) {
    return record.image.trim();
  }
  if (typeof record.media_url === "string" && record.media_url.trim().length > 0) {
    return record.media_url.trim();
  }
  if (typeof record.href === "string" && record.href.trim().length > 0) {
    return record.href.trim();
  }
  if (Array.isArray(record.attachments) && record.attachments.length > 0) {
    const first = record.attachments[0];
    if (typeof first === "string" && first.trim().length > 0) {
      return first.trim();
    }
    if (first && typeof first === "object") {
      const firstRec = first as Record<string, unknown>;
      if (typeof firstRec.url === "string" && firstRec.url.trim().length > 0) {
        return firstRec.url.trim();
      }
      if (typeof firstRec.photo === "string" && firstRec.photo.trim().length > 0) {
        return firstRec.photo.trim();
      }
      if (typeof firstRec.src === "string" && firstRec.src.trim().length > 0) {
        return firstRec.src.trim();
      }
      if (firstRec.payload && typeof firstRec.payload === "object") {
        const payloadRec = firstRec.payload as Record<string, unknown>;
        if (typeof payloadRec.url === "string" && payloadRec.url.trim().length > 0) {
          return payloadRec.url.trim();
        }
        if (typeof payloadRec.photo === "string" && payloadRec.photo.trim().length > 0) {
          return payloadRec.photo.trim();
        }
      }
    }
  }
  if (record.photo && typeof record.photo === "object") {
    const photoRec = record.photo as Record<string, unknown>;
    if (typeof photoRec.url === "string" && photoRec.url.trim().length > 0) {
      return photoRec.url.trim();
    }
  }
  return undefined;
}

export function normalizeDelivery(body: unknown): IncomingMessage | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const root = body as Record<string, unknown>;
  const resultRecord = eventRecord(root);
  if (!resultRecord) {
    return undefined;
  }
  const eventName = resultRecord.event_name;
  const message = resultRecord.message;
  if (typeof eventName !== "string" || !message || typeof message !== "object") {
    return undefined;
  }
  const messageRecord = message as Record<string, unknown>;
  const messageId = messageIdOf(messageRecord.message_id);
  const chat = messageRecord.chat;
  const from = messageRecord.from;
  if (!messageId || !chat || typeof chat !== "object" || !from || typeof from !== "object") {
    return undefined;
  }
  const chatRecord = chat as Record<string, unknown>;
  const fromRecord = from as Record<string, unknown>;
  if (typeof chatRecord.id !== "string" || typeof chatRecord.chat_type !== "string") {
    return undefined;
  }
  if (typeof fromRecord.id !== "string") {
    return undefined;
  }

  const photo = extractPhotoUrl(messageRecord);
  const caption = typeof messageRecord.caption === "string" ? messageRecord.caption : undefined;
  const text = typeof messageRecord.text === "string" && messageRecord.text.length > 0
    ? messageRecord.text
    : caption ?? "";
  const mentions = parseMentions(messageRecord.mentions);
  const quote = parseQuote(messageRecord.quote ?? messageRecord.reply_to ?? messageRecord.reply_to_message);

  return {
    eventName,
    messageId,
    chatId: chatRecord.id,
    chatType: chatRecord.chat_type,
    senderId: fromRecord.id,
    senderName: typeof fromRecord.display_name === "string" ? fromRecord.display_name : "",
    isBot: fromRecord.is_bot === true,
    text,
    photo,
    caption,
    mentions,
    quote,
    raw: body,
  };
}

export function isMentionedOrReplied(message: IncomingMessage, botId?: string): boolean {
  if (message.chatType === "PRIVATE") {
    return true;
  }

  // Check quote/reply
  if (message.quote) {
    if (message.quote.isBot) {
      return true;
    }
    if (botId && message.quote.fromId === botId) {
      return true;
    }
    if (!botId && message.quote.fromId !== undefined) {
      return true;
    }
  }

  // Check mentions
  if (message.mentions.length > 0) {
    if (botId) {
      return message.mentions.some((m) => m.uid === botId || m.uid === "bot");
    }
    return true;
  }

  // Fallback: check @ in text or caption
  if (message.text.includes("@") || (message.caption && message.caption.includes("@"))) {
    return true;
  }

  return false;
}

function parseMentions(rawMentions: unknown): Mention[] {
  if (!Array.isArray(rawMentions)) {
    return [];
  }
  const mentions: Mention[] = [];
  for (const item of rawMentions) {
    if (typeof item === "string" && item.length > 0) {
      mentions.push({ uid: item });
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const uid = typeof obj.uid === "string" ? obj.uid : typeof obj.user_id === "string" ? obj.user_id : undefined;
      if (uid) {
        mentions.push({
          uid,
          pos: typeof obj.pos === "number" ? obj.pos : undefined,
          len: typeof obj.len === "number" ? obj.len : undefined,
        });
      }
    }
  }
  return mentions;
}

function parseQuote(rawQuote: unknown): QuotedMessage | undefined {
  if (!rawQuote || typeof rawQuote !== "object") {
    return undefined;
  }
  const q = rawQuote as Record<string, unknown>;
  const from = q.from as Record<string, unknown> | undefined;
  const photo = extractPhotoUrl(q) ?? (from ? extractPhotoUrl(from) : undefined);
  const text =
    typeof q.text === "string"
      ? q.text
      : typeof q.caption === "string"
        ? q.caption
        : undefined;

  return {
    messageId: messageIdOf(q.message_id),
    fromId: from && typeof from.id === "string" ? from.id : typeof q.from_id === "string" ? q.from_id : undefined,
    fromName: from && typeof from.display_name === "string" ? from.display_name : undefined,
    isBot: from?.is_bot === true || q.is_bot === true,
    text,
    photo,
  };
}

function eventRecord(root: Record<string, unknown>): Record<string, unknown> | undefined {
  if (typeof root.event_name === "string") {
    return root;
  }
  const result = root.result;
  if (result && typeof result === "object") {
    return result as Record<string, unknown>;
  }
  return undefined;
}

function messageIdOf(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}
