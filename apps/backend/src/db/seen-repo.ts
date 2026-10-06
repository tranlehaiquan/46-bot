import type { SqliteDatabase } from "./connection.js";

export interface SeenRepository {
  hasSeen(messageId: string): Promise<boolean>;
  markSeen(messageId: string): Promise<boolean>;
}

export function createSeenRepository(db: SqliteDatabase): SeenRepository {
  return {
    async hasSeen(messageId: string): Promise<boolean> {
      const res = await db.execute({
        sql: "SELECT 1 FROM seen_messages WHERE message_id = ?",
        args: [messageId],
      });
      return res.rows.length > 0;
    },
    async markSeen(messageId: string): Promise<boolean> {
      const res = await db.execute({
        sql: "INSERT OR IGNORE INTO seen_messages (message_id, ts) VALUES (?, ?)",
        args: [messageId, Date.now()],
      });
      return res.rowsAffected > 0;
    },
  };
}
