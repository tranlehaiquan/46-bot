import { ConfigError, loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { boot, installShutdown, shutdown } from "./lifecycle.js";
import { WorkQueue } from "./queue.js";
import { redactText } from "./redact.js";
import { syncWebhook } from "./register.js";
import { buildServer } from "./server.js";
import { createZaloClient } from "./zalo-client.js";

async function main(): Promise<void> {
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

  const secrets = [config.zaloBotToken, config.webhookSecret];
  const log = createLogger({ secrets });
  const queue = new WorkQueue((error) => {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ event: "delivery_failed", message: redactText(message, secrets) });
  });
  const zalo = createZaloClient(config.zaloBotToken);
  const app = buildServer({ config, log, zalo, queue });

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
    await shutdown(() => app.close(), queue);
    process.exit(0);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  createLogger().error({ event: "fatal", message: redactText(message, []) });
  process.exit(1);
});
