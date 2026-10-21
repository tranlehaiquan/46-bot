import crypto from "node:crypto";

export const ENCRYPTION_PREFIX = "enc:v1:";

export const SENSITIVE_SETTING_KEYS = new Set<string>([
  "gemini_api_key",
  "deepseek_api_key",
  "tavily_api_key",
  "crawl4ai_api_token",
  "zipline_token",
]);

/**
 * Derives a 32-byte AES-256 key from a passphrase using HKDF-SHA256.
 */
export function deriveKey(secret: string, salt: string = "46bot:settings:salt"): Buffer {
  if (!secret) {
    throw new Error("Cannot derive key from empty secret");
  }
  const key = crypto.hkdfSync(
    "sha256",
    Buffer.from(secret, "utf8"),
    Buffer.from(salt, "utf8"),
    Buffer.from("settings-encryption", "utf8"),
    32,
  );
  return Buffer.from(key);
}

/**
 * Checks whether a given string is in the encrypted settings format.
 */
export function isEncryptedSetting(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(ENCRYPTION_PREFIX);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Formats output as: enc:v1:<iv_base64url>:<auth_tag_base64url>:<ciphertext_base64url>
 */
export function encryptSetting(plaintext: string, secretOrKey: string | Buffer): string {
  if (plaintext === "") return "";
  const key = Buffer.isBuffer(secretOrKey) ? secretOrKey : deriveKey(secretOrKey);

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

/**
 * Decrypts an encrypted setting string.
 * If the value is not prefixed with `enc:v1:`, it returns the value as-is (backward compatibility).
 */
export function decryptSetting(value: string, secretOrKey: string | Buffer): string {
  if (!isEncryptedSetting(value)) {
    return value;
  }

  const payload = value.slice(ENCRYPTION_PREFIX.length);
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted setting format");
  }

  const [ivB64, tagB64, cipherB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const ciphertext = Buffer.from(cipherB64, "base64url");

  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error("Invalid IV or authentication tag length");
  }

  const key = Buffer.isBuffer(secretOrKey) ? secretOrKey : deriveKey(secretOrKey);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    throw new Error(`Failed to decrypt setting: ${(err as Error).message}`);
  }
}
