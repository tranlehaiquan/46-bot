import type { AppConfig } from "../config.js";
import type { ChannelRepository } from "../db/repositories/channels.js";
import type { EventsRepository } from "../db/repositories/events.js";
import type { LookupRepository } from "../db/repositories/lookups.js";
import type { LlmClient } from "../llm/client.js";
import type { Logger } from "../logger.js";
import type { ZaloClient } from "../zalo-client.js";

export const SCHEDULED_LOOKUP_SYSTEM_PROMPT = `Bạn là trợ lý báo tin định kỳ cho gia đình.
- Nhiệm vụ: Thực hiện và trả lời chỉ dẫn tra cứu được yêu cầu một cách ngắn gọn, súc tích, chính xác.
- Ngôn ngữ: Mặc định tiếng Việt.
- Định dạng: Văn bản thuần (plain text), KHÔNG dùng Markdown (không dùng **, __, ##, *, _, ~~).
- Không đặt câu hỏi ngược lại người dùng, không thêm phần chào hỏi thừa thãi hoặc hỏi tiếp.
- Chỉ sử dụng các công cụ tra cứu được cung cấp.`;

export type Clock = {
  now(): Date;
};

export type SchedulerDependencies = {
  config: AppConfig;
  eventsRepo: EventsRepository;
  zalo: ZaloClient;
  log?: Logger;
  clock?: Clock;
  lookupsRepo?: LookupRepository;
  channelsRepo?: ChannelRepository;
  llm?: LlmClient;
};

export type SchedulerInstance = {
  stop(): void | Promise<void>;
  tick(): Promise<void>;
  runCatchUp(): Promise<void>;
  runMorningBriefing(date?: Date): Promise<void>;
  runWeeklySummary(date?: Date): Promise<void>;
  runEventReminders(date?: Date): Promise<void>;
  runDueLookups(date?: Date): Promise<void>;
};

export type MorningBriefingJobData = {
  chatId: string;
  dateStr: string;
};

export type WeeklySummaryJobData = {
  chatId: string;
  dateStr: string;
};

export type EventReminderJobData = {
  eventId: number;
  occurrenceDateStr: string;
};

export type ScheduledLookupJobData = {
  lookupId: number;
  dateStr: string;
};

export type SchedulerJobType =
  | "morning-briefing"
  | "weekly-summary"
  | "event-reminder"
  | "scheduled-lookup";

export function buildBriefingJobId(chatId: string, dateStr: string): string {
  return `briefing:${chatId}:${dateStr}`;
}

export function buildWeeklySummaryJobId(chatId: string, dateStr: string): string {
  return `weekly:${chatId}:${dateStr}`;
}

export function buildEventReminderJobId(eventId: number, occurrenceDateStr: string): string {
  return `reminder:${eventId}:${occurrenceDateStr}`;
}

export function buildLookupJobId(lookupId: number, dateStr: string): string {
  return `lookup:${lookupId}:${dateStr}`;
}
