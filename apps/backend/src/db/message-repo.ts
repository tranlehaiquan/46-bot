import { and, desc, eq } from "drizzle-orm";
import { createDrizzleDb, type SqliteDatabase } from "./connection.js";
import { messages } from "./schema/index.js";

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
  const orm = createDrizzleDb(db);
  return {
    async insert(params): Promise<MessageRow> {
      const ts = params.ts ?? Date.now();
      const [message] = await orm.insert(messages).values({ ...params, role: params.role, ts }).returning();
      return message as MessageRow;
    },
    async getRecent(chatId: string, limit = 20): Promise<MessageRow[]> {
      const rows = await orm.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(desc(messages.ts), desc(messages.id)).limit(limit);
      return rows.reverse() as MessageRow[];
    },
  };
}
