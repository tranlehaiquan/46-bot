import os from "node:os";
import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";
import type { ListRepository } from "./db/list-repo.js";
import type { MessageRepository } from "./db/message-repo.js";
import type { EventsRepository } from "./db/repositories/events.js";
import type { MemoryRepository } from "./db/repositories/memory.js";
import type { ChannelRepository } from "./db/repositories/channels.js";
import type { LookupRepository } from "./db/repositories/lookups.js";
import type { SeenRepository } from "./db/seen-repo.js";
import type { LlmClient } from "./llm/client.js";
import { handleDelivery } from "./delivery.js";
import type { Logger } from "./logger.js";
import { WorkQueue } from "./queue.js";
import { secretsMatch } from "./secrets.js";
import type { ZaloClient } from "./zalo-client.js";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import fs from "node:fs";
import { registerAdminRoutes } from "./admin/routes.js";

import type { SqliteDatabase } from "./db/connection.js";

export const BODY_LIMIT = 64 * 1024;

export type ServerDeps = {
  config: AppConfig;
  log: Logger;
  zalo: ZaloClient;
  db?: SqliteDatabase;
  queue?: WorkQueue;
  seenRepo?: SeenRepository;
  messageRepo?: MessageRepository;
  listRepo?: ListRepository;
  eventsRepo?: EventsRepository;
  memoryRepo?: MemoryRepository;
  channelRepo?: ChannelRepository;
  lookupsRepo?: LookupRepository;
  llmClient?: LlmClient;
};

export function getEventsImageDir(dbPath?: string): string {
  const candidates: string[] = [];
  if (dbPath && dbPath !== ":memory:" && !dbPath.startsWith(":memory:")) {
    candidates.push(path.join(path.dirname(dbPath), "images", "events"));
  }
  candidates.push(path.resolve(process.cwd(), "data", "images", "events"));
  candidates.push(path.join(os.tmpdir(), "family-bot", "images", "events"));

  for (const candidate of candidates) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      return candidate;
    } catch {
      // try next candidate
    }
  }
  const fallback = path.join(os.tmpdir(), "family-bot", "images", "events");
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

export function buildServer(deps: ServerDeps): FastifyInstance {
  const queue = deps.queue ?? new WorkQueue();
  const seen = new Set<string>();
  const app = Fastify({
    logger: false,
    bodyLimit: BODY_LIMIT,
  });

  const eventsImageDir = getEventsImageDir(deps.config.dbPath);
  fs.mkdirSync(eventsImageDir, { recursive: true });

  app.get("/images/events/:filename", async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const safeFilename = path.basename(filename);
    const candidateDirs = [
      eventsImageDir,
      path.resolve(process.cwd(), "data", "images", "events"),
      path.resolve(process.cwd(), "apps/backend/data/images/events"),
      path.join(os.tmpdir(), "family-bot", "images", "events"),
    ];
    for (const dir of candidateDirs) {
      const fullPath = path.join(dir, safeFilename);
      if (fs.existsSync(fullPath)) {
        reply.header("Cache-Control", "public, max-age=3600, s-maxage=3600");
        const stream = fs.createReadStream(fullPath);
        return reply.type("image/png").send(stream);
      }
    }
    reply.header("Cache-Control", "no-store, no-cache, must-revalidate");
    return reply.code(404).send({ message: "Image not found" });
  });

  app.register(fastifyStatic, {
    root: eventsImageDir,
    prefix: "/images/events/",
    decorateReply: false,
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
        channelRepo: deps.channelRepo,
        lookupsRepo: deps.lookupsRepo,
        llmClient: deps.llmClient,
        seen,
      }),
    );
  });

  registerAdminRoutes(app, deps);

  const candidateDistPaths = [
    path.resolve(process.cwd(), "apps/admin/dist"),
    path.resolve(process.cwd(), "../admin/dist"),
    path.resolve(process.cwd(), "web/dist"),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../admin/dist"),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../apps/admin/dist"),
  ];
  const webDistPath = candidateDistPaths.find((p) => fs.existsSync(p)) ?? candidateDistPaths[0];

  if (fs.existsSync(webDistPath)) {
    app.register(fastifyStatic, {
      root: webDistPath,
      prefix: "/admin/",
    });

    app.get("/admin", async (_req, reply) => {
      return reply.redirect("/admin/");
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/admin")) {
        return reply.sendFile("index.html", webDistPath);
      }
      return reply.code(404).send({ message: "Not Found" });
    });
  }

  return app;
}
