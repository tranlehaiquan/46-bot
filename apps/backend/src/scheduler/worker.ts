import { Worker, type Job, type WorkerOptions } from "bullmq";
import type { Redis } from "ioredis";
import { formatUtc7DateStr } from "../db/repositories/events.js";
import { DEFAULT_QUEUE_NAME } from "./queue.js";
import {
  executeEventReminders,
  executeMorningBriefing,
  executeScheduledLookup,
  executeWeeklySummary,
} from "./tasks.js";
import type {
  EventReminderJobData,
  ScheduledLookupJobData,
  SchedulerDependencies,
} from "./types.js";

export const processMorningBriefing = executeMorningBriefing;
export const processWeeklySummary = executeWeeklySummary;
export const processEventReminders = executeEventReminders;

export async function processSingleLookup(
  deps: SchedulerDependencies,
  data: ScheduledLookupJobData,
  referenceDate = deps.clock?.now() ?? new Date(),
): Promise<void> {
  await executeScheduledLookup(deps, data, referenceDate, { rethrow: true });
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
      const dueLookups = await deps.lookupsRepo.findDueLookups(now);
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
      const event = await deps.eventsRepo.getEventById(data.eventId);
      if (event && !(await deps.eventsRepo.isReminderSent(event.id, data.occurrenceDateStr))) {
        const messageText = `🔔 Nhắc nhở: "${event.title}"!`;
        await deps.zalo.sendMessage(event.chatId, messageText, { parse_mode: "markdown" });
        await deps.eventsRepo.recordReminderSent(event.id, data.occurrenceDateStr, now.getTime());
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
