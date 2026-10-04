import type { SqliteDatabase } from "./connection.js";

export interface SeenRepository {
  hasSeen(messageId: string): boolean;
  markSeen(messageId: string): boolean;
}

export function createSeenRepository(db: SqliteDatabase): SeenRepository {
  const checkStmt = db.prepare("SELECT 1 FROM seen_messages WHERE message_id = ?");
  const insertStmt = db.prepare(
    "INSERT OR IGNORE INTO seen_messages (message_id, ts) VALUES (?, ?)",
  );

  return {
    hasSeen(messageId: string): boolean {
      const row = checkStmt.get(messageId);
      return row !== undefined;
    },
    markSeen(messageId: string): boolean {
      const result = insertStmt.run(messageId, Date.now());
      return result.changes > 0;
    },
  };
}
