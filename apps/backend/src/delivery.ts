import type { AppConfig } from "./config.js";
import type { ListRepository } from "./db/list-repo.js";
import type { MessageRepository } from "./db/message-repo.js";
import type { EventsRepository } from "./db/repositories/events.js";
import type { MemoryRepository } from "./db/repositories/memory.js";
import type { ChannelRepository } from "./db/repositories/channels.js";
import type { LookupRepository } from "./db/repositories/lookups.js";
import type { SeenRepository } from "./db/seen-repo.js";
import { FALLBACK_ERROR_MESSAGE, type LlmClient } from "./llm/client.js";
import {
  detectPromptInjection,
  PROMPT_INJECTION_REFUSAL_MESSAGE,
} from "./llm/prompt-security.js";
import type { Logger } from "./logger.js";
import { isMentionedOrReplied, normalizeDelivery, type IncomingMessage } from "./normalize.js";
import { createEventTools } from "./tools/events.js";
import { createHolidayTools } from "./tools/holidays.js";
import { createListTools } from "./tools/lists.js";
import { createLookupTools } from "./tools/lookups.js";
import { createMemoryTools } from "./tools/memory.js";
import { createWeatherTool } from "./tools/weather.js";
import { createWebSearchTool } from "./tools/web-search.js";
import { splitText } from "./utils/split-text.js";
import type { ZaloClient } from "./zalo-client.js";
import { getEventsImageDir } from "./server.js";

export const CANNED_REPLY = "Mình nhận được.";
export const ONBOARDING_MESSAGE_PREFIX = "Nhóm này chưa nằm trong danh sách cho phép. Vui lòng thêm chat ID";
export function getOnboardingMessage(chatId: string): string {
  return `Nhóm này chưa nằm trong danh sách cho phép. Vui lòng thêm chat ID "${chatId}" vào FAMILY_CHAT_IDS để kích hoạt bot nhé.`;
}
export function getPendingApprovalMessage(chatId: string): string {
  return `Kênh/nhóm này đang chờ quản trị viên phê duyệt trên Dashboard (chat ID "${chatId}").`;
}
export function getChannelActivatedMessage(): string {
  return "Kênh/nhóm này đã được quản trị viên phê duyệt. Bạn có thể bắt đầu trò chuyện với bot nhé.";
}

export function formatIncomingText(message: IncomingMessage): string {
  if (!message.quote) {
    return message.text;
  }
  const quoteSender = message.quote.fromName || (message.quote.isBot ? "Bot" : "thành viên");
  const quoteSnippet = message.quote.text
    ? `"${message.quote.text}"`
    : (message.quote.photo ? "[Hình ảnh]" : "");
  if (!quoteSnippet) {
    return message.text;
  }
  return `[Đang trả lời ${quoteSender}: ${quoteSnippet}]\n${message.text}`;
}

export function resolveIncomingPhoto(message: IncomingMessage, history: Array<{ content: string }>): string | undefined {
  if (message.eventName === "message.image.received" && message.photo) {
    return message.photo;
  }
  if (message.quote?.photo) {
    return message.quote.photo;
  }
  if (message.quote?.text) {
    const match = message.quote.text.match(/\[Ảnh:\s*(https?:\/\/[^\s\]]+)\]/);
    if (match?.[1]) {
      return match[1];
    }
    for (const h of history) {
      if (h.content.includes(message.quote.text) || message.quote.text.includes(h.content.slice(0, 30))) {
        const hMatch = h.content.match(/\[Ảnh:\s*(https?:\/\/[^\s\]]+)\]/);
        if (hMatch?.[1]) {
          return hMatch[1];
        }
      }
    }
  }
  return undefined;
}

export function getMessageRecordKeys(raw: unknown): string[] | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const root = raw as Record<string, unknown>;
  const result = root.result && typeof root.result === "object"
    ? (root.result as Record<string, unknown>)
    : root;
  const msg = result.message && typeof result.message === "object"
    ? (result.message as Record<string, unknown>)
    : undefined;
  return msg ? Object.keys(msg) : undefined;
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
  channelRepo?: ChannelRepository;
  lookupsRepo?: LookupRepository;
  llmClient?: LlmClient;
  seen?: Set<string>;
};

export async function handleDelivery(input: DeliveryDependencies): Promise<void> {
  const { payload, config, log, zalo, seenRepo, messageRepo, listRepo, eventsRepo, memoryRepo, channelRepo, lookupsRepo, llmClient, seen } = input;
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

  if (channelRepo) {
    const initialStatus = config.familyChatIds.includes(message.chatId) ? "active" : "pending";
    const chatType = message.chatType === "PRIVATE" ? "PRIVATE" : "GROUP";
    await channelRepo.upsertDiscovery({
      chatId: message.chatId,
      name: message.senderName || message.chatId,
      chatType,
      status: initialStatus,
    });
  }

  const messageKeys = getMessageRecordKeys(parsed);

  if (config.familyChatIds.length === 0) {
    log.info({
      event: "discovery",
      chat_id: message.chatId,
      chat_type: message.chatType,
      sender_id: message.senderId,
      sender_name: message.senderName,
      message_id: message.messageId,
      has_photo: Boolean(message.photo),
      photo_url: message.photo,
      has_caption: Boolean(message.caption),
      has_quote: Boolean(message.quote),
      quote_has_photo: Boolean(message.quote?.photo),
      message_keys: messageKeys,
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
      has_photo: Boolean(message.photo),
      photo_url: message.photo,
      has_caption: Boolean(message.caption),
      has_quote: Boolean(message.quote),
      quote_has_photo: Boolean(message.quote?.photo),
      message_keys: messageKeys,
    });
  }

  const isSupportedEvent =
    message.eventName === "message.text.received" ||
    message.eventName === "message.image.received";

  if (!isSupportedEvent || message.isBot) {
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
    if (await seenRepo.hasSeen(message.messageId)) {
      return;
    }
    await seenRepo.markSeen(message.messageId);
  } else if (seen) {
    if (seen.has(message.messageId)) {
      return;
    }
    seen.add(message.messageId);
  }

  // Channel status gating
  if (channelRepo) {
    const channel = await channelRepo.getChannel(message.chatId);
    const status = channel?.status ?? (config.familyChatIds.includes(message.chatId) ? "active" : "pending");
    if (status === "disabled") {
      return;
    }
    if (status === "pending") {
      await zalo.sendMessage(message.chatId, getPendingApprovalMessage(message.chatId));
      return;
    }
  } else {
    // If group is not in familyChatIds (new or unlisted group), reply with onboarding notice
    const isAllowedGroup = isGroup && config.familyChatIds.includes(message.chatId);
    if (isGroup && !isAllowedGroup) {
      await zalo.sendMessage(message.chatId, getOnboardingMessage(message.chatId));
      return;
    }
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

    const history = messageRepo ? await messageRepo.getRecent(message.chatId, 20) : [];
    const activePhoto = resolveIncomingPhoto(message, history);
    const photoSource = message.photo
      ? "direct"
      : message.quote?.photo
        ? "quote_photo"
        : activePhoto
          ? "quote_history"
          : "none";
    const formattedText = formatIncomingText(message);


    if (messageRepo) {
      const isDirectImage = message.eventName === "message.image.received" && !!message.photo;
      const storedContent = isDirectImage
        ? (formattedText ? `${formattedText}\n[Ảnh: ${message.photo}]` : `[Ảnh: ${message.photo}]`)
        : (activePhoto && !formattedText.includes("[Ảnh:")
          ? (formattedText ? `${formattedText}\n[Ảnh: ${activePhoto}]` : `[Ảnh: ${activePhoto}]`)
          : formattedText);

      await messageRepo.insert({
        chatId: message.chatId,
        senderId: message.senderId,
        senderName: message.senderName,
        role: "user",
        content: storedContent,
      });
    }

    const listTools = listRepo
      ? createListTools(listRepo, {
          chatId: message.chatId,
          senderName: message.senderName || message.senderId,
        })
      : undefined;

    let publicBaseUrl: string | undefined;
    try {
      publicBaseUrl = new URL(config.webhookUrl).origin;
    } catch {
      // ignore
    }

    const eventTools = eventsRepo
      ? createEventTools(eventsRepo, {
          chatId: message.chatId,
          senderName: message.senderName || message.senderId,
          zalo,
          publicBaseUrl,
          outputDir: getEventsImageDir(config.dbPath),
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

    const weatherTools = createWeatherTool();

    const lookupTools = lookupsRepo
      ? createLookupTools(lookupsRepo, {
          chatId: message.chatId,
          senderName: message.senderName || message.senderId,
        })
      : undefined;

    const tools =
      listTools || eventTools || holidayTools || searchTools || memoryTools || weatherTools || lookupTools
        ? { ...listTools, ...eventTools, ...holidayTools, ...searchTools, ...memoryTools, ...weatherTools, ...lookupTools }
        : undefined;

    const memories = memoryRepo ? await memoryRepo.listMemories(message.chatId) : undefined;

    log.info({
      event: "llm_generate_start",
      chat_id: message.chatId,
      sender_id: message.senderId,
      has_photo: Boolean(activePhoto),
      photo_url: activePhoto,
      photo_source: photoSource,
      history_count: history.length,
      has_tools: Boolean(tools),
      llm_provider: config.llmProvider,
      llm_model: config.llmModel,
    });

    let replyText: string;
    const injectionCheck = detectPromptInjection(message.text);
    if (injectionCheck.isInjection) {
      log.warn({
        event: "prompt_injection_blocked",
        chatId: message.chatId,
        senderId: message.senderId,
        reason: injectionCheck.reason,
      });
      replyText = PROMPT_INJECTION_REFUSAL_MESSAGE;
    } else {
      try {
        replyText = await llmClient.generateReply({
          memories,
          history,
          incomingMessage: {
            senderId: message.senderId,
            senderName: message.senderName,
            content: formattedText,
            photo: activePhoto,
          },
          tools,
        });
        log.info({
          event: "llm_generate_success",
          chat_id: message.chatId,
          has_photo: Boolean(activePhoto),
          reply_length: replyText.length,
        });
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : String(error);
        log.error({
          event: "llm_error",
          chat_id: message.chatId,
          has_photo: Boolean(activePhoto),
          photo_url: activePhoto,
          message: errMessage,
        });
        replyText = FALLBACK_ERROR_MESSAGE;
      }
    }

    const chunks = splitText(replyText, 2000);
    for (const chunk of chunks) {
      await zalo.sendMessage(message.chatId, chunk);
    }
    log.info({
      event: "zalo_reply_sent",
      chat_id: message.chatId,
      chunks_count: chunks.length,
    });

    if (messageRepo) {
      await messageRepo.insert({
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
