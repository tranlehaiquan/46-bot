import React from "react";
import { Bot, LogOut, Radio, Clock, CalendarDays, MessageSquare } from "lucide-react";
import { api, type Channel } from "../api";

export function Navbar({
  channels,
  onLogout,
  currentPage,
  onNavigate,
}: {
  channels: Channel[];
  onLogout: () => void;
  currentPage: "channels" | "calendar";
  onNavigate: (page: "channels" | "calendar") => void;
}) {
  const pendingCount = channels.filter((c) => c.status === "pending").length;
  const activeCount = channels.filter((c) => c.status === "active").length;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.45rem 0.85rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    borderRadius: "var(--radius-md)",
    background: active ? "rgba(99, 102, 241, 0.15)" : "transparent",
    color: active ? "var(--accent-primary)" : "var(--text-secondary)",
    border: active ? "1px solid rgba(99, 102, 241, 0.35)" : "1px solid transparent",
    cursor: "pointer",
    transition: "all 0.15s ease",
  });

  return (
    <header className="glass-panel" style={{
      margin: "1rem 1.5rem",
      padding: "0.75rem 1.5rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: "var(--radius-lg)"
    }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          background: "linear-gradient(135deg, #6366f1, #3b82f6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 15px rgba(99, 102, 241, 0.4)"
        }}>
          <Bot size={22} color="#ffffff" />
        </div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: "700", letterSpacing: "-0.01em" }}>
          46-Bot <span style={{ color: "var(--accent-primary)", fontWeight: "500", fontSize: "0.9rem" }}>Admin</span>
        </h2>
      </div>

      {/* Page Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <button
          id="nav-channels"
          onClick={() => onNavigate("channels")}
          style={tabStyle(currentPage === "channels")}
        >
          <MessageSquare size={15} />
          <span>Channels</span>
        </button>
        <button
          id="nav-calendar"
          onClick={() => onNavigate("calendar")}
          style={tabStyle(currentPage === "calendar")}
        >
          <CalendarDays size={15} />
          <span>Calendar</span>
        </button>
      </div>

      {/* Right side: status + logout */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {pendingCount > 0 && (
            <span className="badge badge-pending" title="Channels awaiting approval">
              <Clock size={12} />
              <span>{pendingCount} Pending</span>
            </span>
          )}
          <span className="badge badge-active" title="Active channels">
            <Radio size={12} />
            <span>{activeCount} Active</span>
          </span>
        </div>

        <button
          onClick={() => {
            api.logout();
            onLogout();
          }}
          className="btn btn-secondary"
          style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}
          title="Logout"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
