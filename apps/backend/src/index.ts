import { ConfigError, loadConfig } from "./config.js";
import { closeDatabase, openDatabase } from "./db/connection.js";
import { createListRepository } from "./db/list-repo.js";
import { createMessageRepository } from "./db/message-repo.js";
import { migrate } from "./db/migrations.js";
import { createEventsRepository } from "./db/repositories/events.js";
import { createMemoryRepository } from "./db/repositories/memory.js";
import { createChannelRepository } from "./db/repositories/channels.js";
import { createLookupRepository } from "./db/repositories/lookups.js";
import { createSeenRepository } from "./db/seen-repo.js";
import { createLlmClient } from "./llm/client.js";
import { createLogger } from "./logger.js";
import { boot, installShutdown, shutdown } from "./lifecycle.js";
import { WorkQueue } from "./queue.js";
import { redactText } from "./redact.js";
import { syncWebhook } from "./register.js";
import { buildServer } from "./server.js";
import { createZaloClient } from "./zalo-client.js";
import { startScheduler } from "./scheduler/index.js";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function loadEnvIfAvailable(): void {
  const envCandidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../.env"),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../.env"),
  ];
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      try {
        if (typeof (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile === "function") {
          (process as unknown as { loadEnvFile: (path: string) => void }).loadEnvFile(envPath);
        }
      } catch {
        // ignore if already loaded or parsing error
      }
    }
  }
}

async function main(): Promise<void> {
  loadEnvIfAvailable();
  const startupLog = createLogger();
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      startupLog.error({
        event: "config_invalid",
        message: error.message,
        variables: error.variables,
      });
      process.exit(1);
    }
    throw error;
  }

  const secrets = [
    config.zaloBotToken,
    config.webhookSecret,
    config.llmApiKey,
    config.geminiApiKey,
    config.deepseekApiKey,
  ].filter((s): s is string => typeof s === "string" && s.length > 0);
  const log = createLogger({ secrets });
  const queue = new WorkQueue((error) => {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ event: "delivery_failed", message: redactText(message, secrets) });
  });

  const db = openDatabase(config.dbPath);
  migrate(db);
  const seenRepo = createSeenRepository(db);
  const messageRepo = createMessageRepository(db);
  const listRepo = createListRepository(db);
  const eventsRepo = createEventsRepository(db);
  const memoryRepo = createMemoryRepository(db);
  const channelRepo = createChannelRepository(db);
  const lookupsRepo = createLookupRepository(db);
  if (config.familyChatIds.length > 0) {
    channelRepo.seedChannels(config.familyChatIds);
  }

  const llmClient = createLlmClient({
    provider: config.llmProvider,
    apiKey: config.llmApiKey,
    modelName: config.llmModel,
  });

  const zalo = createZaloClient(config.zaloBotToken);
  const app = buildServer({
    config,
    log,
    zalo,
    db,
    queue,
    seenRepo,
    messageRepo,
    listRepo,
    eventsRepo,
    memoryRepo,
    channelRepo,
    lookupsRepo,
    llmClient,
  });

  const scheduler = startScheduler({
    config,
    eventsRepo,
    zalo,
    log,
    lookupsRepo,
    channelsRepo: channelRepo,
    llm: llmClient,
  });

  await boot(
    async () => {
      await app.listen({ port: config.port, host: "0.0.0.0" });
      log.info({ event: "listening", port: config.port });
    },
    async () => {
      try {
        await syncWebhook(zalo, config.webhookUrl, config.webhookSecret, log);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error({ event: "webhook_registration_failed", message: redactText(message, secrets) });
        process.exit(1);
      }
    },
  );

  installShutdown(process, async () => {
    await shutdown(
      () => {
        scheduler.stop();
        return app.close();
      },
      queue,
      () => {
        closeDatabase(db);
        log.info({ event: "db_closed" });
      },
    );
    process.exit(0);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  createLogger().error({ event: "fatal", message: redactText(message, []) });
  process.exit(1);
});
