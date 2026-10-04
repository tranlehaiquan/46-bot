import { createRequire } from "node:module";
import { redactText } from "./redact.js";

const require = createRequire(import.meta.url);

export type ZaloClient = {
  getWebhookInfo(): Promise<{ url: string }>;
  setWebhook(url: string, secret: string): Promise<{ outcome: string }>;
  testWebhook(): Promise<{ outcome: string }>;
  sendMessage(chatId: string, text: string): Promise<void>;
};

type SdkBot = {
  getWebhookInfo(): Promise<{ url?: string } | undefined>;
  setWebhook(url: string, secretToken: string): Promise<{ verification?: { outcome?: string } } | undefined>;
  testWebhook(): Promise<{ outcome?: string } | undefined>;
  sendMessage(chatId: string, text: string): Promise<unknown>;
};

type BotConstructor = new (config: {
  token: string;
  logger?: { error(message: string, error: unknown): void };
}) => SdkBot;

export function createZaloClient(token: string): ZaloClient {
  const { Bot } = require("zalo-bot-js") as { Bot: BotConstructor };
  const bot = new Bot({
    token,
    logger: {
      error(message, error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.error(redactText(`${message} ${detail}`, [token]));
      },
    },
  });

  return {
    async getWebhookInfo() {
      const info = await bot.getWebhookInfo();
      return { url: info?.url ?? "" };
    },
    async setWebhook(url, secret) {
      const result = await bot.setWebhook(url, secret);
      return { outcome: result?.verification?.outcome ?? "" };
    },
    async testWebhook() {
      const result = await bot.testWebhook();
      return { outcome: result?.outcome ?? "" };
    },
    async sendMessage(chatId, text) {
      await bot.sendMessage(chatId, text);
    },
  };
}
