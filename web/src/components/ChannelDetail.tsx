import React, { useState, useEffect } from "react";
import { MessageSquare, Calendar, Brain, Search } from "lucide-react";
import {
  api,
  type Channel,
  type ChannelStatus,
  type Message,
  type EventItem,
  type MemoryFact,
  type MemoryStory,
  type HolidayOccurrence,
  type CalendarEventOccurrence,
  type ScheduledLookup,
} from "../api";
import { ChannelHeader } from "./channel/ChannelHeader";
import { ChannelMessagesTab } from "./channel/ChannelMessagesTab";
import { ChannelRemindersTab } from "./channel/ChannelRemindersTab";
import { ChannelMemoryTab } from "./channel/ChannelMemoryTab";
import { ChannelLookupsTab } from "./channel/ChannelLookupsTab";

export function ChannelDetail({
  channel,
  onChannelUpdated,
}: {
  channel: Channel;
  onChannelUpdated: (updated: Channel) => void;
}) {
  const [activeTab, setActiveTab] = useState<"messages" | "reminders" | "memory" | "lookups">("messages");

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);

  // Reminders state
  const [events, setEvents] = useState<EventItem[]>([]);

  // Memory state
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [stories, setStories] = useState<MemoryStory[]>([]);

  // Lookups state
  const [lookups, setLookups] = useState<ScheduledLookup[]>([]);

  // Calendar state (for reminders tab)
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calHolidays, setCalHolidays] = useState<HolidayOccurrence[]>([]);
  const [calEvents, setCalEvents] = useState<CalendarEventOccurrence[]>([]);

  const [loading, setLoading] = useState(false);

  // Load summary counts (events, facts, stories, lookups) whenever channel changes
  useEffect(() => {
    let cancelled = false;

    setMessages([]);
    setEvents([]);
    setFacts([]);
    setStories([]);
    setLookups([]);
    setCalEvents([]);

    const loadChannelSummaries = async () => {
      try {
        const [evs, mems, lks] = await Promise.all([
          api.getEvents(channel.chatId),
          api.getMemories(channel.chatId),
          api.getLookups(channel.chatId),
        ]);
        if (cancelled) return;
        setEvents(evs);
        setFacts(mems.facts);
        setStories(mems.stories);
        setLookups(lks);
      } catch (err) {
        if (!cancelled) console.error(err);
      }
    };

    loadChannelSummaries();

    return () => {
      cancelled = true;
    };
  }, [channel.chatId]);

  // Load active tab specific data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const loadTabContent = async () => {
      try {
        if (activeTab === "messages") {
          const msgs = await api.getMessages(channel.chatId);
          if (cancelled) return;
          setMessages(msgs);
        } else if (activeTab === "reminders") {
          const [evs, hols, calEvs] = await Promise.all([
            api.getEvents(channel.chatId),
            api.getHolidays(calYear),
            api.getCalendarEvents(calYear, calMonth, channel.chatId),
          ]);
          if (cancelled) return;
          setEvents(evs);
          setCalHolidays(hols);
          setCalEvents(calEvs);
        } else if (activeTab === "memory") {
          const mems = await api.getMemories(channel.chatId);
          if (cancelled) return;
          setFacts(mems.facts);
          setStories(mems.stories);
        } else if (activeTab === "lookups") {
          const lks = await api.getLookups(channel.chatId);
          if (cancelled) return;
          setLookups(lks);
        }
      } catch (err) {
        if (!cancelled) console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadTabContent();

    return () => {
      cancelled = true;
    };
  }, [channel.chatId, activeTab, calYear, calMonth]);

  const refreshAllData = async () => {
    setLoading(true);
    try {
      const [evs, mems, lks] = await Promise.all([
        api.getEvents(channel.chatId),
        api.getMemories(channel.chatId),
        api.getLookups(channel.chatId),
      ]);
      setEvents(evs);
      setFacts(mems.facts);
      setStories(mems.stories);
      setLookups(lks);

      if (activeTab === "messages") {
        const msgs = await api.getMessages(channel.chatId);
        setMessages(msgs);
      } else if (activeTab === "reminders") {
        const calEvs = await api.getCalendarEvents(calYear, calMonth, channel.chatId);
        setCalEvents(calEvs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  const handleStatusChange = async (newStatus: ChannelStatus) => {
    try {
      const updated = await api.updateChannel(channel.chatId, { status: newStatus });
      onChannelUpdated(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update channel status");
    }
  };

  const handleCreateEvent = async (eventData: Parameters<typeof api.createEvent>[1]) => {
    try {
      await api.createEvent(channel.chatId, eventData);
      await refreshAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create event");
    }
  };

  const handleUpdateEvent = async (id: number, eventData: Partial<EventItem>) => {
    try {
      await api.updateEvent(channel.chatId, id, eventData);
      await refreshAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update event");
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;
    try {
      await api.deleteEvent(channel.chatId, id);
      await refreshAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete event");
    }
  };

  const handleCreateFact = async (subject: string, fact: string) => {
    try {
      await api.createFact(channel.chatId, subject, fact);
      await refreshAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create memory fact");
    }
  };

  const handleDeleteFact = async (id: number) => {
    if (!confirm("Are you sure you want to delete this memory?")) return;
    try {
      await api.deleteFact(channel.chatId, id);
      await refreshAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete fact");
    }
  };

  const handleCreateStory = async (story: Parameters<typeof api.createStory>[1]) => {
    try {
      await api.createStory(channel.chatId, story);
      await refreshAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add story");
    }
  };

  const handleDeleteStory = async (id: number) => {
    if (!confirm("Are you sure you want to delete this story?")) return;
    try {
      await api.deleteStory(channel.chatId, id);
      await refreshAllData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete story");
    }
  };

  const handleToggleActiveLookup = async (lookup: ScheduledLookup) => {
    try {
      const updated = await api.updateLookup(channel.chatId, lookup.id, { active: !lookup.active });
      setLookups((prev) => prev.map((l) => (l.id === lookup.id ? { ...l, active: updated.active } : l)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle lookup status");
    }
  };

  const handleDeleteLookup = async (id: number) => {
    try {
      await api.deleteLookup(channel.chatId, id);
      setLookups((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete lookup");
    }
  };

  const tabClasses = (tab: "messages" | "reminders" | "memory" | "lookups") =>
    `py-3.5 px-5 text-sm font-semibold flex items-center gap-2 transition-all duration-150 border-b-2 cursor-pointer ${
      activeTab === tab
        ? "text-indigo-400 border-indigo-500"
        : "text-slate-400 border-transparent hover:text-slate-200"
    }`;

  return (
    <div className="glass-panel flex flex-col h-[calc(100vh-120px)] overflow-hidden">
      <ChannelHeader
        channel={channel}
        loading={loading}
        onStatusChange={handleStatusChange}
        onRefresh={refreshAllData}
      />

      {/* Tabs Navigation Header */}
      <div className="flex border-b border-white/[0.08] bg-black/15 px-4">
        <button
          onClick={() => setActiveTab("messages")}
          className={tabClasses("messages")}
        >
          <MessageSquare size={16} />
          <span>Messages ({messages.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("reminders")}
          className={tabClasses("reminders")}
        >
          <Calendar size={16} />
          <span>Reminders & Events ({events.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("memory")}
          className={tabClasses("memory")}
        >
          <Brain size={16} />
          <span>Memory & Stories ({facts.length + stories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("lookups")}
          className={tabClasses("lookups")}
        >
          <Search size={16} />
          <span>Lookups ({lookups.length})</span>
        </button>
      </div>

      {/* Active Tab Views */}
      {activeTab === "messages" && (
        <ChannelMessagesTab messages={messages} />
      )}

      {activeTab === "reminders" && (
        <ChannelRemindersTab
          events={events}
          calYear={calYear}
          calMonth={calMonth}
          calHolidays={calHolidays}
          calEvents={calEvents}
          onPrevMonth={handleCalPrevMonth}
          onNextMonth={handleCalNextMonth}
          onCreateEvent={handleCreateEvent}
          onUpdateEvent={handleUpdateEvent}
          onDeleteEvent={handleDeleteEvent}
        />
      )}

      {activeTab === "memory" && (
        <ChannelMemoryTab
          facts={facts}
          stories={stories}
          onCreateFact={handleCreateFact}
          onDeleteFact={handleDeleteFact}
          onCreateStory={handleCreateStory}
          onDeleteStory={handleDeleteStory}
        />
      )}

      {activeTab === "lookups" && (
        <ChannelLookupsTab
          lookups={lookups}
          onToggleActive={handleToggleActiveLookup}
          onDelete={handleDeleteLookup}
        />
      )}
    </div>
  );
}
