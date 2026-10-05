import Database from "better-sqlite3";
import { dirname, basename, resolve } from "node:path";
import { mkdirSync } from "node:fs";

export type SqliteDatabase = Database.Database;

export function openDatabase(dbPath: string): SqliteDatabase {
  let resolvedPath = dbPath;

  if (dbPath !== ":memory:") {
    const dir = dirname(resolvedPath);
    try {
      mkdirSync(dir, { recursive: true });
    } catch (err) {
      // If dbPath is absolute (e.g. /data/family.db configured for Docker)
      // and cannot be written locally (e.g. on macOS without root permissions),
      // fallback to local ./data relative to current working directory.
      const fallbackPath = resolve(process.cwd(), "./data", basename(dbPath));
      const fallbackDir = dirname(fallbackPath);
      try {
        mkdirSync(fallbackDir, { recursive: true });
        resolvedPath = fallbackPath;
      } catch {
        throw err;
      }
    }
  }

  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  return db;
}

export function closeDatabase(db: SqliteDatabase): void {
  if (db.open) {
    db.close();
  }
}
