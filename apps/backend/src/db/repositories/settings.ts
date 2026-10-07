import type { SqliteDatabase } from "../connection.js";

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
  return {
    async get(key: string): Promise<string | null> {
      const res = await db.execute({
        sql: "SELECT value FROM system_settings WHERE key = ?",
        args: [key],
      });
      if (res.rows.length === 0) return null;
      return String(res.rows[0].value);
    },

    async set(key: string, value: string): Promise<void> {
      const now = Date.now();
      await db.execute({
        sql: `INSERT INTO system_settings (key, value, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        args: [key, value, now],
      });
    },

    async delete(key: string): Promise<void> {
      await db.execute({
        sql: "DELETE FROM system_settings WHERE key = ?",
        args: [key],
      });
    },

    async getAll(): Promise<Record<string, string>> {
      const res = await db.execute({
        sql: "SELECT key, value FROM system_settings",
        args: [],
      });
      const result: Record<string, string> = {};
      for (const row of res.rows) {
        result[String(row.key)] = String(row.value);
      }
      return result;
    },

    async setMany(entries: Record<string, string | null | undefined>): Promise<void> {
      const now = Date.now();
      for (const [key, val] of Object.entries(entries)) {
        if (val === null || val === undefined) {
          await db.execute({
            sql: "DELETE FROM system_settings WHERE key = ?",
            args: [key],
          });
        } else {
          await db.execute({
            sql: `INSERT INTO system_settings (key, value, updated_at)
                  VALUES (?, ?, ?)
                  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            args: [key, val, now],
          });
        }
      }
    },
  };
}
