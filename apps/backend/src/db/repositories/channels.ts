import { desc, eq } from "drizzle-orm";
import { createDrizzleDb, type SqliteDatabase } from "../connection.js";
import { channels } from "../schema/index.js";

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

export function createChannelRepository(db: SqliteDatabase): ChannelRepository {
  const orm = createDrizzleDb(db);
  return {
    async getChannel(chatId: string): Promise<ChannelRow | undefined> {
      const [channel] = await orm.select().from(channels).where(eq(channels.chatId, chatId)).limit(1);
      return channel as ChannelRow | undefined;
    },

    async listChannels(status?: ChannelStatus): Promise<ChannelRow[]> {
      const query = orm.select().from(channels).orderBy(desc(channels.lastActiveAt));
      return (status ? await query.where(eq(channels.status, status)) : await query) as ChannelRow[];
    },

    async upsertDiscovery(input: UpsertChannelInput): Promise<ChannelRow> {
      const now = Date.now();
      const existing = await this.getChannel(input.chatId);
      if (existing) {
        await orm.update(channels).set({ lastActiveAt: now, name: existing.name === existing.chatId && input.name !== "" ? input.name : existing.name }).where(eq(channels.chatId, input.chatId));
        const updated = await this.getChannel(input.chatId);
        return updated!;
      }

      const initialStatus = input.status ?? "pending";
      const channelName = input.name.trim() || input.chatId;
      await orm.insert(channels).values({ chatId: input.chatId, name: channelName, chatType: input.chatType, status: initialStatus, createdAt: now, lastActiveAt: now });
      const created = await this.getChannel(input.chatId);
      return created!;
    },

    async updateStatus(chatId: string, status: ChannelStatus): Promise<boolean> {
      return (await orm.update(channels).set({ status }).where(eq(channels.chatId, chatId)).returning()).length > 0;
    },

    async updateName(chatId: string, name: string): Promise<boolean> {
      return (await orm.update(channels).set({ name: name.trim() }).where(eq(channels.chatId, chatId)).returning()).length > 0;
    },

    async touchActive(chatId: string): Promise<boolean> {
      return (await orm.update(channels).set({ lastActiveAt: Date.now() }).where(eq(channels.chatId, chatId)).returning()).length > 0;
    },

    async seedChannels(chatIds: string[]): Promise<void> {
      const now = Date.now();
      for (const rawId of chatIds) {
        const chatId = rawId.trim();
        if (!chatId) continue;
        const existing = await this.getChannel(chatId);
        if (!existing) {
          await orm.insert(channels).values({ chatId, name: chatId, chatType: "GROUP", status: "active", createdAt: now, lastActiveAt: now });
        }
      }
    },
  };
}
