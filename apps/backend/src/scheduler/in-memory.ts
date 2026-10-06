import type { DueReminder } from "../db/repositories/events.js";
import { formatUtc7DateStr, getUtc7Parts } from "../db/repositories/events.js";
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
import {
  SCHEDULED_LOOKUP_SYSTEM_PROMPT,
  type SchedulerDependencies,
  type SchedulerInstance,
} from "./types.js";

export function createInMemoryScheduler(deps: SchedulerDependencies): SchedulerInstance {
  const { config, eventsRepo, zalo, log, clock = { now: () => new Date() }, lookupsRepo, channelsRepo, llm } = deps;

  let timer: NodeJS.Timeout | null = null;
  const sentMorningBriefings = new Set<string>(); // key: `${chatId}:${dateStr}`
  const sentWeeklySummaries = new Set<string>(); // key: `${chatId}:${dateStr}`

  function getLocalTimeInfo(date: Date) {
    const parts = getUtc7Parts(date);
    const dateStr = formatUtc7DateStr(date);
    const vnMs = date.getTime() + 7 * 60 * 60 * 1000;
    const vnDate = new Date(vnMs);
    const hour = vnDate.getUTCHours();
    const minute = vnDate.getUTCMinutes();
    const dayOfWeek = vnDate.getUTCDay(); // 0 = Sunday

    return { parts, dateStr, hour, minute, dayOfWeek };
  }

  async function runMorningBriefing(referenceDate = clock.now()): Promise<void> {
    const { dateStr } = getLocalTimeInfo(referenceDate);
    const channels = config.familyChatIds;

    if (channels.length === 0) {
      log?.info({ event: "scheduler_morning_briefing_skipped", reason: "no_family_chat_ids" });
      return;
    }

    const todayHolidays = getUpcomingHolidays({ windowDays: 0, referenceDate });

    for (const chatId of channels) {
      const dedupeKey = `${chatId}:${dateStr}`;
      if (sentMorningBriefings.has(dedupeKey)) {
        continue;
      }

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
          sentMorningBriefings.add(dedupeKey);
          log?.info({ event: "scheduler_morning_briefing_sent", chatId, date: dateStr });
        } catch (error) {
          const err = error instanceof Error ? error.message : String(error);
          log?.error({ event: "scheduler_morning_briefing_error", chatId, error: err });
        }
      } else {
        sentMorningBriefings.add(dedupeKey);
      }
    }
  }

  async function runWeeklySummary(referenceDate = clock.now()): Promise<void> {
    const { dateStr } = getLocalTimeInfo(referenceDate);
    const channels = config.familyChatIds;

    if (channels.length === 0) {
      log?.info({ event: "scheduler_weekly_summary_skipped", reason: "no_family_chat_ids" });
      return;
    }

    const weekHolidays = getUpcomingHolidays({ windowDays: 7, referenceDate }).filter(
      (h) => h.daysRemaining > 0,
    );

    for (const chatId of channels) {
      const dedupeKey = `${chatId}:${dateStr}`;
      if (sentWeeklySummaries.has(dedupeKey)) {
        continue;
      }

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
          sentWeeklySummaries.add(dedupeKey);
          log?.info({ event: "scheduler_weekly_summary_sent", chatId, date: dateStr });
        } catch (error) {
          const err = error instanceof Error ? error.message : String(error);
          log?.error({ event: "scheduler_weekly_summary_error", chatId, error: err });
        }
      } else {
        sentWeeklySummaries.add(dedupeKey);
      }
    }
  }

  async function runEventReminders(referenceDate = clock.now()): Promise<void> {
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

  async function runDueLookups(referenceDate = clock.now()): Promise<void> {
    if (!lookupsRepo || !llm) {
      return;
    }

    const { dateStr } = getLocalTimeInfo(referenceDate);
    const dueLookups = lookupsRepo.findDueLookups(referenceDate);

    for (const lookup of dueLookups) {
      if (channelsRepo) {
        const channel = channelsRepo.getChannel(lookup.chatId);
        if (channel && channel.status !== "active") {
          log?.info({
            event: "scheduler_lookup_skipped_channel",
            chatId: lookup.chatId,
            status: channel.status,
          });
          continue;
        }
      }

      const injectionCheck = detectPromptInjection(lookup.instruction);
      if (injectionCheck.isInjection) {
        const claim = lookupsRepo.claimRun(lookup.id, dateStr, referenceDate.getTime());
        if (claim.claimed) {
          lookupsRepo.recordRunFailure(claim.run.id, "Prompt injection detected in saved instruction");
          lookupsRepo.recordRunFailure(claim.run.id, "Prompt injection detected in saved instruction");
          lookupsRepo.recordRunFailure(claim.run.id, "Prompt injection detected in saved instruction");
        }
        continue;
      }

      const claim = lookupsRepo.claimRun(lookup.id, dateStr, referenceDate.getTime());
      if (!claim.claimed) {
        continue;
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
          fireDate: dateStr,
        });
      } catch (error) {
        const err = error instanceof Error ? error.message : String(error);
        lookupsRepo.recordRunFailure(run.id, err);
        log?.error({
          event: "scheduler_lookup_error",
          lookupId: lookup.id,
          chatId: lookup.chatId,
          fireDate: dateStr,
          attemptCount: run.attemptCount,
          error: err,
        });
      }
    }
  }

  async function runCatchUp(): Promise<void> {
    const now = clock.now();
    const { hour } = getLocalTimeInfo(now);

    // Due lookups catch-up
    await runDueLookups(now);

    // Morning briefing window catch-up: between 07:00 and 09:00
    if (hour >= 7 && hour < 9) {
      await runMorningBriefing(now);
    }

    // Event reminders window catch-up: between 08:00 and 10:00
    if (hour >= 8 && hour < 10) {
      await runEventReminders(now);
    }
  }

  async function tick(): Promise<void> {
    const now = clock.now();
    const { hour, minute, dayOfWeek } = getLocalTimeInfo(now);

    // Always check for due lookups on every tick
    await runDueLookups(now);

    // 07:00 daily morning briefing
    if (hour === 7 && minute === 0) {
      await runMorningBriefing(now);
    }

    // 08:00 daily event reminders
    if (hour === 8 && minute === 0) {
      await runEventReminders(now);
    }

    // 20:00 Sunday weekly summary
    if (dayOfWeek === 0 && hour === 20 && minute === 0) {
      await runWeeklySummary(now);
    }
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    stop,
    tick,
    runCatchUp,
    runMorningBriefing,
    runWeeklySummary,
    runEventReminders,
    runDueLookups,
  };
}

export function startInMemoryScheduler(
  deps: SchedulerDependencies,
  intervalMs = 60_000,
): SchedulerInstance {
  const scheduler = createInMemoryScheduler(deps);

  scheduler.runCatchUp().catch((err) => {
    deps.log?.error({ event: "scheduler_catchup_error", error: String(err) });
  });

  const timer = setInterval(() => {
    scheduler.tick().catch((err) => {
      deps.log?.error({ event: "scheduler_tick_error", error: String(err) });
    });
  }, intervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  const originalStop = scheduler.stop;
  scheduler.stop = () => {
    clearInterval(timer);
    originalStop();
  };

  return scheduler;
}
