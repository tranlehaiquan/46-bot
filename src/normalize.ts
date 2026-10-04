export type IncomingMessage = {
  eventName: string;
  messageId: string;
  chatId: string;
  chatType: string;
  senderId: string;
  senderName: string;
  isBot: boolean;
  raw: unknown;
};

export function normalizeDelivery(body: unknown): IncomingMessage | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const root = body as Record<string, unknown>;
  const result = root.result;
  if (!result || typeof result !== "object") {
    return undefined;
  }
  const resultRecord = result as Record<string, unknown>;
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
  return {
    eventName,
    messageId,
    chatId: chatRecord.id,
    chatType: chatRecord.chat_type,
    senderId: fromRecord.id,
    senderName: typeof fromRecord.display_name === "string" ? fromRecord.display_name : "",
    isBot: fromRecord.is_bot === true,
    raw: body,
  };
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
