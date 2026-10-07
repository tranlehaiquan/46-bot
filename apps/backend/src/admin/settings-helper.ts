import type { AppConfig } from "../config.js";
import type { SettingsRepository } from "../db/repositories/settings.js";
import { createLlmClient, type LlmClient, type LlmClientOptions } from "../llm/client.js";

export type EffectiveSettings = {
  llmProvider: "gemini" | "deepseek";
  geminiModel: string;
  geminiApiKey?: string;
  deepseekModel: string;
  deepseekApiKey?: string;
  tavilyApiKey?: string;
};

export type MaskedSettings = {
  llmProvider: "gemini" | "deepseek";
  geminiModel: string;
  hasGeminiApiKey: boolean;
  geminiApiKeyMasked: string | null;
  geminiApiKeySource: "db" | "env" | "none";
  deepseekModel: string;
  hasDeepseekApiKey: boolean;
  deepseekApiKeyMasked: string | null;
  deepseekApiKeySource: "db" | "env" | "none";
  hasTavilyApiKey: boolean;
  tavilyApiKeyMasked: string | null;
  tavilyApiKeySource: "db" | "env" | "none";
};

export function maskSecret(secret?: string): string | null {
  if (!secret || secret.trim() === "") return null;
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return "********";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export async function resolveEffectiveSettings(
  repo: SettingsRepository | undefined,
  config: AppConfig,
): Promise<{ effective: EffectiveSettings; dbEntries: Record<string, string> }> {
  const dbEntries = repo ? await repo.getAll() : {};

  const rawProvider = dbEntries.llm_provider || config.llmProvider;
  const llmProvider: "gemini" | "deepseek" =
    rawProvider === "gemini" || rawProvider === "deepseek" ? rawProvider : "gemini";

  const geminiModel = dbEntries.gemini_model || config.geminiModel || "gemini-3.8-flash";
  const geminiApiKey = dbEntries.gemini_api_key || config.geminiApiKey;

  const deepseekModel = dbEntries.deepseek_model || config.deepseekModel || "deepseek-chat";
  const deepseekApiKey = dbEntries.deepseek_api_key || config.deepseekApiKey;

  const tavilyApiKey = dbEntries.tavily_api_key || config.tavilyApiKey;

  return {
    effective: {
      llmProvider,
      geminiModel,
      geminiApiKey,
      deepseekModel,
      deepseekApiKey,
      tavilyApiKey,
    },
    dbEntries,
  };
}

export function toMaskedSettings(
  effective: EffectiveSettings,
  dbEntries: Record<string, string>,
  config: AppConfig,
): MaskedSettings {
  const geminiSource: "db" | "env" | "none" = dbEntries.gemini_api_key
    ? "db"
    : config.geminiApiKey
      ? "env"
      : "none";

  const deepseekSource: "db" | "env" | "none" = dbEntries.deepseek_api_key
    ? "db"
    : config.deepseekApiKey
      ? "env"
      : "none";

  const tavilySource: "db" | "env" | "none" = dbEntries.tavily_api_key
    ? "db"
    : config.tavilyApiKey
      ? "env"
      : "none";

  return {
    llmProvider: effective.llmProvider,
    geminiModel: effective.geminiModel,
    hasGeminiApiKey: Boolean(effective.geminiApiKey),
    geminiApiKeyMasked: maskSecret(effective.geminiApiKey),
    geminiApiKeySource: geminiSource,
    deepseekModel: effective.deepseekModel,
    hasDeepseekApiKey: Boolean(effective.deepseekApiKey),
    deepseekApiKeyMasked: maskSecret(effective.deepseekApiKey),
    deepseekApiKeySource: deepseekSource,
    hasTavilyApiKey: Boolean(effective.tavilyApiKey),
    tavilyApiKeyMasked: maskSecret(effective.tavilyApiKey),
    tavilyApiKeySource: tavilySource,
  };
}

export class DynamicLlmClient implements LlmClient {
  private client: LlmClient;

  constructor(initialClient: LlmClient) {
    this.client = initialClient;
  }

  setClient(newClient: LlmClient): void {
    this.client = newClient;
  }

  getClient(): LlmClient {
    return this.client;
  }

  async generateReply(params: Parameters<LlmClient["generateReply"]>[0]): Promise<string> {
    return this.client.generateReply(params);
  }
}

export function createLlmClientFromSettings(settings: EffectiveSettings): LlmClient | null {
  const provider = settings.llmProvider;
  const apiKey = provider === "gemini" ? settings.geminiApiKey : settings.deepseekApiKey;
  const modelName = provider === "gemini" ? settings.geminiModel : settings.deepseekModel;

  if (!apiKey) {
    return null;
  }

  return createLlmClient({
    provider,
    apiKey,
    modelName,
  });
}
