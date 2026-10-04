import React, { useState } from "react";
import { Users, User, Search, CheckCircle2, XCircle, ArrowUpRight, Copy, Check } from "lucide-react";
import type { Channel, ChannelStatus } from "../api";

export function ChannelList({
  channels,
  selectedChannel,
  onSelectChannel,
  onUpdateStatus,
}: {
  channels: Channel[];
  selectedChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onUpdateStatus: (chatId: string, status: ChannelStatus) => Promise<void>;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredChannels = channels.filter((c) => {
    const matchesFilter = filter === "all" || c.status === filter;
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.chatId.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const pendingCount = channels.filter((c) => c.status === "pending").length;

  return (
    <div className="glass-panel" style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 120px)",
      overflow: "hidden"
    }}>
      {/* Header & Search */}
      <div style={{ padding: "1.25rem 1.25rem 0.75rem 1.25rem" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: "700", marginBottom: "0.85rem" }}>
          Danh sách Kênh ({channels.length})
        </h3>

        <div style={{ position: "relative", marginBottom: "0.85rem" }}>
          <Search size={16} style={{
            position: "absolute",
            left: "0.75rem",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)"
          }} />
          <input
            type="text"
            placeholder="Tìm tên hoặc Chat ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: "2.25rem", fontSize: "0.85rem" }}
          />
        </div>

        {/* Status Filters */}
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {(["all", "pending", "active", "disabled"] as const).map((tab) => {
            const count = tab === "all" ? channels.length : channels.filter((c) => c.status === tab).length;
            const isActive = filter === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  borderRadius: "var(--radius-sm)",
                  background: isActive ? "var(--bg-tertiary)" : "transparent",
                  color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                  border: isActive ? "1px solid var(--border-color)" : "1px solid transparent",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem"
                }}
              >
                <span>{tab === "all" ? "Tất cả" : tab.toUpperCase()}</span>
                <span style={{
                  fontSize: "0.7rem",
                  opacity: 0.7,
                  background: tab === "pending" && count > 0 ? "var(--status-pending)" : "var(--bg-primary)",
                  color: tab === "pending" && count > 0 ? "#000" : "inherit",
                  padding: "0.1rem 0.35rem",
                  borderRadius: "var(--radius-full)"
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Channels List Stream */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "0.5rem 0.75rem 1rem 0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem"
      }}>
        {filteredChannels.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "3rem 1rem",
            color: "var(--text-muted)",
            fontSize: "0.85rem"
          }}>
            Không có kênh nào phù hợp.
          </div>
        ) : (
          filteredChannels.map((c) => {
            const isSelected = selectedChannel?.chatId === c.chatId;
            return (
              <div
                key={c.chatId}
                onClick={() => onSelectChannel(c)}
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "var(--radius-md)",
                  background: isSelected ? "var(--bg-tertiary)" : "rgba(255, 255, 255, 0.02)",
                  border: isSelected ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  boxShadow: isSelected ? "0 0 15px rgba(99, 102, 241, 0.15)" : "none"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {c.chatType === "GROUP" ? (
                      <Users size={16} color="var(--accent-primary)" />
                    ) : (
                      <User size={16} color="var(--status-active)" />
                    )}
                    <span style={{ fontWeight: "600", fontSize: "0.9rem" }}>{c.name}</span>
                  </div>

                  <span className={`badge badge-${c.status}`}>
                    {c.status}
                  </span>
                </div>

                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)"
                }}>
                  <div
                    onClick={(e) => handleCopy(c.chatId, e)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      cursor: "copy",
                      background: "rgba(0,0,0,0.3)",
                      padding: "0.15rem 0.45rem",
                      borderRadius: "var(--radius-sm)"
                    }}
                    title="Bấm để copy chat ID"
                  >
                    <span>{c.chatId.length > 18 ? `${c.chatId.slice(0, 16)}...` : c.chatId}</span>
                    {copiedId === c.chatId ? <Check size={12} color="var(--status-active)" /> : <Copy size={12} />}
                  </div>

                  <span>
                    {new Date(c.lastActiveAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* Quick actions for Pending channels */}
                {c.status === "pending" && (
                  <div style={{
                    display: "flex",
                    gap: "0.4rem",
                    marginTop: "0.25rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px dashed rgba(255, 255, 255, 0.06)"
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(c.chatId, "active");
                      }}
                      className="btn btn-success"
                      style={{ flex: 1, padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}
                    >
                      <CheckCircle2 size={13} />
                      <span>Duyệt (Active)</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(c.chatId, "disabled");
                      }}
                      className="btn btn-danger"
                      style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}
                    >
                      <XCircle size={13} />
                      <span>Chặn</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
