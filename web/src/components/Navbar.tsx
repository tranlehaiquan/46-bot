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

  const tabClasses = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
      active
        ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/35"
        : "text-slate-400 border border-transparent hover:text-slate-200 hover:bg-white/5"
    }`;

  return (
    <header className="glass-panel mx-6 my-4 px-6 py-3 flex items-center justify-between rounded-2xl">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)]">
          <Bot size={22} className="text-white" />
        </div>
        <h2 className="text-lg font-bold tracking-tight text-white">
          46-Bot <span className="text-indigo-400 font-medium text-sm">Admin</span>
        </h2>
      </div>

      {/* Page Tabs */}
      <div className="flex items-center gap-2">
        <button
          id="nav-channels"
          onClick={() => onNavigate("channels")}
          className={tabClasses(currentPage === "channels")}
        >
          <MessageSquare size={15} />
          <span>Channels</span>
        </button>
        <button
          id="nav-calendar"
          onClick={() => onNavigate("calendar")}
          className={tabClasses(currentPage === "calendar")}
        >
          <CalendarDays size={15} />
          <span>Calendar</span>
        </button>
      </div>

      {/* Right side: status + logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
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
          className="btn btn-secondary px-3.5 py-1.5 text-xs"
          title="Logout"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
