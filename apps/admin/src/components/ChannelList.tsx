import React, { useState } from "react";
import { Users, User, Search, CheckCircle2, XCircle, Copy, Check, Pencil, X, Loader2 } from "lucide-react";
import type { Channel, ChannelStatus } from "../api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function ChannelList({
  channels,
  selectedChannel,
  onSelectChannel,
  onUpdateStatus,
  onRenameChannel,
}: {
  channels: Channel[];
  selectedChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onUpdateStatus: (chatId: string, status: ChannelStatus) => Promise<void>;
  onRenameChannel?: (chatId: string, name: string) => Promise<void>;
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | "group" | "private">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Inline rename state
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [isSavingRename, setIsSavingRename] = useState<boolean>(false);

  const typeCounts = {
    all: channels.length,
    group: channels.filter((c) => c.chatType === "GROUP").length,
    private: channels.filter((c) => c.chatType === "PRIVATE").length,
  };

  const channelsMatchingType = channels.filter(
    (c) => typeFilter === "all" || c.chatType.toLowerCase() === typeFilter
  );

  const filteredChannels = channels.filter((c) => {
    const matchesType = typeFilter === "all" || c.chatType.toLowerCase() === typeFilter;
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.chatId.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleStartRename = (channel: Channel, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(channel.chatId);
    setEditingName(channel.name);
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingChatId(null);
    setEditingName("");
  };

  const handleSaveRename = async (chatId: string, e?: React.MouseEvent | React.FormEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!onRenameChannel) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;

    const currentChannel = channels.find((c) => c.chatId === chatId);
    if (currentChannel && currentChannel.name === trimmed) {
      setEditingChatId(null);
      return;
    }

    try {
      setIsSavingRename(true);
      await onRenameChannel(chatId, trimmed);
      setEditingChatId(null);
    } catch {
      // error handled in caller
    } finally {
      setIsSavingRename(false);
    }
  };

  return (
    <div className="glass-panel flex flex-col h-[calc(100vh-120px)] overflow-hidden">
      {/* Header & Search */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-white">Channels</h3>
          <Badge variant="indigo">{channels.length}</Badge>
        </div>

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

        {/* Type Filters (All / Group / Private) */}
        <div className="flex gap-1 bg-black/25 p-1 rounded-xl mb-1.5">
          {([
            { id: "all", label: "ALL", icon: null },
            { id: "group", label: "GROUP", icon: Users, iconColor: "text-indigo-400" },
            { id: "private", label: "PRIVATE", icon: User, iconColor: "text-emerald-400" },
          ] as const).map(({ id, label, icon: TabIcon, iconColor }) => {
            const count = typeCounts[id];
            const isActive = typeFilter === id;
            const hasPending = channels.some(
              (c) => (id === "all" ? true : c.chatType.toLowerCase() === id) && c.status === "pending"
            );
            return (
              <button
                key={id}
                onClick={() => setTypeFilter(id)}
                className={`flex-1 py-1 px-1 text-[11px] font-semibold rounded-md transition-all duration-150 flex items-center justify-center gap-1.5 whitespace-nowrap min-w-0 cursor-pointer ${
                  isActive
                    ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                    : "bg-transparent text-slate-400 border border-transparent hover:text-slate-200"
                }`}
              >
                {TabIcon && <TabIcon size={12} className={isActive ? iconColor : "text-slate-400"} />}
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none ${
                    isActive ? "opacity-100" : "opacity-75"
                  } ${
                    hasPending && id !== "all"
                      ? "bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40"
                      : "bg-white/10 text-inherit"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Filters */}
        <div className="flex gap-1 bg-black/25 p-1 rounded-xl">
          {(["all", "pending", "active", "disabled"] as const).map((tab) => {
            const count =
              tab === "all"
                ? channelsMatchingType.length
                : channelsMatchingType.filter((c) => c.status === tab).length;
            const isActive = statusFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`flex-1 py-1 px-1 text-[11px] font-semibold rounded-md transition-all duration-150 flex items-center justify-center gap-1 whitespace-nowrap min-w-0 cursor-pointer ${
                  isActive
                    ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                    : "bg-transparent text-slate-400 border border-transparent hover:text-slate-200"
                }`}
              >
                <span>{tab.toUpperCase()}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none ${
                    isActive ? "opacity-100" : "opacity-75"
                  } ${
                    tab === "pending" && count > 0
                      ? "bg-amber-500 text-black font-bold"
                      : "bg-white/10 text-inherit"
                  }`}
                >
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
          <div className="text-center py-12 px-4 text-slate-400 text-sm flex flex-col items-center gap-2">
            <span>No matching channels found.</span>
            {(search || typeFilter !== "all" || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setStatusFilter("all");
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
              >
                Clear filters
              </button>
            )}
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {c.chatType === "GROUP" ? (
                      <Users size={16} className="text-indigo-400 shrink-0" />
                    ) : (
                      <User size={16} className="text-emerald-400 shrink-0" />
                    )}

                    {editingChatId === c.chatId ? (
                      <form
                        onSubmit={(e) => handleSaveRename(c.chatId, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 flex-1 min-w-0"
                      >
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") handleCancelRename();
                          }}
                          autoFocus
                          disabled={isSavingRename}
                          className="form-input py-0.5 px-2 text-sm text-white bg-slate-900 border-indigo-500/60 rounded h-7 w-full min-w-0"
                          placeholder="Channel name..."
                        />
                        <button
                          type="submit"
                          disabled={isSavingRename || !editingName.trim()}
                          className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                          title="Save (Enter)"
                        >
                          {isSavingRename ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelRename}
                          disabled={isSavingRename}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                          title="Cancel (Esc)"
                        >
                          <X size={13} />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 group/name">
                        <span className="font-semibold text-sm text-slate-100 truncate" title={c.name}>
                          {c.name}
                        </span>
                        {onRenameChannel && (
                          <button
                            onClick={(e) => handleStartRename(c, e)}
                            className="opacity-0 group-hover/name:opacity-100 hover:!opacity-100 p-0.5 rounded text-slate-400 hover:text-indigo-300 hover:bg-white/10 transition-all cursor-pointer shrink-0"
                            title="Rename channel"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {editingChatId !== c.chatId && (
                    <Badge variant={c.status}>{c.status}</Badge>
                  )}
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
                    <Button
                      variant="success"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(c.chatId, "active");
                      }}
                      className="flex-1 py-1 text-xs"
                    >
                      <CheckCircle2 size={13} />
                      <span>Approve</span>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(c.chatId, "disabled");
                      }}
                      className="py-1 text-xs"
                    >
                      <XCircle size={13} />
                      <span>Block</span>
                    </Button>
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
