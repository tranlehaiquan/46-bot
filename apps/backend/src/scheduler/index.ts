import type { Redis } from "ioredis";
import { formatUtc7DateStr } from "../db/repositories/events.js";
import { createInMemoryScheduler, startInMemoryScheduler } from "./in-memory.js";
import { closeRedis, connectRedis } from "./redis.js";
import {
  createSchedulerQueue,
  registerRepeatableJobs,
  type SchedulerQueue,
} from "./queue.js";
import {
  createSchedulerWorker,
  processEventReminders,
  processMorningBriefing,
  processSingleLookup,
  processWeeklySummary,
} from "./worker.js";
import type { Worker } from "bullmq";
import type {
  Clock,
  SchedulerDependencies,
  SchedulerInstance,
} from "./types.js";

export {
  SCHEDULED_LOOKUP_SYSTEM_PROMPT,
  type Clock,
  type SchedulerDependencies,
  type SchedulerInstance,
  type MorningBriefingJobData,
  type WeeklySummaryJobData,
  type EventReminderJobData,
  type ScheduledLookupJobData,
  type SchedulerJobType,
} from "./types.js";

export { createInMemoryScheduler, startInMemoryScheduler } from "./in-memory.js";
export { connectRedis, createRedisClient, closeRedis } from "./redis.js";
export { createSchedulerQueue, registerRepeatableJobs, enqueueLookupJob, enqueueEventReminderJob } from "./queue.js";
export { createSchedulerWorker, processJob } from "./worker.js";

export type DistributedSchedulerOptions = {
  deps: SchedulerDependencies;
  redisClient: Redis;
  queue?: SchedulerQueue;
  worker?: Worker;
};

export function createDistributedScheduler(options: DistributedSchedulerOptions): SchedulerInstance {
  const { deps, redisClient } = options;
  const queue = options.queue ?? createSchedulerQueue(redisClient);
  const worker = options.worker ?? createSchedulerWorker(redisClient, deps);

  async function stop(): Promise<void> {
    await worker.close();
    await queue.close();
    await closeRedis(redisClient);
  }

  async function runCatchUp(): Promise<void> {
    const now = deps.clock?.now() ?? new Date();
    await processMorningBriefing(deps, now);
    await processEventReminders(deps, now);
  }

  async function tick(): Promise<void> {
    const now = deps.clock?.now() ?? new Date();
    if (!deps.lookupsRepo) return;
    const dateStr = formatUtc7DateStr(now);
    const dueLookups = await deps.lookupsRepo.findDueLookups(now);
    for (const lookup of dueLookups) {
      await processSingleLookup(deps, { lookupId: lookup.id, dateStr }, now).catch(() => {});
    }
  }

  return {
    stop,
    tick,
    runCatchUp,
    runMorningBriefing: (date) => processMorningBriefing(deps, date ?? deps.clock?.now() ?? new Date()),
    runWeeklySummary: (date) => processWeeklySummary(deps, date ?? deps.clock?.now() ?? new Date()),
    runEventReminders: (date) => processEventReminders(deps, date ?? deps.clock?.now() ?? new Date()),
    runDueLookups: async (date) => {
      const now = date ?? deps.clock?.now() ?? new Date();
      if (!deps.lookupsRepo) return;
      const dateStr = formatUtc7DateStr(now);
      const dueLookups = await deps.lookupsRepo.findDueLookups(now);
      for (const lookup of dueLookups) {
        await processSingleLookup(deps, { lookupId: lookup.id, dateStr }, now).catch(() => {});
      }
    },
  };
}

export function createScheduler(deps: SchedulerDependencies): SchedulerInstance {
  return createInMemoryScheduler(deps);
}

export function startScheduler(
  deps: SchedulerDependencies,
  intervalMs = 60_000,
): SchedulerInstance {
  if (!deps.config.redisUrl || deps.config.redisUrl.trim() === "") {
    return startInMemoryScheduler(deps, intervalMs);
  }

  let activeInstance: SchedulerInstance = startInMemoryScheduler(deps, intervalMs);

  const instanceProxy: SchedulerInstance = {
    stop: async () => {
      await activeInstance.stop();
    },
    tick: async () => {
      await activeInstance.tick();
    },
    runCatchUp: async () => {
      await activeInstance.runCatchUp();
    },
    runMorningBriefing: async (date) => {
      await activeInstance.runMorningBriefing(date);
    },
    runWeeklySummary: async (date) => {
      await activeInstance.runWeeklySummary(date);
    },
    runEventReminders: async (date) => {
      await activeInstance.runEventReminders(date);
    },
    runDueLookups: async (date) => {
      await activeInstance.runDueLookups(date);
    },
  };

  connectRedis(deps.config.redisUrl, deps.log)
    .then(async (redisClient) => {
      if (!redisClient) {
        return;
      }

      try {
        const queue = createSchedulerQueue(redisClient);
        await registerRepeatableJobs(queue, deps.log);
        const worker = createSchedulerWorker(redisClient, deps);

        // Stop in-memory timer
        activeInstance.stop();

        const distributed = createDistributedScheduler({
          deps,
          redisClient,
          queue,
          worker,
        });

        activeInstance = distributed;
        deps.log?.info({ event: "scheduler_distributed_active" });

        await distributed.runCatchUp().catch((err) => {
          deps.log?.error({ event: "scheduler_distributed_catchup_error", error: String(err) });
        });
      } catch (err) {
        deps.log?.warn({
          event: "scheduler_distributed_init_failed",
          error: String(err),
          message: "Continuing with in-memory scheduler",
        });
      }
    })
    .catch((err) => {
      deps.log?.warn({
        event: "scheduler_redis_connect_error",
        error: String(err),
        message: "Continuing with in-memory scheduler",
      });
    });

  return instanceProxy;
}
