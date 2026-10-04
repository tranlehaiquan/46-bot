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
} from "../api";

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

  const [loading, setLoading] = useState(false);

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
        const evts = await api.getEvents(channel.chatId);
        setEvents(evts);
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
      alert(err instanceof Error ? err.message : "Cập nhật trạng thái thất bại");
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
        year: eventForm.year ? Number(eventForm.year) : null,
        recurrence: eventForm.recurrence,
        remindDaysBefore: Number(eventForm.remindDaysBefore),
        notes: eventForm.notes || null,
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
      alert(err instanceof Error ? err.message : "Tạo sự kiện thất bại");
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm("Bạn có chắc muốn xoá nhắc nhở này?")) return;
    try {
      await api.deleteEvent(channel.chatId, id);
      await loadTabData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xoá sự kiện thất bại");
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
      alert(err instanceof Error ? err.message : "Tạo ghi nhớ thất bại");
    }
  };

  const handleDeleteFact = async (id: number) => {
    if (!confirm("Bạn có chắc muốn xoá ghi nhớ này?")) return;
    try {
      await api.deleteFact(channel.chatId, id);
      await loadTabData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xoá ghi nhớ thất bại");
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
      alert(err instanceof Error ? err.message : "Thêm kỷ niệm thất bại");
    }
  };

  const handleDeleteStory = async (id: number) => {
    if (!confirm("Bạn có chắc muốn xoá kỷ niệm này?")) return;
    try {
      await api.deleteStory(channel.chatId, id);
      await loadTabData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Xoá kỷ niệm thất bại");
    }
  };

  return (
    <div className="glass-panel" style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 120px)",
      overflow: "hidden"
    }}>
      {/* Channel Header Banner */}
      <div style={{
        padding: "1.25rem 1.5rem",
        borderBottom: "1px solid var(--border-color)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: channel.chatType === "GROUP" ? "rgba(99, 102, 241, 0.15)" : "rgba(16, 185, 129, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--border-color)"
          }}>
            {channel.chatType === "GROUP" ? (
              <Users size={22} color="var(--accent-primary)" />
            ) : (
              <User size={22} color="var(--status-active)" />
            )}
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>{channel.name}</h2>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {channel.chatId} • {channel.chatType}
            </span>
          </div>
        </div>

        {/* Status Dropdown Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Trạng thái:</span>
          <select
            value={channel.status}
            onChange={(e) => handleStatusChange(e.target.value as ChannelStatus)}
            className="form-input"
            style={{
              width: "auto",
              padding: "0.4rem 0.8rem",
              fontWeight: "600",
              color: channel.status === "active" ? "var(--status-active)" : channel.status === "pending" ? "var(--status-pending)" : "var(--status-disabled)"
            }}
          >
            <option value="active">Active (Hoạt động)</option>
            <option value="pending">Pending (Chờ duyệt)</option>
            <option value="disabled">Disabled (Chặn)</option>
          </select>

          <button
            onClick={loadTabData}
            className="btn btn-secondary"
            style={{ padding: "0.45rem 0.65rem" }}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs Header */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--border-color)",
        background: "rgba(0,0,0,0.15)",
        padding: "0 1rem"
      }}>
        <button
          onClick={() => setActiveTab("messages")}
          style={{
            padding: "0.85rem 1.25rem",
            fontSize: "0.9rem",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: activeTab === "messages" ? "var(--accent-primary)" : "var(--text-secondary)",
            borderBottom: activeTab === "messages" ? "2px solid var(--accent-primary)" : "2px solid transparent",
            transition: "all 0.15s ease"
          }}
        >
          <MessageSquare size={16} />
          <span>Tin nhắn ({messages.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("reminders")}
          style={{
            padding: "0.85rem 1.25rem",
            fontSize: "0.9rem",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: activeTab === "reminders" ? "var(--accent-primary)" : "var(--text-secondary)",
            borderBottom: activeTab === "reminders" ? "2px solid var(--accent-primary)" : "2px solid transparent",
            transition: "all 0.15s ease"
          }}
        >
          <Calendar size={16} />
          <span>Nhắc nhở & Sự kiện ({events.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("memory")}
          style={{
            padding: "0.85rem 1.25rem",
            fontSize: "0.9rem",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: activeTab === "memory" ? "var(--accent-primary)" : "var(--text-secondary)",
            borderBottom: activeTab === "memory" ? "2px solid var(--accent-primary)" : "2px solid transparent",
            transition: "all 0.15s ease"
          }}
        >
          <Brain size={16} />
          <span>Bộ nhớ & Kỷ niệm ({facts.length + stories.length})</span>
        </button>
      </div>

      {/* Tab 1: Messages Stream */}
      {activeTab === "messages" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.85rem"
          }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", margin: "auto" }}>
                Chưa có tin nhắn nào được ghi nhận.
              </div>
            ) : (
              messages.map((m) => {
                const isAssistant = m.role === "assistant";
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isAssistant ? "flex-end" : "flex-start",
                      maxWidth: "75%",
                      alignSelf: isAssistant ? "flex-end" : "flex-start"
                    }}
                  >
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      marginBottom: "0.25rem"
                    }}>
                      <span style={{ fontWeight: "600", color: isAssistant ? "var(--accent-primary)" : "var(--text-secondary)" }}>
                        {isAssistant ? "🤖 46-Bot" : m.senderName || m.senderId}
                      </span>
                      <span>•</span>
                      <span>{new Date(m.ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>

                    <div style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "var(--radius-lg)",
                      background: isAssistant ? "var(--accent-primary)" : "var(--bg-tertiary)",
                      color: isAssistant ? "#ffffff" : "var(--text-primary)",
                      border: isAssistant ? "none" : "1px solid var(--border-color)",
                      lineHeight: "1.5",
                      fontSize: "0.9rem",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word"
                    }}>
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
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: "700" }}>Sự kiện & Nhắc nhở</h3>
            <button
              onClick={() => setShowEventForm(!showEventForm)}
              className="btn btn-primary"
              style={{ fontSize: "0.8rem", padding: "0.45rem 0.85rem" }}
            >
              <Plus size={14} />
              <span>{showEventForm ? "Đóng Form" : "Tạo sự kiện mới"}</span>
            </button>
          </div>

          {showEventForm && (
            <form onSubmit={handleCreateEvent} className="glass-panel" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.85rem", marginBottom: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Tiêu đề sự kiện *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Sinh nhật Bố..."
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Loại sự kiện</label>
                  <select
                    value={eventForm.kind}
                    onChange={(e) => setEventForm({ ...eventForm, kind: e.target.value })}
                    className="form-input"
                  >
                    <option value="event">Sự kiện chung</option>
                    <option value="birthday">Sinh nhật</option>
                    <option value="anniversary">Kỷ niệm</option>
                    <option value="gio">Ngày Giỗ</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Lịch</label>
                  <select
                    value={eventForm.calendar}
                    onChange={(e) => setEventForm({ ...eventForm, calendar: e.target.value })}
                    className="form-input"
                  >
                    <option value="solar">Dương lịch</option>
                    <option value="lunar">Âm lịch</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Ngày / Tháng</label>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={eventForm.day}
                      onChange={(e) => setEventForm({ ...eventForm, day: Number(e.target.value) })}
                      className="form-input"
                      placeholder="Ngày"
                    />
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={eventForm.month}
                      onChange={(e) => setEventForm({ ...eventForm, month: Number(e.target.value) })}
                      className="form-input"
                      placeholder="Tháng"
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Lặp lại</label>
                  <select
                    value={eventForm.recurrence}
                    onChange={(e) => setEventForm({ ...eventForm, recurrence: e.target.value })}
                    className="form-input"
                  >
                    <option value="yearly">Hàng năm</option>
                    <option value="monthly">Hàng tháng</option>
                    <option value="none">Chỉ 1 lần</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Báo trước (ngày)</label>
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

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn btn-primary" style={{ padding: "0.5rem 1rem" }}>
                  Lưu sự kiện
                </button>
              </div>
            </form>
          )}

          {events.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
              Chưa có sự kiện nào cho kênh này.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
              {events.map((ev) => (
                <div key={ev.id} className="glass-panel" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h4 style={{ fontWeight: "700", fontSize: "0.95rem" }}>{ev.title}</h4>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      style={{ color: "var(--text-muted)", padding: "0.2rem" }}
                      title="Xoá sự kiện"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", fontSize: "0.75rem" }}>
                    <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent-primary)" }}>
                      {ev.day}/{ev.month} {ev.calendar === "lunar" ? "(Âm lịch)" : "(Dương lịch)"}
                    </span>
                    <span className="badge" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                      {ev.kind}
                    </span>
                    {ev.remindDaysBefore > 0 && (
                      <span className="badge badge-pending">Báo trước {ev.remindDaysBefore} ngày</span>
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
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {/* Facts Section */}
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Sparkles size={18} color="var(--accent-primary)" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: "700" }}>Thông tin ghi nhớ (Facts)</h3>
              </div>
              <button
                onClick={() => setShowFactForm(!showFactForm)}
                className="btn btn-primary"
                style={{ fontSize: "0.8rem", padding: "0.45rem 0.85rem" }}
              >
                <Plus size={14} />
                <span>{showFactForm ? "Đóng Form" : "Thêm ghi nhớ"}</span>
              </button>
            </div>

            {showFactForm && (
              <form onSubmit={handleCreateFact} className="glass-panel" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.85rem", marginBottom: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Đối tượng (Subject) *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Mẹ, Bố, Con..."
                      value={factForm.subject}
                      onChange={(e) => setFactForm({ ...factForm, subject: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Nội dung ghi nhớ (Fact) *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Thích ăn chay ngày rằm, dị ứng tôm..."
                      value={factForm.fact}
                      onChange={(e) => setFactForm({ ...factForm, fact: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: "0.5rem 1rem" }}>Lưu Fact</button>
                </div>
              </form>
            )}

            {facts.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Chưa có ghi nhớ nào.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.85rem" }}>
                {facts.map((f) => (
                  <div key={f.id} className="glass-panel" style={{ padding: "0.85rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ fontWeight: "700", color: "var(--accent-primary)", fontSize: "0.85rem" }}>{f.subject}:</span>
                      <p style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>{f.fact}</p>
                    </div>
                    <button onClick={() => handleDeleteFact(f.id)} style={{ color: "var(--text-muted)" }} title="Xoá">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stories Section */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <BookOpen size={18} color="var(--status-active)" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: "700" }}>Sổ Kỷ Niệm (Memory Book)</h3>
              </div>
              <button
                onClick={() => setShowStoryForm(!showStoryForm)}
                className="btn btn-primary"
                style={{ fontSize: "0.8rem", padding: "0.45rem 0.85rem" }}
              >
                <Plus size={14} />
                <span>{showStoryForm ? "Đóng Form" : "Thêm kỷ niệm"}</span>
              </button>
            </div>

            {showStoryForm && (
              <form onSubmit={handleCreateStory} className="glass-panel" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.85rem", marginBottom: "0.85rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Tiêu đề kỷ niệm *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Chuyến du lịch hè Nha Trang 2024..."
                      value={storyForm.title}
                      onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Những ai tham gia</label>
                    <input
                      type="text"
                      placeholder="Bố, Mẹ, Bon..."
                      value={storyForm.people}
                      onChange={(e) => setStoryForm({ ...storyForm, people: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Nội dung câu chuyện *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Kể lại câu chuyện hay kỷ niệm đáng nhớ..."
                    value={storyForm.story}
                    onChange={(e) => setStoryForm({ ...storyForm, story: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: "0.5rem 1rem" }}>Lưu Kỷ Niệm</button>
                </div>
              </form>
            )}

            {stories.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Chưa có câu chuyện nào trong sổ kỷ niệm.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
                {stories.map((s) => (
                  <div key={s.id} className="glass-panel" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <h4 style={{ fontWeight: "700", fontSize: "1rem", color: "var(--status-active)" }}>{s.title}</h4>
                      <button onClick={() => handleDeleteStory(s.id)} style={{ color: "var(--text-muted)" }} title="Xoá">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-primary)", lineHeight: "1.5" }}>{s.story}</p>
                    {s.people && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                        👥 Người tham gia: {s.people}
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
