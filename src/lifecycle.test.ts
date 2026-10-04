import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import { createLogger } from "./logger.js";
import { boot, installShutdown, shutdown } from "./lifecycle.js";
import { redactText } from "./redact.js";
import { WorkQueue } from "./queue.js";

describe("redactText", () => {
  it("removes the bot token from a URL path", () => {
    const token = "123456:abcDEF";
    const url = `https://bot-api.zaloplatforms.com/bot${token}/sendMessage`;
    const lines: string[] = [];
    const log = createLogger({ write: (line) => lines.push(line), secrets: [token] });
    log.error({ message: url });
    assert.equal(lines[0]?.includes(token), false);
    assert.match(lines[0] ?? "", /\/bot\[redacted\]\/sendMessage/);
    assert.equal(redactText(url, []).includes(token), false);
  });
});

describe("lifecycle", () => {
  it("listens before it registers the webhook", async () => {
    const events: string[] = [];
    await boot(
      async () => {
        events.push("listen");
      },
      async () => {
        assert.deepEqual(events, ["listen"]);
        events.push("register");
      },
    );
    assert.deepEqual(events, ["listen", "register"]);
  });

  it("drains the queue when SIGTERM runs shutdown", async () => {
    const events: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queue = new WorkQueue();
    queue.enqueue(async () => {
      events.push("start");
      await gate;
      events.push("finish");
    });
    await new Promise((resolve) => setImmediate(resolve));
    const source = new EventEmitter();
    const done = new Promise<void>((resolve) => {
      installShutdown(source, async () => {
        await shutdown(async () => {
          events.push("close");
          release();
        }, queue);
        events.push("shutdown-done");
        resolve();
      });
    });
    source.emit("SIGTERM");
    await done;
    assert.deepEqual(events, ["start", "close", "finish", "shutdown-done"]);
  });
});
