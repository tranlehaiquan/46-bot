import React from "react";
import { Bot, LogOut, Radio, Clock } from "lucide-react";
import { api, type Channel } from "../api";

export function Navbar({
  channels,
  onLogout,
}: {
  channels: Channel[];
  onLogout: () => void;
}) {
  const pendingCount = channels.filter((c) => c.status === "pending").length;
  const activeCount = channels.filter((c) => c.status === "active").length;

  return (
    <header className="glass-panel" style={{
      margin: "1rem 1.5rem",
      padding: "0.85rem 1.5rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: "var(--radius-lg)"
    }}>
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
        <div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: "700", letterSpacing: "-0.01em" }}>
            46-Bot <span style={{ color: "var(--accent-primary)", fontWeight: "500", fontSize: "0.9rem" }}>Admin</span>
          </h2>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {pendingCount > 0 && (
            <span className="badge badge-pending" title="Kênh đang chờ duyệt">
              <Clock size={12} />
              <span>{pendingCount} Pending</span>
            </span>
          )}
          <span className="badge badge-active" title="Kênh đang hoạt động">
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
          title="Đăng xuất"
        >
          <LogOut size={14} />
          <span>Thoát</span>
        </button>
      </div>
    </header>
  );
}
