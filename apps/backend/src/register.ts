import type { Logger } from "./logger.js";
import type { ZaloClient } from "./zalo-client.js";

export async function syncWebhook(
  client: ZaloClient,
  webhookUrl: string,
  webhookSecret: string,
  log: Logger,
): Promise<void> {
  const info = await client.getWebhookInfo();
  if (info.url !== webhookUrl) {
    const result = await client.setWebhook(webhookUrl, webhookSecret);
    log.info({ event: "setWebhook", outcome: result.outcome });
    return;
  }
  const result = await client.testWebhook();
  log.info({ event: "testWebhook", outcome: result.outcome });
}
