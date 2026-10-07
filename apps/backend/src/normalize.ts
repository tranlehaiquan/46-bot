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

  const photo = typeof messageRecord.photo === "string" ? messageRecord.photo : undefined;
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
  const photo =
    typeof q.photo === "string"
      ? q.photo
      : typeof q.url === "string"
        ? q.url
        : undefined;
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
