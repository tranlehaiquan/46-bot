import { Worker, type Job, type WorkerOptions } from "bullmq";
import type { Redis } from "ioredis";
import { formatUtc7DateStr, getUtc7Parts, type DueReminder } from "../db/repositories/events.js";
import { getUpcomingHolidays } from "../holidays/index.js";
import type { ToolSet } from "../llm/client.js";
import { detectPromptInjection } from "../llm/prompt-security.js";
import { createHolidayTools } from "../tools/holidays.js";
import { createWeatherTool } from "../tools/weather.js";
import { createWebSearchTool } from "../tools/web-search.js";
import { splitText } from "../utils/split-text.js";
import {
  formatEventReminder,
  formatMorningBriefing,
  formatWeeklyOutlook,
} from "./formatters.js";
import { DEFAULT_QUEUE_NAME } from "./queue.js";
import {
  SCHEDULED_LOOKUP_SYSTEM_PROMPT,
  type EventReminderJobData,
  type ScheduledLookupJobData,
  type SchedulerDependencies,
} from "./types.js";

export async function processMorningBriefing(
  deps: SchedulerDependencies,
  referenceDate = deps.clock?.now() ?? new Date(),
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
    const allUpcoming = eventsRepo.listUpcomingEvents(chatId, 7, referenceDate);
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
        await zalo.sendMessage(chatId, messageText);
        log?.info({ event: "scheduler_morning_briefing_sent", chatId, date: dateStr });
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        log?.error({ event: "scheduler_morning_briefing_error", chatId, error: err });
      }
    }
  }
}

export async function processWeeklySummary(
  deps: SchedulerDependencies,
  referenceDate = deps.clock?.now() ?? new Date(),
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
    const weekEvents = eventsRepo
      .listUpcomingEvents(chatId, 7, referenceDate)
      .filter((e) => e.daysRemaining > 0);

    const messageText = formatWeeklyOutlook({
      weekEvents,
      weekHolidays,
      referenceDate,
    });

    if (messageText) {
      try {
        await zalo.sendMessage(chatId, messageText);
        log?.info({ event: "scheduler_weekly_summary_sent", chatId, date: dateStr });
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        log?.error({ event: "scheduler_weekly_summary_error", chatId, error: err });
      }
    }
  }
}

export async function processEventReminders(
  deps: SchedulerDependencies,
  referenceDate = deps.clock?.now() ?? new Date(),
): Promise<void> {
  const { eventsRepo, zalo, log, clock = { now: () => new Date() } } = deps;
  const dueReminders: DueReminder[] = eventsRepo.findEventsDueForReminder(referenceDate);

  for (const due of dueReminders) {
    const { event, occurrenceDateStr } = due;

    if (eventsRepo.isReminderSent(event.id, occurrenceDateStr)) {
      continue;
    }

    const messageText = formatEventReminder(due);
    try {
      await zalo.sendMessage(event.chatId, messageText);
      eventsRepo.recordReminderSent(event.id, occurrenceDateStr, clock.now().getTime());
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

export async function processSingleLookup(
  deps: SchedulerDependencies,
  data: ScheduledLookupJobData,
  referenceDate = deps.clock?.now() ?? new Date(),
): Promise<void> {
  const { config, lookupsRepo, channelsRepo, llm, zalo, log, clock = { now: () => new Date() } } = deps;
  if (!lookupsRepo || !llm) {
    return;
  }

  const lookup = lookupsRepo.getLookupById(data.lookupId);
  if (!lookup || !lookup.active) {
    return;
  }

  if (channelsRepo) {
    const channel = channelsRepo.getChannel(lookup.chatId);
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
    const claim = lookupsRepo.claimRun(lookup.id, data.dateStr, referenceDate.getTime());
    if (claim.claimed) {
      lookupsRepo.recordRunFailure(claim.run.id, "Prompt injection detected in saved instruction");
      lookupsRepo.recordRunFailure(claim.run.id, "Prompt injection detected in saved instruction");
      lookupsRepo.recordRunFailure(claim.run.id, "Prompt injection detected in saved instruction");
    }
    return;
  }

  const claim = lookupsRepo.claimRun(lookup.id, data.dateStr, referenceDate.getTime());
  if (!claim.claimed) {
    return;
  }

  const run = claim.run;

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

    if (!reply || reply.trim().length === 0) {
      throw new Error("Empty reply from LLM for scheduled lookup");
    }

    const chunks = splitText(reply, 2000);
    for (const chunk of chunks) {
      await zalo.sendMessage(lookup.chatId, chunk);
    }

    lookupsRepo.recordRunSuccess(run.id, clock.now().getTime());
    log?.info({
      event: "scheduler_lookup_sent",
      lookupId: lookup.id,
      chatId: lookup.chatId,
      fireDate: data.dateStr,
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    lookupsRepo.recordRunFailure(run.id, err);
    log?.error({
      event: "scheduler_lookup_error",
      lookupId: lookup.id,
      chatId: lookup.chatId,
      fireDate: data.dateStr,
      attemptCount: run.attemptCount,
      error: err,
    });
    throw error;
  }
}

export async function processJob(
  job: Job,
  deps: SchedulerDependencies,
): Promise<void> {
  const now = deps.clock?.now() ?? new Date();

  switch (job.name) {
    case "morning-briefing":
      await processMorningBriefing(deps, now);
      break;

    case "event-reminders":
      await processEventReminders(deps, now);
      break;

    case "weekly-summary":
      await processWeeklySummary(deps, now);
      break;

    case "due-lookups-tick": {
      if (!deps.lookupsRepo) break;
      const dateStr = formatUtc7DateStr(now);
      const dueLookups = deps.lookupsRepo.findDueLookups(now);
      for (const lookup of dueLookups) {
        await processSingleLookup(deps, { lookupId: lookup.id, dateStr }, now).catch(() => {});
      }
      break;
    }

    case "scheduled-lookup": {
      const data = job.data as ScheduledLookupJobData;
      await processSingleLookup(deps, data, now);
      break;
    }

    case "event-reminder": {
      const data = job.data as EventReminderJobData;
      const event = deps.eventsRepo.getEventById(data.eventId);
      if (event && !deps.eventsRepo.isReminderSent(event.id, data.occurrenceDateStr)) {
        const messageText = `🔔 Nhắc nhở: "${event.title}"!`;
        await deps.zalo.sendMessage(event.chatId, messageText);
        deps.eventsRepo.recordReminderSent(event.id, data.occurrenceDateStr, now.getTime());
      }
      break;
    }

    default:
      deps.log?.warn({ event: "scheduler_unknown_job", jobName: job.name });
  }
}

export function createSchedulerWorker(
  connection: Redis,
  deps: SchedulerDependencies,
  queueName = DEFAULT_QUEUE_NAME,
  customOptions?: Partial<WorkerOptions>,
): Worker {
  const concurrency = deps.config.schedulerConcurrency || 5;

  const worker = new Worker(
    queueName,
    async (job: Job) => {
      await processJob(job, deps);
    },
    {
      connection,
      concurrency,
      limiter: {
        max: 10,
        duration: 2000,
      },
      ...customOptions,
    },
  );

  worker.on("error", (err) => {
    deps.log?.error({ event: "scheduler_worker_error", error: err.message });
  });

  worker.on("failed", (job, err) => {
    deps.log?.error({
      event: "scheduler_worker_job_failed",
      jobId: job?.id,
      jobName: job?.name,
      error: err.message,
    });
  });

  return worker;
}
