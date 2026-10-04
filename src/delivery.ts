import type { AppConfig } from "./config.js";
import type { Logger } from "./logger.js";
import { normalizeDelivery } from "./normalize.js";
import type { ZaloClient } from "./zalo-client.js";

export const CANNED_REPLY = "Mình nhận được.";

export async function handleDelivery(input: {
  payload: Buffer | undefined;
  config: AppConfig;
  log: Logger;
  zalo: ZaloClient;
  seen: Set<string>;
}): Promise<void> {
  const { payload, config, log, zalo, seen } = input;
  if (!payload || payload.length === 0) {
    log.info({ event: "unrecognized_delivery" });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload.toString("utf8")) as unknown;
  } catch {
    log.info({ event: "unrecognized_delivery" });
    return;
  }

  const message = normalizeDelivery(parsed);
  if (!message) {
    if (config.familyChatId === "") {
      log.info({ event: "unrecognized_delivery", raw: parsed });
    } else {
      log.info({ event: "unrecognized_delivery" });
    }
    return;
  }

  if (config.familyChatId === "") {
    log.info({
      event: "discovery",
      chat_id: message.chatId,
      chat_type: message.chatType,
      sender_id: message.senderId,
      sender_name: message.senderName,
      message_id: message.messageId,
      raw: message.raw,
    });
  } else {
    log.info({
      event: "delivery",
      event_name: message.eventName,
      chat_id: message.chatId,
      chat_type: message.chatType,
      sender_id: message.senderId,
      message_id: message.messageId,
    });
  }

  if (message.eventName !== "message.text.received" || message.isBot) {
    return;
  }
  const isDirect = message.chatType === "PRIVATE";
  const isFamilyGroup = message.chatType === "GROUP" && message.chatId === config.familyChatId;
  if (!isDirect && !isFamilyGroup) {
    return;
  }
  if (seen.has(message.messageId)) {
    return;
  }
  await zalo.sendMessage(message.chatId, CANNED_REPLY);
  seen.add(message.messageId);
}
