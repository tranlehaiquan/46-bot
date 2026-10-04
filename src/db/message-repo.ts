import type { SqliteDatabase } from "./connection.js";

export type MessageRow = {
  id: number;
  chatId: string;
  senderId: string;
  senderName: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
};

export interface MessageRepository {
  insert(message: {
    chatId: string;
    senderId: string;
    senderName: string;
    role: "user" | "assistant";
    content: string;
    ts?: number;
  }): MessageRow;
  getRecent(chatId: string, limit?: number): MessageRow[];
}

export function createMessageRepository(db: SqliteDatabase): MessageRepository {
  const insertStmt = db.prepare(`
    INSERT INTO messages (chat_id, sender_id, sender_name, role, content, ts)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const selectRecentStmt = db.prepare(`
    SELECT id, chat_id as chatId, sender_id as senderId, sender_name as senderName, role, content, ts
    FROM messages
    WHERE chat_id = ?
    ORDER BY ts DESC, id DESC
    LIMIT ?
  `);

  return {
    insert(params): MessageRow {
      const ts = params.ts ?? Date.now();
      const info = insertStmt.run(
        params.chatId,
        params.senderId,
        params.senderName,
        params.role,
        params.content,
        ts,
      );
      return {
        id: Number(info.lastInsertRowid),
        chatId: params.chatId,
        senderId: params.senderId,
        senderName: params.senderName,
        role: params.role,
        content: params.content,
        ts,
      };
    },
    getRecent(chatId: string, limit = 20): MessageRow[] {
      const rows = selectRecentStmt.all(chatId, limit) as MessageRow[];
      // Return chronological order (oldest to newest)
      return rows.reverse();
    },
  };
}
