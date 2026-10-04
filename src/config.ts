import { z } from "zod";

const envSchema = z.object({
  ZALO_BOT_TOKEN: z
    .string({
      required_error: "ZALO_BOT_TOKEN is required",
      invalid_type_error: "ZALO_BOT_TOKEN is required",
    })
    .min(1, "ZALO_BOT_TOKEN is required"),
  FAMILY_CHAT_ID: z.preprocess((value) => (value === undefined ? "" : value), z.string()),
  FAMILY_CHAT_IDS: z.preprocess((value) => (value === undefined ? "" : value), z.string()),
  WEBHOOK_URL: z
    .string({
      required_error: "WEBHOOK_URL is required",
      invalid_type_error: "WEBHOOK_URL is required",
    })
    .min(1, "WEBHOOK_URL is required")
    .superRefine((value, ctx) => {
      let parsed: URL;
      try {
        parsed = new URL(value);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "WEBHOOK_URL must be an https URL" });
        return;
      }
      if (parsed.protocol !== "https:") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "WEBHOOK_URL must be an https URL" });
      }
    }),
  WEBHOOK_SECRET: z
    .string({
      required_error: "WEBHOOK_SECRET is required",
      invalid_type_error: "WEBHOOK_SECRET is required",
    })
    .superRefine((value, ctx) => {
      if (value.length < 8 || value.length > 256) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "WEBHOOK_SECRET must be 8 to 256 characters",
        });
      }
    }),
  MODE: z
    .string({
      required_error: "MODE is required",
      invalid_type_error: "MODE is required",
    })
    .superRefine((value, ctx) => {
      if (value !== "webhook") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MODE must be webhook" });
      }
    }),
  PORT: z.preprocess(
    (value) => (value === undefined || value === "" ? 3000 : value),
    z.coerce.number({ invalid_type_error: "PORT must be a positive integer" }).int().positive("PORT must be a positive integer"),
  ),
  LLM_PROVIDER: z.preprocess(
    (value) => (value === undefined || value === "" ? undefined : value),
    z.enum(["gemini", "deepseek"]).optional(),
  ),
  GEMINI_API_KEY: z.preprocess(
    (value) => (value === undefined || value === "" ? undefined : value),
    z.string().optional(),
  ),
  GEMINI_MODEL: z.preprocess(
    (value) => (value === undefined || value === "" ? "gemini-3.8-flash" : value),
    z.string().min(1),
  ),
  DEEPSEEK_API_KEY: z.preprocess(
    (value) => (value === undefined || value === "" ? undefined : value),
    z.string().optional(),
  ),
  DEEPSEEK_MODEL: z.preprocess(
    (value) => (value === undefined || value === "" ? "deepseek-chat" : value),
    z.string().min(1),
  ),
  DB_PATH: z.preprocess(
    (value) => (value === undefined || value === "" ? "/data/family.db" : value),
    z.string().min(1),
  ),
  BOT_ID: z.preprocess((value) => (value === undefined ? "" : value), z.string()),
  TAVILY_API_KEY: z.preprocess(
    (value) => (value === undefined || value === "" ? undefined : value),
    z.string().optional(),
  ),
}).superRefine((data, ctx) => {
  const chosenProvider = data.LLM_PROVIDER ?? (data.GEMINI_API_KEY ? "gemini" : data.DEEPSEEK_API_KEY ? "deepseek" : undefined);
  if (!chosenProvider) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["LLM_API_KEY"],
      message: "Either GEMINI_API_KEY or DEEPSEEK_API_KEY is required",
    });
    return;
  }
  if (chosenProvider === "gemini" && !data.GEMINI_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["GEMINI_API_KEY"],
      message: "GEMINI_API_KEY is required when LLM_PROVIDER is gemini",
    });
  }
  if (chosenProvider === "deepseek" && !data.DEEPSEEK_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DEEPSEEK_API_KEY"],
      message: "DEEPSEEK_API_KEY is required when LLM_PROVIDER is deepseek",
    });
  }
});

export class ConfigError extends Error {
  readonly variables: string[];

  constructor(variables: string[], message: string) {
    super(message);
    this.name = "ConfigError";
    this.variables = variables;
  }
}

export type AppConfig = {
  zaloBotToken: string;
  familyChatId: string;
  familyChatIds: string[];
  webhookUrl: string;
  webhookSecret: string;
  mode: "webhook";
  port: number;
  dbPath: string;
  botId: string;
  llmProvider: "gemini" | "deepseek";
  llmApiKey: string;
  llmModel: string;
  geminiApiKey?: string;
  geminiModel: string;
  deepseekApiKey?: string;
  deepseekModel: string;
  tavilyApiKey?: string;
};

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const variables = [
      ...new Set(
        parsed.error.issues.map((issue) => {
          const key = issue.path[0];
          return typeof key === "string" ? key : "config";
        }),
      ),
    ];
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new ConfigError(variables, message);
  }

  const provider = parsed.data.LLM_PROVIDER ?? (parsed.data.GEMINI_API_KEY ? "gemini" : "deepseek");
  const apiKey = provider === "gemini" ? parsed.data.GEMINI_API_KEY! : parsed.data.DEEPSEEK_API_KEY!;
  const model = provider === "gemini" ? parsed.data.GEMINI_MODEL : parsed.data.DEEPSEEK_MODEL;

  const rawChatIds = (parsed.data.FAMILY_CHAT_IDS && parsed.data.FAMILY_CHAT_IDS.trim() !== "")
    ? parsed.data.FAMILY_CHAT_IDS
    : parsed.data.FAMILY_CHAT_ID;
  const familyChatIds = rawChatIds
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const familyChatId = familyChatIds[0] ?? "";

  return {
    zaloBotToken: parsed.data.ZALO_BOT_TOKEN,
    familyChatId,
    familyChatIds,
    webhookUrl: parsed.data.WEBHOOK_URL,
    webhookSecret: parsed.data.WEBHOOK_SECRET,
    mode: "webhook",
    port: parsed.data.PORT,
    dbPath: parsed.data.DB_PATH,
    botId: parsed.data.BOT_ID,
    llmProvider: provider,
    llmApiKey: apiKey,
    llmModel: model,
    geminiApiKey: parsed.data.GEMINI_API_KEY,
    geminiModel: parsed.data.GEMINI_MODEL,
    deepseekApiKey: parsed.data.DEEPSEEK_API_KEY,
    deepseekModel: parsed.data.DEEPSEEK_MODEL,
    tavilyApiKey: parsed.data.TAVILY_API_KEY,
  };
}
