import { eq } from "drizzle-orm";
import { createDrizzleDb, type SqliteDatabase } from "../connection.js";
import { systemSettings } from "../schema/index.js";

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

export function createSettingsRepository(db: SqliteDatabase): SettingsRepository {
  const orm = createDrizzleDb(db);
  return {
    async get(key: string): Promise<string | null> {
      const [setting] = await orm.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
      return setting?.value ?? null;
    },

    async set(key: string, value: string): Promise<void> {
      const now = Date.now();
      await orm.insert(systemSettings).values({ key, value, updatedAt: now }).onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: now } });
    },

    async delete(key: string): Promise<void> {
      await orm.delete(systemSettings).where(eq(systemSettings.key, key));
    },

    async getAll(): Promise<Record<string, string>> {
      const result: Record<string, string> = {};
      for (const row of await orm.select({ key: systemSettings.key, value: systemSettings.value }).from(systemSettings)) {
        result[row.key] = row.value;
      }
      return result;
    },

    async setMany(entries: Record<string, string | null | undefined>): Promise<void> {
      const now = Date.now();
      for (const [key, val] of Object.entries(entries)) {
        if (val === null || val === undefined) {
          await orm.delete(systemSettings).where(eq(systemSettings.key, key));
        } else {
          await orm.insert(systemSettings).values({ key, value: val, updatedAt: now }).onConflictDoUpdate({ target: systemSettings.key, set: { value: val, updatedAt: now } });
        }
      }
    },
  };
}
