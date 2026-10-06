import React, { useState, useEffect } from "react";
import { Users, User, RefreshCw, Pencil, Check, X, Loader2 } from "lucide-react";
import type { Channel, ChannelStatus } from "../../api";
import { Button } from "../ui/button";

interface ChannelHeaderProps {
  channel: Channel;
  loading: boolean;
  onStatusChange: (status: ChannelStatus) => void;
  onRefresh: () => void;
  onRename?: (newName: string) => Promise<void>;
}

export function ChannelHeader({
  channel,
  loading,
  onStatusChange,
  onRefresh,
  onRename,
}: ChannelHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(channel.name);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNameInput(channel.name);
    setIsEditing(false);
  }, [channel.chatId, channel.name]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!onRename) return;
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    if (trimmed === channel.name) {
      setIsEditing(false);
      return;
    }
    try {
      setIsSaving(true);
      await onRename(trimmed);
      setIsEditing(false);
    } catch {
      // error handled in caller
    } finally {
      setIsSaving(false);
    }
  };

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
          {isEditing ? (
            <form onSubmit={handleSave} className="flex items-center gap-1.5 mb-1">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setNameInput(channel.name);
                    setIsEditing(false);
                  }
                }}
                autoFocus
                disabled={isSaving}
                className="form-input text-base font-semibold py-1 px-2.5 h-8 w-60 bg-slate-900 border-indigo-500/60"
                placeholder="Channel name..."
              />
              <button
                type="submit"
                disabled={isSaving || !nameInput.trim()}
                className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 cursor-pointer"
                title="Save (Enter)"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNameInput(channel.name);
                  setIsEditing(false);
                }}
                disabled={isSaving}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Cancel (Esc)"
              >
                <X size={15} />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2 group/header-title">
              <h2 className="text-xl font-bold text-white">{channel.name}</h2>
              {onRename && (
                <button
                  onClick={() => {
                    setNameInput(channel.name);
                    setIsEditing(true);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-white/10 transition-all opacity-70 group-hover/header-title:opacity-100 hover:!opacity-100 cursor-pointer"
                  title="Rename channel"
                >
                  <Pencil size={15} />
                </button>
              )}
            </div>
          )}
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

        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          title="Refresh data"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>
    </div>
  );
}
