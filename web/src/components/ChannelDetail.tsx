import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Calendar,
  Brain,
  Trash2,
  Plus,
  RefreshCw,
  Users,
  User,
  Sparkles,
  BookOpen
} from "lucide-react";
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
} from "../api";
import { CalendarMonthGrid } from "./CalendarMonthGrid";

export function ChannelDetail({
  channel,
  onChannelUpdated,
}: {
  channel: Channel;
  onChannelUpdated: (updated: Channel) => void;
}) {
  const [activeTab, setActiveTab] = useState<"messages" | "reminders" | "memory">("messages");

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reminders state
  const [events, setEvents] = useState<EventItem[]>([]);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "",
    kind: "event",
    calendar: "solar",
    day: 1,
    month: 1,
    year: "",
    recurrence: "yearly",
    remindDaysBefore: 0,
    notes: "",
  });

  // Memory state
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [stories, setStories] = useState<MemoryStory[]>([]);
  const [showFactForm, setShowFactForm] = useState(false);
  const [factForm, setFactForm] = useState({ subject: "", fact: "" });
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [storyForm, setStoryForm] = useState({ title: "", story: "", people: "", happenedOn: "" });

  // Calendar state (for reminders tab)
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calHolidays, setCalHolidays] = useState<HolidayOccurrence[]>([]);
  const [calEvents, setCalEvents] = useState<CalendarEventOccurrence[]>([]);

  const [loading, setLoading] = useState(false);

  // Load calendar data whenever the reminders tab is active or month changes
  useEffect(() => {
    if (activeTab !== "reminders") return;
    api.getHolidays(calYear).then(setCalHolidays).catch(console.error);
    api.getCalendarEvents(calYear, calMonth, channel.chatId).then(setCalEvents).catch(console.error);
  }, [channel.chatId, activeTab, calYear, calMonth]);

  const handleCalPrevMonth = () => {
    if (calMonth === 1) { setCalYear((y) => y - 1); setCalMonth(12); }
    else setCalMonth((m) => m - 1);
  };

  const handleCalNextMonth = () => {
    if (calMonth === 12) { setCalYear((y) => y + 1); setCalMonth(1); }
    else setCalMonth((m) => m + 1);
  };

  // Load data when channel or activeTab changes
  useEffect(() => {
    loadTabData();
  }, [channel.chatId, activeTab]);

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === "messages") {
        const msgs = await api.getMessages(channel.chatId);
        setMessages(msgs);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      } else if (activeTab === "reminders") {
        const evs = await api.getEvents(channel.chatId);
        setEvents(evs);
      } else if (activeTab === "memory") {
        const mems = await api.getMemories(channel.chatId);
        setFacts(mems.facts);
        setStories(mems.stories);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createEvent(channel.chatId, {
        title: eventForm.title,
        kind: eventForm.kind,
        calendar: eventForm.calendar as "solar" | "lunar",
        day: Number(eventForm.day),
        month: Number(eventForm.month),
        year: eventForm.year ? Number(eventForm.year) : undefined,
        recurrence: eventForm.recurrence,
        remindDaysBefore: Number(eventForm.remindDaysBefore),
        notes: eventForm.notes || undefined,
      });
      setShowEventForm(false);
      setEventForm({
        title: "",
        kind: "event",
        calendar: "solar",
        day: 1,
        month: 1,
        year: "",
        recurrence: "yearly",
        remindDaysBefore: 0,
        notes: "",
      });
      await loadTabData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create event");
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;
    try {
      await api.deleteEvent(channel.chatId, id);
      await loadTabData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete event");
    }
  };

  const handleCreateFact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createFact(channel.chatId, factForm.subject, factForm.fact);
      setShowFactForm(false);
      setFactForm({ subject: "", fact: "" });
      await loadTabData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create memory fact");
    }
  };

  const handleDeleteFact = async (id: number) => {
    if (!confirm("Are you sure you want to delete this memory?")) return;
    try {
      await api.deleteFact(channel.chatId, id);
      await loadTabData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete fact");
    }
  };

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createStory(channel.chatId, storyForm);
      setShowStoryForm(false);
      setStoryForm({ title: "", story: "", people: "", happenedOn: "" });
      await loadTabData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add story");
    }
  };

  const handleDeleteStory = async (id: number) => {
    if (!confirm("Are you sure you want to delete this story?")) return;
    try {
      await api.deleteStory(channel.chatId, id);
      await loadTabData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete story");
    }
  };

  const tabClasses = (tab: "messages" | "reminders" | "memory") =>
    `py-3.5 px-5 text-sm font-semibold flex items-center gap-2 transition-all duration-150 border-b-2 cursor-pointer ${
      activeTab === tab
        ? "text-indigo-400 border-indigo-500"
        : "text-slate-400 border-transparent hover:text-slate-200"
    }`;

  return (
    <div className="glass-panel flex flex-col h-[calc(100vh-120px)] overflow-hidden">
      {/* Channel Header Banner */}
      <div className="p-5 px-6 border-b border-white/[0.08] flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border border-white/[0.08] ${
            channel.chatType === "GROUP" ? "bg-indigo-500/15" : "bg-emerald-500/15"
          }`}>
            {channel.chatType === "GROUP" ? (
              <Users size={22} className="text-indigo-400" />
            ) : (
              <User size={22} className="text-emerald-400" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{channel.name}</h2>
            <span className="text-xs text-slate-400 font-mono">
              {channel.chatId} • {channel.chatType}
            </span>
          </div>
        </div>

        {/* Status Dropdown Controls */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300 font-medium">Status:</span>
          <select
            value={channel.status}
            onChange={(e) => handleStatusChange(e.target.value as ChannelStatus)}
            className={`form-input w-auto py-1.5 px-3 font-semibold text-sm ${
              channel.status === "active"
                ? "text-emerald-400"
                : channel.status === "pending"
                ? "text-amber-400"
                : "text-rose-400"
            }`}
          >
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="disabled">Disabled</option>
          </select>

          <button
            onClick={loadTabData}
            className="btn btn-secondary px-2.5 py-1.5"
            title="Refresh data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs Header */}
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
      </div>

      {/* Tab 1: Messages Stream */}
      {activeTab === "messages" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3.5">
            {messages.length === 0 ? (
              <div className="text-center text-slate-400 m-auto text-sm">
                No recorded messages for this channel yet.
              </div>
            ) : (
              messages.map((m) => {
                const isAssistant = m.role === "assistant";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[75%] ${
                      isAssistant ? "items-end self-end" : "items-start self-start"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                      <span className={`font-semibold ${isAssistant ? "text-indigo-400" : "text-slate-300"}`}>
                        {isAssistant ? "🤖 46-Bot" : m.senderName || m.senderId}
                      </span>
                      <span>•</span>
                      <span>{new Date(m.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>

                    <div className={`p-3 px-4 rounded-2xl leading-relaxed text-sm whitespace-pre-wrap break-words ${
                      isAssistant
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : "bg-slate-800 text-slate-100 border border-white/[0.08]"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Tab 2: Reminders & Events */}
      {activeTab === "reminders" && (
        <div className="flex-1 overflow-y-auto p-6">
          {/* Channel Calendar */}
          <div className="glass-panel p-5 mb-6">
            <CalendarMonthGrid
              year={calYear}
              month={calMonth}
              holidays={calHolidays.filter((h) => {
                const [hy, hm] = h.occurrenceDateStr.split("-").map(Number);
                return hy === calYear && hm === calMonth;
              })}
              events={calEvents}
              showChannelLabels={false}
              onPrevMonth={handleCalPrevMonth}
              onNextMonth={handleCalNextMonth}
            />
          </div>

          <div className="flex justify-between items-center mb-5">
            <h3 className="text-lg font-bold text-white">Events & Reminders</h3>
            <button
              onClick={() => setShowEventForm(!showEventForm)}
              className="btn btn-primary text-xs px-3.5 py-2"
            >
              <Plus size={14} />
              <span>{showEventForm ? "Close Form" : "Create New Event"}</span>
            </button>
          </div>

          {showEventForm && (
            <form onSubmit={handleCreateEvent} className="glass-panel p-5 mb-6">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5 mb-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Event Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dad's Birthday..."
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Event Type</label>
                  <select
                    value={eventForm.kind}
                    onChange={(e) => setEventForm({ ...eventForm, kind: e.target.value })}
                    className="form-input"
                  >
                    <option value="event">General Event</option>
                    <option value="birthday">Birthday</option>
                    <option value="anniversary">Anniversary</option>
                    <option value="gio">Death Anniversary (Giỗ)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Calendar</label>
                  <select
                    value={eventForm.calendar}
                    onChange={(e) => setEventForm({ ...eventForm, calendar: e.target.value })}
                    className="form-input"
                  >
                    <option value="solar">Solar (Dương lịch)</option>
                    <option value="lunar">Lunar (Âm lịch)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Day / Month</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={eventForm.day}
                      onChange={(e) => setEventForm({ ...eventForm, day: Number(e.target.value) })}
                      className="form-input"
                      placeholder="Day"
                    />
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={eventForm.month}
                      onChange={(e) => setEventForm({ ...eventForm, month: Number(e.target.value) })}
                      className="form-input"
                      placeholder="Month"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Recurrence</label>
                  <select
                    value={eventForm.recurrence}
                    onChange={(e) => setEventForm({ ...eventForm, recurrence: e.target.value })}
                    className="form-input"
                  >
                    <option value="yearly">Yearly</option>
                    <option value="monthly">Monthly</option>
                    <option value="none">One-time</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Remind In Advance (days)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={eventForm.remindDaysBefore}
                    onChange={(e) => setEventForm({ ...eventForm, remindDaysBefore: Number(e.target.value) })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary px-4 py-2 text-sm">
                  Save Event
                </button>
              </div>
            </form>
          )}

          {events.length === 0 ? (
            <div className="text-center text-slate-400 py-8 text-sm">
              No events or reminders recorded for this channel.
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {events.map((ev) => (
                <div key={ev.id} className="glass-panel p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm text-slate-100">{ev.title}</h4>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                      title="Delete event"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="flex gap-1.5 flex-wrap text-xs">
                    <span className="badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                      {ev.day}/{ev.month} {ev.calendar === "lunar" ? "(Âm lịch)" : "(Dương lịch)"}
                    </span>
                    <span className="badge bg-slate-800 text-slate-300">
                      {ev.kind}
                    </span>
                    {ev.remindDaysBefore > 0 && (
                      <span className="badge badge-pending">Remind {ev.remindDaysBefore}d before</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Memory & Stories */}
      {activeTab === "memory" && (
        <div className="flex-1 overflow-y-auto p-6">
          {/* Facts Section */}
          <div className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Remembered Facts</h3>
              </div>
              <button
                onClick={() => setShowFactForm(!showFactForm)}
                className="btn btn-primary text-xs px-3.5 py-2"
              >
                <Plus size={14} />
                <span>{showFactForm ? "Close Form" : "Add Fact"}</span>
              </button>
            </div>

            {showFactForm && (
              <form onSubmit={handleCreateFact} className="glass-panel p-5 mb-6">
                <div className="grid grid-cols-[1fr_2fr] gap-3.5 mb-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Subject *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mom, Dad, Alex..."
                      value={factForm.subject}
                      onChange={(e) => setFactForm({ ...factForm, subject: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Fact *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Likes vegetarian food on 15th, allergic to shrimp..."
                      value={factForm.fact}
                      onChange={(e) => setFactForm({ ...factForm, fact: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary px-4 py-2 text-sm">Save Fact</button>
                </div>
              </form>
            )}

            {facts.length === 0 ? (
              <div className="text-slate-400 text-sm">No facts recorded yet.</div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
                {facts.map((f) => (
                  <div key={f.id} className="glass-panel p-3.5 px-4 flex justify-between items-start">
                    <div>
                      <span className="font-bold text-indigo-400 text-sm">{f.subject}:</span>
                      <p className="text-sm mt-1 text-slate-200">{f.fact}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteFact(f.id)}
                      className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stories Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Memory Book (Stories)</h3>
              </div>
              <button
                onClick={() => setShowStoryForm(!showStoryForm)}
                className="btn btn-primary text-xs px-3.5 py-2"
              >
                <Plus size={14} />
                <span>{showStoryForm ? "Close Form" : "Add Story"}</span>
              </button>
            </div>

            {showStoryForm && (
              <form onSubmit={handleCreateStory} className="glass-panel p-5 mb-6">
                <div className="grid grid-cols-[2fr_1fr] gap-3.5 mb-3.5">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Story Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Summer vacation trip to Da Nang 2024..."
                      value={storyForm.title}
                      onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">People Involved</label>
                    <input
                      type="text"
                      placeholder="Dad, Mom, Alex..."
                      value={storyForm.people}
                      onChange={(e) => setStoryForm({ ...storyForm, people: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-slate-400 block mb-1">Story Content *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Recount the memorable event or story..."
                    value={storyForm.story}
                    onChange={(e) => setStoryForm({ ...storyForm, story: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary px-4 py-2 text-sm">Save Story</button>
                </div>
              </form>
            )}

            {stories.length === 0 ? (
              <div className="text-slate-400 text-sm">No stories in the memory book yet.</div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
                {stories.map((s) => (
                  <div key={s.id} className="glass-panel p-5 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-base text-emerald-400">{s.title}</h4>
                      <button
                        onClick={() => handleDeleteStory(s.id)}
                        className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{s.story}</p>
                    {s.people && (
                      <div className="text-xs text-slate-400 mt-2">
                        👥 People: {s.people}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
