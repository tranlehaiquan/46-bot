import { Queue, type QueueOptions } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "../logger.js";
import {
  type EventReminderJobData,
  type ScheduledLookupJobData,
  buildEventReminderJobId,
  buildLookupJobId,
} from "./types.js";

export const DEFAULT_QUEUE_NAME = "scheduled-tasks";

export type SchedulerQueue = Queue<any, any, string>;

export function createSchedulerQueue(
  connection: Redis,
  queueName = DEFAULT_QUEUE_NAME,
  customOptions?: Partial<QueueOptions>,
): SchedulerQueue {
  return new Queue(queueName, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { age: 86400, count: 500 },
      removeOnFail: { age: 604800, count: 500 },
    },
    ...customOptions,
  });
}

export async function registerRepeatableJobs(
  queue: SchedulerQueue,
  log?: Logger,
): Promise<void> {
  const tz = "Asia/Ho_Chi_Minh";

  // 1. Daily morning briefing at 07:00
  await queue.upsertJobScheduler(
    "morning-briefing-scheduler",
    { pattern: "0 7 * * *", tz },
    { name: "morning-briefing" },
  );

  // 2. Daily event reminders at 08:00
  await queue.upsertJobScheduler(
    "event-reminders-scheduler",
    { pattern: "0 8 * * *", tz },
    { name: "event-reminders" },
  );

  // 3. Weekly Sunday outlook at 20:00
  await queue.upsertJobScheduler(
    "weekly-summary-scheduler",
    { pattern: "0 20 * * 0", tz },
    { name: "weekly-summary" },
  );

  // 4. Minute-by-minute lookups tick
  await queue.upsertJobScheduler(
    "due-lookups-tick-scheduler",
    { pattern: "* * * * *", tz },
    { name: "due-lookups-tick" },
  );

  log?.info({ event: "scheduler_repeatable_jobs_registered", tz });
}

export async function enqueueLookupJob(
  queue: SchedulerQueue,
  data: ScheduledLookupJobData,
): Promise<void> {
  const jobId = buildLookupJobId(data.lookupId, data.dateStr);
  await queue.add("scheduled-lookup", data, { jobId });
}

export async function enqueueEventReminderJob(
  queue: SchedulerQueue,
  data: EventReminderJobData,
): Promise<void> {
  const jobId = buildEventReminderJobId(data.eventId, data.occurrenceDateStr);
  await queue.add("event-reminder", data, { jobId });
}

export async function closeSchedulerQueue(queue: SchedulerQueue): Promise<void> {
  await queue.close();
}
