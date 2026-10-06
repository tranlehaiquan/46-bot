import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { connectRedis, createRedisClient } from "./redis.js";

describe("Redis connection manager", () => {
  it("returns null when redisUrl is undefined or empty", async () => {
    const logs: unknown[] = [];
    const mockLog = {
      info: (obj: unknown) => logs.push(obj),
      warn: (obj: unknown) => logs.push(obj),
      error: (obj: unknown) => logs.push(obj),
      debug: (obj: unknown) => logs.push(obj),
    };

    const res1 = await connectRedis(undefined, mockLog as any);
    assert.equal(res1, null);

    const res2 = await connectRedis("", mockLog as any);
    assert.equal(res2, null);

    const res3 = await connectRedis("   ", mockLog as any);
    assert.equal(res3, null);

    assert.equal(logs.length, 3);
  });

  it("returns null gracefully and does not throw when connection fails", async () => {
    const logs: unknown[] = [];
    const mockLog = {
      info: (obj: unknown) => logs.push(obj),
      warn: (obj: unknown) => logs.push(obj),
      error: (obj: unknown) => logs.push(obj),
      debug: (obj: unknown) => logs.push(obj),
    };

    // Use an unroutable/closed port with short timeout
    const result = await connectRedis("redis://127.0.0.1:54321", mockLog as any, 100);
    assert.equal(result, null);
    assert.ok(logs.some((l: any) => l.event === "scheduler_redis_connection_failed"));
  });

  it("creates redis client with maxRetriesPerRequest set to null for BullMQ compatibility", () => {
    const client = createRedisClient("redis://127.0.0.1:6379");
    assert.equal((client.options as any).maxRetriesPerRequest, null);
    client.disconnect();
  });
});
