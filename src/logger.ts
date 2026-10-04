import { redactValue } from "./redact.js";

export type Logger = {
  info(fields: Record<string, unknown>): void;
  error(fields: Record<string, unknown>): void;
};

export function createLogger(options?: {
  write?: (line: string) => void;
  secrets?: readonly string[];
}): Logger {
  const write = options?.write ?? ((line: string) => process.stdout.write(`${line}\n`));
  const secrets = options?.secrets ?? [];
  const emit = (level: "info" | "error", fields: Record<string, unknown>) => {
    const sanitized = redactValue({ level, ...fields }, secrets);
    write(JSON.stringify(sanitized));
  };
  return {
    info(fields) {
      emit("info", fields);
    },
    error(fields) {
      emit("error", fields);
    },
  };
}
