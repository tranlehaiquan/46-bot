import { formatUtc7DateStr, getUtc7Parts } from "../db/repositories/events.js";
import {
  executeEventReminders,
  executeMorningBriefing,
  executeScheduledLookup,
  executeWeeklySummary,
} from "./tasks.js";
import type {
  SchedulerDependencies,
  SchedulerInstance,
} from "./types.js";

export function createInMemoryScheduler(deps: SchedulerDependencies): SchedulerInstance {
  const { clock = { now: () => new Date() }, lookupsRepo, llm } = deps;

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
    await executeMorningBriefing(deps, referenceDate, { dedupeSet: sentMorningBriefings });
  }

  async function runWeeklySummary(referenceDate = clock.now()): Promise<void> {
    await executeWeeklySummary(deps, referenceDate, { dedupeSet: sentWeeklySummaries });
  }

  async function runEventReminders(referenceDate = clock.now()): Promise<void> {
    await executeEventReminders(deps, referenceDate);
  }

  async function runDueLookups(referenceDate = clock.now()): Promise<void> {
    if (!lookupsRepo || !llm) {
      return;
    }

    const { dateStr } = getLocalTimeInfo(referenceDate);
    const dueLookups = await lookupsRepo.findDueLookups(referenceDate);

    for (const lookup of dueLookups) {
      await executeScheduledLookup(deps, { lookupId: lookup.id, dateStr }, referenceDate, { rethrow: false });
    }
  }

  async function runCatchUp(): Promise<void> {
    const now = clock.now();

    // Due lookups catch-up; do not send morning briefings or event reminders on restart
    await runDueLookups(now);
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
