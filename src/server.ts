import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";
import type { ListRepository } from "./db/list-repo.js";
import type { MessageRepository } from "./db/message-repo.js";
import type { EventsRepository } from "./db/repositories/events.js";
import type { MemoryRepository } from "./db/repositories/memory.js";
import type { SeenRepository } from "./db/seen-repo.js";
import type { LlmClient } from "./llm/client.js";
import { handleDelivery } from "./delivery.js";
import type { Logger } from "./logger.js";
import { WorkQueue } from "./queue.js";
import { secretsMatch } from "./secrets.js";
import type { ZaloClient } from "./zalo-client.js";

export const BODY_LIMIT = 64 * 1024;

export type ServerDeps = {
  config: AppConfig;
  log: Logger;
  zalo: ZaloClient;
  queue?: WorkQueue;
  seenRepo?: SeenRepository;
  messageRepo?: MessageRepository;
  listRepo?: ListRepository;
  eventsRepo?: EventsRepository;
  memoryRepo?: MemoryRepository;
  llmClient?: LlmClient;
};

export function buildServer(deps: ServerDeps): FastifyInstance {
  const queue = deps.queue ?? new WorkQueue();
  const seen = new Set<string>();
  const app = Fastify({
    logger: false,
    bodyLimit: BODY_LIMIT,
  });

  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: BODY_LIMIT }, (_request, body, done) => {
    done(null, body);
  });

  app.get("/health", async () => ({ ok: true }));

  app.post("/webhooks/zalo", async (request, reply) => {
    const header = request.headers["x-bot-api-secret-token"];
    const secretHeader = Array.isArray(header) ? header[0] : header;
    if (!secretsMatch(secretHeader, deps.config.webhookSecret)) {
      return reply.code(401).send({ message: "Unauthorized" });
    }

    const payload = Buffer.isBuffer(request.body) ? request.body : undefined;
    await reply.code(200).send({ message: "Success" });
    queue.enqueue(() =>
      handleDelivery({
        payload,
        config: deps.config,
        log: deps.log,
        zalo: deps.zalo,
        seenRepo: deps.seenRepo,
        messageRepo: deps.messageRepo,
        listRepo: deps.listRepo,
        eventsRepo: deps.eventsRepo,
        memoryRepo: deps.memoryRepo,
        llmClient: deps.llmClient,
        seen,
      }),
    );
  });

  return app;
}
