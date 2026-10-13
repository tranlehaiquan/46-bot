import { and, desc, eq } from "drizzle-orm";
import { createDrizzleDb, type SqliteDatabase } from "../connection.js";
import { groupMembers } from "../schema/index.js";

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

export function createGroupMemberRepository(db: SqliteDatabase): GroupMemberRepository {
  const orm = createDrizzleDb(db);
  return {
    async recordActivity(chatId: string, senderId: string, senderName: string): Promise<GroupMemberRow> {
      const now = Date.now();
      const existing = await this.getMember(chatId, senderId);

      if (!existing) {
        const [member] = await orm.insert(groupMembers).values({ chatId, senderId, senderName, createdAt: now, lastSeenAt: now }).returning();
        return member as GroupMemberRow;
      }

      await orm.update(groupMembers).set({ senderName, lastSeenAt: now }).where(and(eq(groupMembers.chatId, chatId), eq(groupMembers.senderId, senderId)));

      return {
        ...existing,
        senderName,
        lastSeenAt: now,
      };
    },

    async getMember(chatId: string, senderId: string): Promise<GroupMemberRow | undefined> {
      const [member] = await orm.select().from(groupMembers).where(and(eq(groupMembers.chatId, chatId), eq(groupMembers.senderId, senderId))).limit(1);
      return member as GroupMemberRow | undefined;
    },

    async listMembers(chatId: string): Promise<GroupMemberRow[]> {
      return await orm.select().from(groupMembers).where(eq(groupMembers.chatId, chatId)).orderBy(desc(groupMembers.lastSeenAt), desc(groupMembers.id)) as GroupMemberRow[];
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

      await orm.update(groupMembers).set({ alias, relationship, notes, senderName }).where(and(eq(groupMembers.chatId, chatId), eq(groupMembers.senderId, senderId)));

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
