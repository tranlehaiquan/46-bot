import type { AppConfig } from "./config.js";
import type { ListRepository } from "./db/list-repo.js";
import type { MessageRepository } from "./db/message-repo.js";
import type { SeenRepository } from "./db/seen-repo.js";
import { FALLBACK_ERROR_MESSAGE, type LlmClient } from "./llm/client.js";
import type { Logger } from "./logger.js";
import { isMentionedOrReplied, normalizeDelivery } from "./normalize.js";
import { createListTools } from "./tools/lists.js";
import { createWebSearchTool } from "./tools/web-search.js";
import { splitText } from "./utils/split-text.js";
import type { ZaloClient } from "./zalo-client.js";

export const CANNED_REPLY = "Mình nhận được.";

export type DeliveryDependencies = {
  payload: Buffer | undefined;
  config: AppConfig;
  log: Logger;
  zalo: ZaloClient;
  seenRepo?: SeenRepository;
  messageRepo?: MessageRepository;
  listRepo?: ListRepository;
  llmClient?: LlmClient;
  seen?: Set<string>;
};

export async function handleDelivery(input: DeliveryDependencies): Promise<void> {
  const { payload, config, log, zalo, seenRepo, messageRepo, listRepo, llmClient, seen } = input;
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
  const isAllowedGroup =
    message.chatType === "GROUP" &&
    (config.familyChatId === "" || message.chatId === config.familyChatId);

  if (!isDirect && !isAllowedGroup) {
    return;
  }

  // In groups, only reply if mentioned or replying to bot
  if (message.chatType === "GROUP" && config.familyChatId !== "" && !isMentionedOrReplied(message, config.botId)) {
    return;
  }

  // Deduplication
  if (seenRepo) {
    if (seenRepo.hasSeen(message.messageId)) {
      return;
    }
    seenRepo.markSeen(message.messageId);
  } else if (seen) {
    if (seen.has(message.messageId)) {
      return;
    }
    seen.add(message.messageId);
  }

  // Reply generation
  if (llmClient) {
    if (typeof zalo.sendChatAction === "function") {
      try {
        await zalo.sendChatAction(message.chatId, "typing");
      } catch {
        // Typing failure should never block message generation
      }
    }

    const history = messageRepo ? messageRepo.getRecent(message.chatId, 20) : [];

    if (messageRepo) {
      messageRepo.insert({
        chatId: message.chatId,
        senderId: message.senderId,
        senderName: message.senderName,
        role: "user",
        content: message.text,
      });
    }

    const listTools = listRepo
      ? createListTools(listRepo, {
          chatId: message.chatId,
          senderName: message.senderName || message.senderId,
        })
      : undefined;

    const searchTools = config.tavilyApiKey
      ? createWebSearchTool(config.tavilyApiKey)
      : undefined;

    const tools =
      listTools || searchTools ? { ...listTools, ...searchTools } : undefined;

    let replyText: string;
    try {
      replyText = await llmClient.generateReply({
        history,
        incomingMessage: {
          senderId: message.senderId,
          senderName: message.senderName,
          content: message.text,
        },
        tools,
      });
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      log.error({ event: "llm_error", message: errMessage });
      replyText = FALLBACK_ERROR_MESSAGE;
    }

    const chunks = splitText(replyText, 2000);
    for (const chunk of chunks) {
      await zalo.sendMessage(message.chatId, chunk);
    }

    if (messageRepo) {
      messageRepo.insert({
        chatId: message.chatId,
        senderId: "bot",
        senderName: "Family Bot",
        role: "assistant",
        content: replyText,
      });
    }
  } else {
    // If no LLM configured (fallback / canned mode)
    await zalo.sendMessage(message.chatId, CANNED_REPLY);
  }
}
