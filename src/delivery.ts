import type { AppConfig } from "./config.js";
import type { ListRepository } from "./db/list-repo.js";
import type { MessageRepository } from "./db/message-repo.js";
import type { EventsRepository } from "./db/repositories/events.js";
import type { MemoryRepository } from "./db/repositories/memory.js";
import type { SeenRepository } from "./db/seen-repo.js";
import { FALLBACK_ERROR_MESSAGE, type LlmClient } from "./llm/client.js";
import type { Logger } from "./logger.js";
import { isMentionedOrReplied, normalizeDelivery } from "./normalize.js";
import { createEventTools } from "./tools/events.js";
import { createHolidayTools } from "./tools/holidays.js";
import { createListTools } from "./tools/lists.js";
import { createMemoryTools } from "./tools/memory.js";
import { createWebSearchTool } from "./tools/web-search.js";
import { splitText } from "./utils/split-text.js";
import type { ZaloClient } from "./zalo-client.js";

export const CANNED_REPLY = "Mình nhận được.";
export const ONBOARDING_MESSAGE_PREFIX = "Nhóm này chưa nằm trong danh sách cho phép. Vui lòng thêm chat ID";
export function getOnboardingMessage(chatId: string): string {
  return `Nhóm này chưa nằm trong danh sách cho phép. Vui lòng thêm chat ID "${chatId}" vào FAMILY_CHAT_IDS để kích hoạt bot nhé.`;
}

export type DeliveryDependencies = {
  payload: Buffer | undefined;
  config: AppConfig;
  log: Logger;
  zalo: ZaloClient;
  seenRepo?: SeenRepository;
  messageRepo?: MessageRepository;
  listRepo?: ListRepository;
  eventsRepo?: EventsRepository;
  memoryRepo?: MemoryRepository;
  llmClient?: LlmClient;
  seen?: Set<string>;
};

export async function handleDelivery(input: DeliveryDependencies): Promise<void> {
  const { payload, config, log, zalo, seenRepo, messageRepo, listRepo, eventsRepo, memoryRepo, llmClient, seen } = input;
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
    if (config.familyChatIds.length === 0) {
      log.info({ event: "unrecognized_delivery", raw: parsed });
    } else {
      log.info({ event: "unrecognized_delivery" });
    }
    return;
  }

  if (config.familyChatIds.length === 0) {
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
  const isGroup = message.chatType === "GROUP";

  if (!isDirect && !isGroup) {
    return;
  }

  const isAddressed = isDirect || isMentionedOrReplied(message, config.botId);

  // In groups, only respond if mentioned or replying to bot
  if (isGroup && !isAddressed) {
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

  // If group is not in familyChatIds (new or unlisted group), reply with onboarding notice
  const isAllowedGroup = isGroup && config.familyChatIds.includes(message.chatId);
  if (isGroup && !isAllowedGroup) {
    await zalo.sendMessage(message.chatId, getOnboardingMessage(message.chatId));
    return;
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

    const eventTools = eventsRepo
      ? createEventTools(eventsRepo, {
          chatId: message.chatId,
          senderName: message.senderName || message.senderId,
        })
      : undefined;

    const holidayTools = createHolidayTools(eventsRepo, {
      chatId: message.chatId,
      senderName: message.senderName || message.senderId,
    });

    const searchTools = config.tavilyApiKey
      ? createWebSearchTool(config.tavilyApiKey)
      : undefined;

    const memoryTools = memoryRepo
      ? createMemoryTools(memoryRepo, {
          chatId: message.chatId,
          senderName: message.senderName || message.senderId,
        })
      : undefined;

    const tools =
      listTools || eventTools || holidayTools || searchTools || memoryTools
        ? { ...listTools, ...eventTools, ...holidayTools, ...searchTools, ...memoryTools }
        : undefined;

    const memories = memoryRepo ? memoryRepo.listMemories(message.chatId) : undefined;

    let replyText: string;
    try {
      replyText = await llmClient.generateReply({
        memories,
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
