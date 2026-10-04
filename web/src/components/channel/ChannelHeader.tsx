import React from "react";
import { Users, User, RefreshCw } from "lucide-react";
import type { Channel, ChannelStatus } from "../../api";

interface ChannelHeaderProps {
  channel: Channel;
  loading: boolean;
  onStatusChange: (status: ChannelStatus) => void;
  onRefresh: () => void;
}

export function ChannelHeader({
  channel,
  loading,
  onStatusChange,
  onRefresh,
}: ChannelHeaderProps) {
  return (
    <div className="p-5 px-6 border-b border-white/[0.08] flex items-center justify-between flex-wrap gap-4">
      {/* Channel Info */}
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center border border-white/[0.08] ${
            channel.chatType === "GROUP" ? "bg-indigo-500/15" : "bg-emerald-500/15"
          }`}
        >
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

      {/* Status & Refresh Controls */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-300 font-medium">Status:</span>
        <select
          value={channel.status}
          onChange={(e) => onStatusChange(e.target.value as ChannelStatus)}
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
          onClick={onRefresh}
          className="btn btn-secondary px-2.5 py-1.5"
          title="Refresh data"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}
