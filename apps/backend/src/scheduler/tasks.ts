import type { AppConfig } from "../config.js";
import { formatUtc7DateStr, type DueReminder } from "../db/repositories/events.js";
import { getUpcomingHolidays } from "../holidays/index.js";
import type { ToolSet } from "../llm/client.js";
import { detectPromptInjection } from "../llm/prompt-security.js";
import { createHolidayTools } from "../tools/holidays.js";
import { createWeatherTool } from "../tools/weather.js";
import { createWebSearchTool } from "../tools/web-search.js";
import { createCrawl4AiTool } from "../tools/crawl4ai.js";
import { splitText } from "../utils/split-text.js";
import { cleanOutboundText } from "../utils/clean-text.js";
import {
  formatEventReminder,
  formatMorningBriefing,
  formatWeeklyOutlook,
} from "./formatters.js";
import {
  SCHEDULED_LOOKUP_SYSTEM_PROMPT,
  type ScheduledLookupJobData,
  type SchedulerDependencies,
} from "./types.js";

/**
 * Creates the standard tool set available for background scheduled lookups.
 */
export function createSchedulerTools(config: AppConfig): ToolSet {
  const weatherTool = createWeatherTool();
  const holidayTools = createHolidayTools();
  const tools: ToolSet = {
    weather_check: weatherTool.weather_check,
    holiday_list_upcoming: holidayTools.holiday_list_upcoming,
  };

  if (config.tavilyApiKey) {
    const webSearchTool = createWebSearchTool(config.tavilyApiKey);
    tools.web_search = webSearchTool.web_search;
  }

  if (config.crawl4aiApiToken) {
    const crawl4AiTool = createCrawl4AiTool(config.crawl4aiApiToken);
    tools.scrape_url = crawl4AiTool.scrape_url;
  }

  return tools;
}

export type TaskExecutionOptions = {
  dedupeSet?: Set<string>;
};

/**
 * Executes the morning briefing for all configured family channels.
 */
export async function executeMorningBriefing(
  deps: SchedulerDependencies,
  referenceDate = deps.clock?.now() ?? new Date(),
  options?: TaskExecutionOptions,
): Promise<void> {
  const { config, eventsRepo, zalo, log } = deps;
  const channels = config.familyChatIds;
  if (channels.length === 0) {
    log?.info({ event: "scheduler_morning_briefing_skipped", reason: "no_family_chat_ids" });
    return;
  }

  const todayHolidays = getUpcomingHolidays({ windowDays: 0, referenceDate });
  const dateStr = formatUtc7DateStr(referenceDate);

  for (const chatId of channels) {
    const dedupeKey = `${chatId}:${dateStr}`;
    if (options?.dedupeSet?.has(dedupeKey)) {
      continue;
    }

    const allUpcoming = await eventsRepo.listUpcomingEvents(chatId, 7, referenceDate);
    const todayEvents = allUpcoming.filter((e) => e.daysRemaining === 0);
    const upcomingMilestones = allUpcoming.filter(
      (e) =>
        e.daysRemaining > 0 &&
        (e.event.kind === "birthday" || e.event.kind === "anniversary" || e.event.kind === "gio"),
    );

    const messageText = formatMorningBriefing({
      todayEvents,
      todayHolidays,
      upcomingMilestones,
      referenceDate,
    });

    if (messageText) {
      try {
        await zalo.sendMessage(chatId, messageText, { parse_mode: "markdown" });
        options?.dedupeSet?.add(dedupeKey);
        log?.info({ event: "scheduler_morning_briefing_sent", chatId, date: dateStr });
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        log?.error({ event: "scheduler_morning_briefing_error", chatId, error: err });
      }
    } else {
      options?.dedupeSet?.add(dedupeKey);
    }
  }
}

/**
 * Executes the weekly summary/outlook for all configured family channels.
 */
export async function executeWeeklySummary(
  deps: SchedulerDependencies,
  referenceDate = deps.clock?.now() ?? new Date(),
  options?: TaskExecutionOptions,
): Promise<void> {
  const { config, eventsRepo, zalo, log } = deps;
  const channels = config.familyChatIds;
  if (channels.length === 0) {
    log?.info({ event: "scheduler_weekly_summary_skipped", reason: "no_family_chat_ids" });
    return;
  }

  const weekHolidays = getUpcomingHolidays({ windowDays: 7, referenceDate }).filter(
    (h) => h.daysRemaining > 0,
  );
  const dateStr = formatUtc7DateStr(referenceDate);

  for (const chatId of channels) {
    const dedupeKey = `${chatId}:${dateStr}`;
    if (options?.dedupeSet?.has(dedupeKey)) {
      continue;
    }

    const weekEvents = (await eventsRepo
      .listUpcomingEvents(chatId, 7, referenceDate))
      .filter((e) => e.daysRemaining > 0);

    const messageText = formatWeeklyOutlook({
      weekEvents,
      weekHolidays,
      referenceDate,
    });

    if (messageText) {
      try {
        await zalo.sendMessage(chatId, messageText, { parse_mode: "markdown" });
        options?.dedupeSet?.add(dedupeKey);
        log?.info({ event: "scheduler_weekly_summary_sent", chatId, date: dateStr });
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        log?.error({ event: "scheduler_weekly_summary_error", chatId, error: err });
      }
    } else {
      options?.dedupeSet?.add(dedupeKey);
    }
  }
}

/**
 * Evaluates and dispatches pending event reminders.
 */
export async function executeEventReminders(
  deps: SchedulerDependencies,
  referenceDate = deps.clock?.now() ?? new Date(),
): Promise<void> {
  const { eventsRepo, zalo, log, clock = { now: () => new Date() } } = deps;
  const dueReminders: DueReminder[] = await eventsRepo.findEventsDueForReminder(referenceDate);

  for (const due of dueReminders) {
    const { event, occurrenceDateStr } = due;

    if (await eventsRepo.isReminderSent(event.id, occurrenceDateStr)) {
      continue;
    }

    const messageText = formatEventReminder(due);
    try {
      await zalo.sendMessage(event.chatId, messageText, { parse_mode: "markdown" });
      await eventsRepo.recordReminderSent(event.id, occurrenceDateStr, clock.now().getTime());
      log?.info({
        event: "scheduler_reminder_sent",
        eventId: event.id,
        chatId: event.chatId,
        occurrenceDate: occurrenceDateStr,
      });
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      log?.error({
        event: "scheduler_reminder_error",
        eventId: event.id,
        chatId: event.chatId,
        error: err,
      });
    }
  }
}

export type ScheduledLookupExecutionOptions = {
  rethrow?: boolean;
};

/**
 * Executes a single scheduled lookup: gating checks, prompt injection inspection,
 * tool invocation, clean response chunking, and status recording.
 */
export async function executeScheduledLookup(
  deps: SchedulerDependencies,
  data: ScheduledLookupJobData,
  referenceDate = deps.clock?.now() ?? new Date(),
  options?: ScheduledLookupExecutionOptions,
): Promise<void> {
  const { config, lookupsRepo, channelsRepo, llm, zalo, log, clock = { now: () => new Date() } } = deps;
  if (!lookupsRepo || !llm) {
    return;
  }

  const lookup = await lookupsRepo.getLookupById(data.lookupId);
  if (!lookup || !lookup.active) {
    return;
  }

  if (channelsRepo) {
    const channel = await channelsRepo.getChannel(lookup.chatId);
    if (channel && channel.status !== "active") {
      log?.info({
        event: "scheduler_lookup_skipped_channel",
        chatId: lookup.chatId,
        status: channel.status,
      });
      return;
    }
  }

  const injectionCheck = detectPromptInjection(lookup.instruction);
  if (injectionCheck.isInjection) {
    const claim = await lookupsRepo.claimRun(lookup.id, data.dateStr, referenceDate.getTime());
    if (claim.claimed) {
      await lookupsRepo.recordRunFailure(claim.run.id, "Prompt injection detected in saved instruction");
    }
    return;
  }

  const claim = await lookupsRepo.claimRun(lookup.id, data.dateStr, referenceDate.getTime());
  if (!claim.claimed) {
    return;
  }

  const run = claim.run;
  const tools = createSchedulerTools(config);

  try {
    const reply = await llm.generateReply({
      systemPrompt: SCHEDULED_LOOKUP_SYSTEM_PROMPT,
      history: [],
      incomingMessage: {
        senderId: lookup.createdBy,
        senderName: "Family Member",
        content: lookup.instruction,
      },
      tools,
    });

    const effectiveReply = cleanOutboundText(reply);
    if (!effectiveReply) {
      throw new Error("Empty reply from LLM for scheduled lookup");
    }

    const chunks = splitText(effectiveReply, 2000);
    for (const chunk of chunks) {
      await zalo.sendMessage(lookup.chatId, chunk, { parse_mode: "markdown" });
    }

    await lookupsRepo.recordRunSuccess(run.id, clock.now().getTime());
    log?.info({
      event: "scheduler_lookup_sent",
      lookupId: lookup.id,
      chatId: lookup.chatId,
      fireDate: data.dateStr,
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    await lookupsRepo.recordRunFailure(run.id, err);
    log?.error({
      event: "scheduler_lookup_error",
      lookupId: lookup.id,
      chatId: lookup.chatId,
      fireDate: data.dateStr,
      attemptCount: run.attemptCount,
      error: err,
    });
    if (options?.rethrow) {
      throw error;
    }
  }
}
