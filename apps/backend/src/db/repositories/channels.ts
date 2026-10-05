import type { SqliteDatabase } from "../connection.js";

export type ChannelStatus = "pending" | "active" | "disabled";

export type ChannelRow = {
  chatId: string;
  name: string;
  chatType: "GROUP" | "PRIVATE";
  status: ChannelStatus;
  createdAt: number;
  lastActiveAt: number;
};

export type UpsertChannelInput = {
  chatId: string;
  name: string;
  chatType: "GROUP" | "PRIVATE";
  status?: ChannelStatus;
};

export interface ChannelRepository {
  getChannel(chatId: string): ChannelRow | undefined;
  listChannels(status?: ChannelStatus): ChannelRow[];
  upsertDiscovery(input: UpsertChannelInput): ChannelRow;
  updateStatus(chatId: string, status: ChannelStatus): boolean;
  updateName(chatId: string, name: string): boolean;
  touchActive(chatId: string): boolean;
  seedChannels(chatIds: string[]): void;
}

export function createChannelRepository(db: SqliteDatabase): ChannelRepository {
  const getStmt = db.prepare(`
    SELECT
      chat_id as chatId,
      name,
      chat_type as chatType,
      status,
      created_at as createdAt,
      last_active_at as lastActiveAt
    FROM channels
    WHERE chat_id = ?
  `);

  const listAllStmt = db.prepare(`
    SELECT
      chat_id as chatId,
      name,
      chat_type as chatType,
      status,
      created_at as createdAt,
      last_active_at as lastActiveAt
    FROM channels
    ORDER BY last_active_at DESC
  `);

  const listByStatusStmt = db.prepare(`
    SELECT
      chat_id as chatId,
      name,
      chat_type as chatType,
      status,
      created_at as createdAt,
      last_active_at as lastActiveAt
    FROM channels
    WHERE status = ?
    ORDER BY last_active_at DESC
  `);

  const insertStmt = db.prepare(`
    INSERT INTO channels (chat_id, name, chat_type, status, created_at, last_active_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const updateDiscoveryStmt = db.prepare(`
    UPDATE channels
    SET last_active_at = ?,
        name = CASE WHEN name = chat_id AND ? != '' THEN ? ELSE name END
    WHERE chat_id = ?
  `);

  const updateStatusStmt = db.prepare(`
    UPDATE channels
    SET status = ?
    WHERE chat_id = ?
  `);

  const updateNameStmt = db.prepare(`
    UPDATE channels
    SET name = ?
    WHERE chat_id = ?
  `);

  const touchStmt = db.prepare(`
    UPDATE channels
    SET last_active_at = ?
    WHERE chat_id = ?
  `);

  return {
    getChannel(chatId: string): ChannelRow | undefined {
      return getStmt.get(chatId) as ChannelRow | undefined;
    },

    listChannels(status?: ChannelStatus): ChannelRow[] {
      if (status) {
        return listByStatusStmt.all(status) as ChannelRow[];
      }
      return listAllStmt.all() as ChannelRow[];
    },

    upsertDiscovery(input: UpsertChannelInput): ChannelRow {
      const now = Date.now();
      const existing = getStmt.get(input.chatId) as ChannelRow | undefined;
      if (existing) {
        updateDiscoveryStmt.run(now, input.name, input.name, input.chatId);
        return getStmt.get(input.chatId) as ChannelRow;
      }

      const initialStatus = input.status ?? "pending";
      const channelName = input.name.trim() || input.chatId;
      insertStmt.run(input.chatId, channelName, input.chatType, initialStatus, now, now);
      return getStmt.get(input.chatId) as ChannelRow;
    },

    updateStatus(chatId: string, status: ChannelStatus): boolean {
      const result = updateStatusStmt.run(status, chatId);
      return result.changes > 0;
    },

    updateName(chatId: string, name: string): boolean {
      const result = updateNameStmt.run(name.trim(), chatId);
      return result.changes > 0;
    },

    touchActive(chatId: string): boolean {
      const result = touchStmt.run(Date.now(), chatId);
      return result.changes > 0;
    },

    seedChannels(chatIds: string[]): void {
      const now = Date.now();
      const seedTransaction = db.transaction((ids: string[]) => {
        for (const rawId of ids) {
          const chatId = rawId.trim();
          if (!chatId) continue;
          const existing = getStmt.get(chatId);
          if (!existing) {
            insertStmt.run(chatId, chatId, "GROUP", "active", now, now);
          }
        }
      });
      seedTransaction(chatIds);
    },
  };
}
