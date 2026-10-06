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
  }): Promise<MessageRow>;
  getRecent(chatId: string, limit?: number): Promise<MessageRow[]>;
}

export function createMessageRepository(db: SqliteDatabase): MessageRepository {
  return {
    async insert(params): Promise<MessageRow> {
      const ts = params.ts ?? Date.now();
      const res = await db.execute({
        sql: `INSERT INTO messages (chat_id, sender_id, sender_name, role, content, ts) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          params.chatId,
          params.senderId,
          params.senderName,
          params.role,
          params.content,
          ts,
        ],
      });
      return {
        id: Number(res.lastInsertRowid),
        chatId: params.chatId,
        senderId: params.senderId,
        senderName: params.senderName,
        role: params.role,
        content: params.content,
        ts,
      };
    },
    async getRecent(chatId: string, limit = 20): Promise<MessageRow[]> {
      const res = await db.execute({
        sql: `SELECT id, chat_id as chatId, sender_id as senderId, sender_name as senderName, role, content, ts
              FROM messages
              WHERE chat_id = ?
              ORDER BY ts DESC, id DESC
              LIMIT ?`,
        args: [chatId, limit],
      });
      const rows: MessageRow[] = res.rows.map((row: any) => ({
        id: Number(row.id),
        chatId: String(row.chatId),
        senderId: String(row.senderId),
        senderName: String(row.senderName),
        role: row.role as "user" | "assistant",
        content: String(row.content),
        ts: Number(row.ts),
      }));
      return rows.reverse();
    },
  };
}
