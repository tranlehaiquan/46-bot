import React, { useState } from "react";
import { MessageSquare, Calendar, Brain, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Channel, ChannelStatus } from "../api";
import { ChannelHeader } from "./channel/ChannelHeader";
import { ChannelMessagesTab } from "./channel/ChannelMessagesTab";
import { ChannelRemindersTab } from "./channel/ChannelRemindersTab";
import { ChannelMemoryTab } from "./channel/ChannelMemoryTab";
import { ChannelLookupsTab } from "./channel/ChannelLookupsTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import {
  useChannelMessages,
  useChannelEvents,
  useChannelMemories,
  useChannelLookups,
  useHolidays,
  useCalendarEvents,
  useUpdateChannel,
} from "../hooks/useAdminQueries";

export function ChannelDetail({
  channel,
  onChannelUpdated,
}: {
  channel: Channel;
  onChannelUpdated: (updated: Channel) => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"messages" | "reminders" | "memory" | "lookups">("messages");

  // Calendar year / month for the reminders & calendar tab
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);

  // TanStack Queries (declarative caching, background refetching, instant updates)
  const messagesQuery = useChannelMessages(channel.chatId);
  const eventsQuery = useChannelEvents(channel.chatId);
  const memoriesQuery = useChannelMemories(channel.chatId);
  const lookupsQuery = useChannelLookups(channel.chatId);
  const holidaysQuery = useHolidays(calYear);
  const calEventsQuery = useCalendarEvents(calYear, calMonth, channel.chatId);

  const updateChannelMutation = useUpdateChannel();

  const messages = messagesQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const facts = memoriesQuery.data?.facts ?? [];
  const stories = memoriesQuery.data?.stories ?? [];
  const lookups = lookupsQuery.data ?? [];
  const calHolidays = holidaysQuery.data ?? [];
  const calEvents = calEventsQuery.data ?? [];

  const isRefreshing =
    messagesQuery.isFetching ||
    eventsQuery.isFetching ||
    memoriesQuery.isFetching ||
    lookupsQuery.isFetching;

  const handleRefresh = async () => {
    await Promise.all([
      messagesQuery.refetch(),
      eventsQuery.refetch(),
      memoriesQuery.refetch(),
      lookupsQuery.refetch(),
      calEventsQuery.refetch(),
    ]);
  };

  const handleStatusChange = async (newStatus: ChannelStatus) => {
    try {
      const updated = await updateChannelMutation.mutateAsync({
        chatId: channel.chatId,
        updates: { status: newStatus },
      });
      onChannelUpdated(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update channel status");
    }
  };

  const handleCalPrevMonth = () => {
    if (calMonth === 1) {
      setCalYear((y) => y - 1);
      setCalMonth(12);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleCalNextMonth = () => {
    if (calMonth === 12) {
      setCalYear((y) => y + 1);
      setCalMonth(1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const handleRename = async (newName: string) => {
    try {
      const updated = await updateChannelMutation.mutateAsync({
        chatId: channel.chatId,
        updates: { name: newName },
      });
      onChannelUpdated(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename channel");
      throw err;
    }
  };

  return (
    <div className="glass-panel flex flex-col h-[calc(100vh-120px)] overflow-hidden">
      <ChannelHeader
        channel={channel}
        loading={isRefreshing}
        onStatusChange={handleStatusChange}
        onRefresh={handleRefresh}
        onRename={handleRename}
      />

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as typeof activeTab)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList>
          <TabsTrigger value="messages">
            <MessageSquare size={16} />
            <span>Messages ({messages.length})</span>
          </TabsTrigger>

          <TabsTrigger value="reminders">
            <Calendar size={16} />
            <span>Reminders & Events ({events.length})</span>
          </TabsTrigger>

          <TabsTrigger value="memory">
            <Brain size={16} />
            <span>Memory & Stories ({facts.length + stories.length})</span>
          </TabsTrigger>

          <TabsTrigger value="lookups">
            <Search size={16} />
            <span>Lookups ({lookups.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="flex flex-col">
          <ChannelMessagesTab messages={messages} />
        </TabsContent>

        <TabsContent value="reminders" className="flex flex-col">
          <ChannelRemindersTab
            chatId={channel.chatId}
            events={events}
            calYear={calYear}
            calMonth={calMonth}
            calHolidays={calHolidays}
            calEvents={calEvents}
            onPrevMonth={handleCalPrevMonth}
            onNextMonth={handleCalNextMonth}
          />
        </TabsContent>

        <TabsContent value="memory" className="flex flex-col">
          <ChannelMemoryTab
            chatId={channel.chatId}
            facts={facts}
            stories={stories}
          />
        </TabsContent>

        <TabsContent value="lookups" className="flex flex-col">
          <ChannelLookupsTab
            chatId={channel.chatId}
            lookups={lookups}
            isLoading={lookupsQuery.isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
