import { z } from "zod";

const envSchema = z.object({
  ZALO_BOT_TOKEN: z
    .string({
      required_error: "ZALO_BOT_TOKEN is required",
      invalid_type_error: "ZALO_BOT_TOKEN is required",
    })
    .min(1, "ZALO_BOT_TOKEN is required"),
  FAMILY_CHAT_ID: z.preprocess((value) => (value === undefined ? "" : value), z.string()),
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
  webhookUrl: string;
  webhookSecret: string;
  mode: "webhook";
  port: number;
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

  return {
    zaloBotToken: parsed.data.ZALO_BOT_TOKEN,
    familyChatId: parsed.data.FAMILY_CHAT_ID,
    webhookUrl: parsed.data.WEBHOOK_URL,
    webhookSecret: parsed.data.WEBHOOK_SECRET,
    mode: "webhook",
    port: parsed.data.PORT,
  };
}
