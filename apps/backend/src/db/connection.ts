import { createClient, type Client } from "@libsql/client";
import { dirname, basename, resolve } from "node:path";
import { mkdirSync } from "node:fs";

export type SqliteDatabase = Client;

export function openDatabase(dbPathOrUrl: string, authToken?: string): SqliteDatabase {
  const url = dbPathOrUrl;

  // Remote Turso or libSQL endpoints (libsql://, https://, http://, wss://, ws://)
  if (
    url.startsWith("libsql://") ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("wss://") ||
    url.startsWith("ws://")
  ) {
    return createClient({ url, authToken });
  }

  // In-memory sqlite
  if (url === ":memory:" || url === "file::memory:") {
    return createClient({ url: ":memory:" });
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
    return createClient({ url });
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

  return createClient({ url: `file:${resolvedPath}` });
}

export function closeDatabase(db: SqliteDatabase): void {
  try {
    db.close();
  } catch {
    // Ignore close errors
  }
}
