import { Redis, type RedisOptions } from "ioredis";
import type { Logger } from "../logger.js";

export function createRedisClient(redisUrl: string, customOptions?: RedisOptions): Redis {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableReadyCheck: false,
    ...customOptions,
  });

  client.on("error", () => {
    // Suppress unhandled error events to avoid uncaught exceptions
  });

  return client;
}

export async function connectRedis(
  redisUrl?: string,
  log?: Logger,
  timeoutMs = 2000,
): Promise<Redis | null> {
  if (!redisUrl || redisUrl.trim() === "") {
    log?.info({ event: "scheduler_redis_disabled", reason: "no_redis_url" });
    return null;
  }

  const client = createRedisClient(redisUrl);

  try {
    const connectPromise = client.connect();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Redis connection timed out after ${timeoutMs}ms`)), timeoutMs),
    );
    await Promise.race([connectPromise, timeoutPromise]);
    await client.ping();
    log?.info({ event: "scheduler_redis_connected", url: redisUrl.replace(/:[^:@]+@/, ":***@") });
    return client;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log?.warn({
      event: "scheduler_redis_connection_failed",
      error: errorMsg,
      message: "Falling back to in-memory scheduler",
    });
    try {
      client.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    return null;
  }
}

export async function closeRedis(client: Redis): Promise<void> {
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}
