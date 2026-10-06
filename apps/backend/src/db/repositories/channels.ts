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
  getChannel(chatId: string): Promise<ChannelRow | undefined>;
  listChannels(status?: ChannelStatus): Promise<ChannelRow[]>;
  upsertDiscovery(input: UpsertChannelInput): Promise<ChannelRow>;
  updateStatus(chatId: string, status: ChannelStatus): Promise<boolean>;
  updateName(chatId: string, name: string): Promise<boolean>;
  touchActive(chatId: string): Promise<boolean>;
  seedChannels(chatIds: string[]): Promise<void>;
}

function mapChannelRow(row: any): ChannelRow {
  return {
    chatId: String(row.chatId),
    name: String(row.name),
    chatType: row.chatType as "GROUP" | "PRIVATE",
    status: row.status as ChannelStatus,
    createdAt: Number(row.createdAt),
    lastActiveAt: Number(row.lastActiveAt),
  };
}

export function createChannelRepository(db: SqliteDatabase): ChannelRepository {
  return {
    async getChannel(chatId: string): Promise<ChannelRow | undefined> {
      const res = await db.execute({
        sql: `SELECT chat_id as chatId, name, chat_type as chatType, status, created_at as createdAt, last_active_at as lastActiveAt
              FROM channels
              WHERE chat_id = ?`,
        args: [chatId],
      });
      return res.rows[0] ? mapChannelRow(res.rows[0]) : undefined;
    },

    async listChannels(status?: ChannelStatus): Promise<ChannelRow[]> {
      const sql = status
        ? `SELECT chat_id as chatId, name, chat_type as chatType, status, created_at as createdAt, last_active_at as lastActiveAt
           FROM channels
           WHERE status = ?
           ORDER BY last_active_at DESC`
        : `SELECT chat_id as chatId, name, chat_type as chatType, status, created_at as createdAt, last_active_at as lastActiveAt
           FROM channels
           ORDER BY last_active_at DESC`;
      const args = status ? [status] : [];
      const res = await db.execute({ sql, args });
      return res.rows.map(mapChannelRow);
    },

    async upsertDiscovery(input: UpsertChannelInput): Promise<ChannelRow> {
      const now = Date.now();
      const existing = await this.getChannel(input.chatId);
      if (existing) {
        await db.execute({
          sql: `UPDATE channels
                SET last_active_at = ?,
                    name = CASE WHEN name = chat_id AND ? != '' THEN ? ELSE name END
                WHERE chat_id = ?`,
          args: [now, input.name, input.name, input.chatId],
        });
        const updated = await this.getChannel(input.chatId);
        return updated!;
      }

      const initialStatus = input.status ?? "pending";
      const channelName = input.name.trim() || input.chatId;
      await db.execute({
        sql: `INSERT INTO channels (chat_id, name, chat_type, status, created_at, last_active_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(chat_id) DO UPDATE SET
                last_active_at = excluded.last_active_at,
                name = CASE WHEN channels.name = channels.chat_id AND excluded.name != '' THEN excluded.name ELSE channels.name END`,
        args: [input.chatId, channelName, input.chatType, initialStatus, now, now],
      });
      const created = await this.getChannel(input.chatId);
      return created!;
    },

    async updateStatus(chatId: string, status: ChannelStatus): Promise<boolean> {
      const res = await db.execute({
        sql: `UPDATE channels SET status = ? WHERE chat_id = ?`,
        args: [status, chatId],
      });
      return res.rowsAffected > 0;
    },

    async updateName(chatId: string, name: string): Promise<boolean> {
      const res = await db.execute({
        sql: `UPDATE channels SET name = ? WHERE chat_id = ?`,
        args: [name.trim(), chatId],
      });
      return res.rowsAffected > 0;
    },

    async touchActive(chatId: string): Promise<boolean> {
      const res = await db.execute({
        sql: `UPDATE channels SET last_active_at = ? WHERE chat_id = ?`,
        args: [Date.now(), chatId],
      });
      return res.rowsAffected > 0;
    },

    async seedChannels(chatIds: string[]): Promise<void> {
      const now = Date.now();
      for (const rawId of chatIds) {
        const chatId = rawId.trim();
        if (!chatId) continue;
        const existing = await this.getChannel(chatId);
        if (!existing) {
          await db.execute({
            sql: `INSERT INTO channels (chat_id, name, chat_type, status, created_at, last_active_at)
                  VALUES (?, ?, 'GROUP', 'active', ?, ?)`,
            args: [chatId, chatId, now, now],
          });
        }
      }
    },
  };
}
