import type { SqliteDatabase } from "../connection.js";

export type GroupMemberRow = {
  id: number;
  chatId: string;
  senderId: string;
  senderName: string;
  alias: string | null;
  relationship: string | null;
  notes: string | null;
  createdAt: number;
  lastSeenAt: number;
};

export type UpdateGroupMemberInput = {
  alias?: string | null;
  relationship?: string | null;
  notes?: string | null;
  senderName?: string;
};

export interface GroupMemberRepository {
  recordActivity(chatId: string, senderId: string, senderName: string): Promise<GroupMemberRow>;
  getMember(chatId: string, senderId: string): Promise<GroupMemberRow | undefined>;
  listMembers(chatId: string): Promise<GroupMemberRow[]>;
  updateMember(chatId: string, senderId: string, updates: UpdateGroupMemberInput): Promise<GroupMemberRow | undefined>;
  findByAliasOrName(chatId: string, query: string): Promise<GroupMemberRow[]>;
}

function mapRow(row: any): GroupMemberRow {
  return {
    id: Number(row.id),
    chatId: String(row.chatId),
    senderId: String(row.senderId),
    senderName: String(row.senderName),
    alias: row.alias != null ? String(row.alias) : null,
    relationship: row.relationship != null ? String(row.relationship) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: Number(row.createdAt),
    lastSeenAt: Number(row.lastSeenAt),
  };
}

export function createGroupMemberRepository(db: SqliteDatabase): GroupMemberRepository {
  return {
    async recordActivity(chatId: string, senderId: string, senderName: string): Promise<GroupMemberRow> {
      const now = Date.now();
      const existing = await this.getMember(chatId, senderId);

      if (!existing) {
        const res = await db.execute({
          sql: `INSERT INTO group_members (chat_id, sender_id, sender_name, created_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?)`,
          args: [chatId, senderId, senderName, now, now],
        });
        return {
          id: Number(res.lastInsertRowid),
          chatId,
          senderId,
          senderName,
          alias: null,
          relationship: null,
          notes: null,
          createdAt: now,
          lastSeenAt: now,
        };
      }

      await db.execute({
        sql: `UPDATE group_members
              SET sender_name = ?, last_seen_at = ?
              WHERE chat_id = ? AND sender_id = ?`,
        args: [senderName, now, chatId, senderId],
      });

      return {
        ...existing,
        senderName,
        lastSeenAt: now,
      };
    },

    async getMember(chatId: string, senderId: string): Promise<GroupMemberRow | undefined> {
      const res = await db.execute({
        sql: `SELECT id, chat_id as chatId, sender_id as senderId, sender_name as senderName,
                     alias, relationship, notes, created_at as createdAt, last_seen_at as lastSeenAt
              FROM group_members
              WHERE chat_id = ? AND sender_id = ?`,
        args: [chatId, senderId],
      });
      return res.rows[0] ? mapRow(res.rows[0]) : undefined;
    },

    async listMembers(chatId: string): Promise<GroupMemberRow[]> {
      const res = await db.execute({
        sql: `SELECT id, chat_id as chatId, sender_id as senderId, sender_name as senderName,
                     alias, relationship, notes, created_at as createdAt, last_seen_at as lastSeenAt
              FROM group_members
              WHERE chat_id = ?
              ORDER BY last_seen_at DESC, id DESC`,
        args: [chatId],
      });
      return res.rows.map(mapRow);
    },

    async updateMember(
      chatId: string,
      senderId: string,
      updates: UpdateGroupMemberInput,
    ): Promise<GroupMemberRow | undefined> {
      const existing = await this.getMember(chatId, senderId);
      if (!existing) {
        return undefined;
      }

      const alias = updates.alias !== undefined ? updates.alias : existing.alias;
      const relationship = updates.relationship !== undefined ? updates.relationship : existing.relationship;
      const notes = updates.notes !== undefined ? updates.notes : existing.notes;
      const senderName = updates.senderName !== undefined ? updates.senderName : existing.senderName;

      await db.execute({
        sql: `UPDATE group_members
              SET alias = ?, relationship = ?, notes = ?, sender_name = ?
              WHERE chat_id = ? AND sender_id = ?`,
        args: [alias, relationship, notes, senderName, chatId, senderId],
      });

      return {
        ...existing,
        alias,
        relationship,
        notes,
        senderName,
      };
    },

    async findByAliasOrName(chatId: string, query: string): Promise<GroupMemberRow[]> {
      const trimmed = query.trim().toLowerCase();
      if (!trimmed) return [];

      const members = await this.listMembers(chatId);
      return members.filter((m) => {
        const nameMatch = m.senderName.toLowerCase().includes(trimmed);
        const aliasMatch = m.alias ? m.alias.toLowerCase().includes(trimmed) : false;
        const relMatch = m.relationship ? m.relationship.toLowerCase().includes(trimmed) : false;
        const idMatch = m.senderId.toLowerCase() === trimmed;
        return nameMatch || aliasMatch || relMatch || idMatch;
      });
    },
  };
}
