import React, { useState } from "react";
import { Users, User, Search, CheckCircle2, XCircle, Copy, Check } from "lucide-react";
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

  return (
    <div className="glass-panel flex flex-col h-[calc(100vh-120px)] overflow-hidden">
      {/* Header & Search */}
      <div className="p-5 pb-3">
        <h3 className="text-base font-bold mb-3 text-white">
          Channels ({channels.length})
        </h3>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name or Chat ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-9 text-sm"
          />
        </div>

        {/* Status Filters */}
        <div className="flex gap-1 bg-black/25 p-1 rounded-xl">
          {(["all", "pending", "active", "disabled"] as const).map((tab) => {
            const count = tab === "all" ? channels.length : channels.filter((c) => c.status === tab).length;
            const isActive = filter === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`flex-1 py-1 px-1 text-[11px] font-semibold rounded-md transition-all duration-150 flex items-center justify-center gap-1 whitespace-nowrap min-w-0 cursor-pointer ${
                  isActive
                    ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                    : "bg-transparent text-slate-400 border border-transparent hover:text-slate-200"
                }`}
              >
                <span>{tab.toUpperCase()}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none ${
                  isActive ? "opacity-100" : "opacity-75"
                } ${
                  tab === "pending" && count > 0
                    ? "bg-amber-500 text-black font-bold"
                    : "bg-white/10 text-inherit"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Channels List Stream */}
      <div className="flex-1 overflow-y-auto px-3 py-2 pb-4 flex flex-col gap-2">
        {filteredChannels.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-400 text-sm">
            No matching channels found.
          </div>
        ) : (
          filteredChannels.map((c) => {
            const isSelected = selectedChannel?.chatId === c.chatId;
            return (
              <div
                key={c.chatId}
                onClick={() => onSelectChannel(c)}
                className={`p-3.5 rounded-xl cursor-pointer transition-all duration-150 flex flex-col gap-2 border ${
                  isSelected
                    ? "bg-slate-800/90 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                    : "bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.05] hover:border-white/15"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {c.chatType === "GROUP" ? (
                      <Users size={16} className="text-indigo-400" />
                    ) : (
                      <User size={16} className="text-emerald-400" />
                    )}
                    <span className="font-semibold text-sm text-slate-100">{c.name}</span>
                  </div>

                  <span className={`badge badge-${c.status}`}>
                    {c.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <div
                    onClick={(e) => handleCopy(c.chatId, e)}
                    className="flex items-center gap-1.5 cursor-copy bg-black/30 hover:bg-black/50 px-2 py-0.5 rounded transition-colors"
                    title="Click to copy Chat ID"
                  >
                    <span>{c.chatId.length > 18 ? `${c.chatId.slice(0, 16)}...` : c.chatId}</span>
                    {copiedId === c.chatId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </div>

                  <span>
                    {new Date(c.lastActiveAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* Quick actions for Pending channels */}
                {c.status === "pending" && (
                  <div className="flex gap-1.5 mt-1 pt-2 border-t border-dashed border-white/[0.06]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(c.chatId, "active");
                      }}
                      className="btn btn-success flex-1 py-1 px-2 text-xs gap-1"
                    >
                      <CheckCircle2 size={13} />
                      <span>Approve (Active)</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(c.chatId, "disabled");
                      }}
                      className="btn btn-danger py-1 px-2 text-xs gap-1"
                    >
                      <XCircle size={13} />
                      <span>Block</span>
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
