import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { dirname, basename, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import * as schema from "./schema/index.js";

export type SqliteDatabase = Client;
export type DrizzleDatabase = LibSQLDatabase<typeof schema>;

/** A connected LibSQL client with its schema-aware Drizzle facade. */
export type DatabaseConnection = SqliteDatabase & { drizzle: DrizzleDatabase };

export function openDatabase(dbPathOrUrl: string, authToken?: string): DatabaseConnection {
  const url = dbPathOrUrl;

  // Remote Turso or libSQL endpoints (libsql://, https://, http://, wss://, ws://)
  if (
    url.startsWith("libsql://") ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("wss://") ||
    url.startsWith("ws://")
  ) {
    return attachDrizzle(createClient({ url, authToken }));
  }

  // In-memory sqlite
  if (url === ":memory:" || url === "file::memory:") {
    return attachDrizzle(createClient({ url: ":memory:" }));
  }

  // If already a file: URL
  if (url.startsWith("file:")) {
    const rawPath = url.slice(5);
    const dir = dirname(rawPath);
    if (dir && dir !== "." && dir !== "/") {
      try {
        mkdirSync(dir, { recursive: true });
      } catch {
        // Ignore
      }
    }
    return attachDrizzle(createClient({ url }));
  }

  // Local filesystem path (e.g. /data/family.db or ./data/family.db)
  let resolvedPath = url;
  const dir = dirname(resolvedPath);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    const fallbackPath = resolve(process.cwd(), "./data", basename(url));
    const fallbackDir = dirname(fallbackPath);
    try {
      mkdirSync(fallbackDir, { recursive: true });
      resolvedPath = fallbackPath;
    } catch {
      throw err;
    }
  }

  return attachDrizzle(createClient({ url: `file:${resolvedPath}` }));
}

export function closeDatabase(db: SqliteDatabase): void {
  try {
    db.close();
  } catch {
    // Ignore close errors
  }
}

export function createDrizzleDb(client: SqliteDatabase): DrizzleDatabase {
  return "drizzle" in client ? (client as DatabaseConnection).drizzle : drizzle(client, { schema });
}

function attachDrizzle(client: SqliteDatabase): DatabaseConnection {
  return Object.assign(client, { drizzle: drizzle(client, { schema }) });
}
