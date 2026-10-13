import { eq } from "drizzle-orm";
import { createDrizzleDb, type SqliteDatabase } from "./connection.js";
import { seenMessages } from "./schema/index.js";

export interface SeenRepository {
  hasSeen(messageId: string): Promise<boolean>;
  markSeen(messageId: string): Promise<boolean>;
}

export function createSeenRepository(db: SqliteDatabase): SeenRepository {
  const orm = createDrizzleDb(db);
  return {
    async hasSeen(messageId: string): Promise<boolean> {
      return (await orm.select().from(seenMessages).where(eq(seenMessages.messageId, messageId)).limit(1)).length > 0;
    },
    async markSeen(messageId: string): Promise<boolean> {
      const result = await orm.insert(seenMessages).values({ messageId, ts: Date.now() }).onConflictDoNothing().returning();
      return result.length > 0;
    },
  };
}
