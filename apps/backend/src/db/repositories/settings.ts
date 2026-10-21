import { eq } from "drizzle-orm";
import { createDrizzleDb, type SqliteDatabase } from "../connection.js";
import { systemSettings } from "../schema/index.js";
import {
  encryptSetting,
  decryptSetting,
  isEncryptedSetting,
  SENSITIVE_SETTING_KEYS,
} from "../../crypto/encryption.js";

export type SystemSettingRow = {
  key: string;
  value: string;
  updatedAt: number;
};

export interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  getAll(): Promise<Record<string, string>>;
  setMany(entries: Record<string, string | null | undefined>): Promise<void>;
}

export function createSettingsRepository(
  db: SqliteDatabase,
  encryptionSecret?: string,
): SettingsRepository {
  const orm = createDrizzleDb(db);
  const secret = encryptionSecret || process.env.ADMIN_PASSWORD;

  const encryptValue = (key: string, val: string): string => {
    if (!secret || !SENSITIVE_SETTING_KEYS.has(key)) {
      return val;
    }
    if (isEncryptedSetting(val)) {
      return val;
    }
    return encryptSetting(val, secret);
  };

  const decryptValue = (key: string, val: string): string => {
    if (!secret) {
      return val;
    }
    if (isEncryptedSetting(val) || SENSITIVE_SETTING_KEYS.has(key)) {
      try {
        return decryptSetting(val, secret);
      } catch {
        return val;
      }
    }
    return val;
  };

  return {
    async get(key: string): Promise<string | null> {
      const [setting] = await orm
        .select({ value: systemSettings.value })
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);
      return setting ? decryptValue(key, setting.value) : null;
    },

    async set(key: string, value: string): Promise<void> {
      const now = Date.now();
      const valToStore = encryptValue(key, value);
      await orm
        .insert(systemSettings)
        .values({ key, value: valToStore, updatedAt: now })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: valToStore, updatedAt: now },
        });
    },

    async delete(key: string): Promise<void> {
      await orm.delete(systemSettings).where(eq(systemSettings.key, key));
    },

    async getAll(): Promise<Record<string, string>> {
      const result: Record<string, string> = {};
      for (const row of await orm
        .select({ key: systemSettings.key, value: systemSettings.value })
        .from(systemSettings)) {
        result[row.key] = decryptValue(row.key, row.value);
      }
      return result;
    },

    async setMany(entries: Record<string, string | null | undefined>): Promise<void> {
      const now = Date.now();
      for (const [key, val] of Object.entries(entries)) {
        if (val === null || val === undefined) {
          await orm.delete(systemSettings).where(eq(systemSettings.key, key));
        } else {
          const valToStore = encryptValue(key, val);
          await orm
            .insert(systemSettings)
            .values({ key, value: valToStore, updatedAt: now })
            .onConflictDoUpdate({
              target: systemSettings.key,
              set: { value: valToStore, updatedAt: now },
            });
        }
      }
    },
  };
}
