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
  crawl4aiApiToken?: string;
  imouAppId?: string;
  imouAppSecret?: string;
  imouBaseUrl?: string;
  imouCameras?: string;
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
  hasCrawl4aiApiToken: boolean;
  crawl4aiApiTokenMasked: string | null;
  crawl4aiApiTokenSource: "db" | "env" | "none";
  hasImouAppId: boolean;
  imouAppIdMasked: string | null;
  imouAppIdSource: "db" | "env" | "none";
  hasImouAppSecret: boolean;
  imouAppSecretMasked: string | null;
  imouAppSecretSource: "db" | "env" | "none";
  imouBaseUrl: string;
  imouBaseUrlSource: "db" | "env";
  imouCameras: string;
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
  const crawl4aiApiToken = dbEntries.crawl4ai_api_token || config.crawl4aiApiToken;

  const imouAppId = dbEntries.imou_app_id || config.imouAppId;
  const imouAppSecret = dbEntries.imou_app_secret || config.imouAppSecret;
  const imouBaseUrl = dbEntries.imou_base_url || config.imouBaseUrl || "https://openapi.easy4ip.com/openapi";
  const imouCameras =
    dbEntries.imou_cameras ||
    (config.imouCameras && config.imouCameras.length > 0
      ? JSON.stringify(config.imouCameras)
      : "[]");

  return {
    effective: {
      llmProvider,
      geminiModel,
      geminiApiKey,
      deepseekModel,
      deepseekApiKey,
      tavilyApiKey,
      crawl4aiApiToken,
      imouAppId,
      imouAppSecret,
      imouBaseUrl,
      imouCameras,
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

  const crawl4aiSource: "db" | "env" | "none" = dbEntries.crawl4ai_api_token
    ? "db"
    : config.crawl4aiApiToken
      ? "env"
      : "none";

  const imouAppIdSource: "db" | "env" | "none" = dbEntries.imou_app_id
    ? "db"
    : config.imouAppId
      ? "env"
      : "none";

  const imouAppSecretSource: "db" | "env" | "none" = dbEntries.imou_app_secret
    ? "db"
    : config.imouAppSecret
      ? "env"
      : "none";

  const imouBaseUrlSource: "db" | "env" = dbEntries.imou_base_url ? "db" : "env";

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
    hasCrawl4aiApiToken: Boolean(effective.crawl4aiApiToken),
    crawl4aiApiTokenMasked: maskSecret(effective.crawl4aiApiToken),
    crawl4aiApiTokenSource: crawl4aiSource,
    hasImouAppId: Boolean(effective.imouAppId),
    imouAppIdMasked: maskSecret(effective.imouAppId),
    imouAppIdSource: imouAppIdSource,
    hasImouAppSecret: Boolean(effective.imouAppSecret),
    imouAppSecretMasked: maskSecret(effective.imouAppSecret),
    imouAppSecretSource: imouAppSecretSource,
    imouBaseUrl: effective.imouBaseUrl || "https://openapi.easy4ip.com/openapi",
    imouBaseUrlSource: imouBaseUrlSource,
    imouCameras: effective.imouCameras || "[]",
  };
}

export async function testCrawl4AiConnection(
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!token || token.trim() === "") {
    return { success: false, error: "Crawl4AI API token is required" };
  }
  try {
    const res = await fetchFn("https://api.crawl4ai.com/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, error: `Crawl4AI test failed (${res.status}): ${text || res.statusText}` };
    }
    return { success: true, message: "Kết nối Crawl4AI Cloud API thành công" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to connect to Crawl4AI API" };
  }
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

  async extractMemories(
    params: Parameters<NonNullable<LlmClient["extractMemories"]>>[0],
  ): Promise<Array<{ subject: string; fact: string; category: "core" | "general" }>> {
    if (typeof this.client.extractMemories === "function") {
      return this.client.extractMemories(params);
    }
    return [];
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
