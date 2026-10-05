const BOT_PATH = /\/bot[^/\s"'\\]+/g;

export function redactText(text: string, secrets: readonly string[]): string {
  let out = text.replace(BOT_PATH, "/bot[redacted]");
  for (const secret of secrets) {
    if (secret.length > 0) {
      out = out.split(secret).join("[redacted]");
    }
  }
  return out;
}

export function redactValue(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === "string") {
    return redactText(value, secrets);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, secrets));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = redactValue(item, secrets);
    }
    return out;
  }
  return value;
}
