import React, { useState } from "react";
import { Search, Pause, Play, Trash2, Clock, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import type { ScheduledLookup } from "../../api";

interface ChannelLookupsTabProps {
  lookups: ScheduledLookup[];
  onToggleActive: (lookup: ScheduledLookup) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function formatSchedule(lookup: ScheduledLookup): string {
  const time = `${String(lookup.hour).padStart(2, "0")}:${String(lookup.minute).padStart(2, "0")}`;

  switch (lookup.recurrence) {
    case "daily":
      return `Hàng ngày lúc ${time}`;
    case "weekly": {
      const dayName = lookup.weekday !== null ? WEEKDAYS[lookup.weekday] ?? `Thứ ${lookup.weekday}` : "chưa rõ";
      return `Hàng tuần (${dayName}) lúc ${time}`;
    }
    case "monthly": {
      return `Hàng tháng (ngày ${lookup.dayOfMonth}) lúc ${time}`;
    }
    default:
      return `${lookup.recurrence} lúc ${time}`;
  }
}

export function ChannelLookupsTab({
  lookups,
  onToggleActive,
  onDelete,
}: ChannelLookupsTabProps) {
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const handleToggle = async (lookup: ScheduledLookup) => {
    try {
      setLoadingId(lookup.id);
      await onToggleActive(lookup);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update lookup");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn xoá lịch tra cứu này không?")) return;
    try {
      setLoadingId(id);
      await onDelete(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete lookup");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-indigo-400" />
          <h3 className="text-lg font-bold text-white">Scheduled Lookups</h3>
          <span className="badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            {lookups.length}
          </span>
        </div>
      </div>

      {lookups.length === 0 ? (
        <div className="text-center text-slate-400 py-12 text-sm glass-panel">
          <Search size={36} className="mx-auto mb-3 opacity-30 text-indigo-400" />
          <p className="font-semibold text-slate-300 mb-1">Chưa có lịch tra cứu nào</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Lịch tra cứu được thêm trực tiếp qua chat Zalo (ví dụ: &ldquo;Mỗi sáng 7h tra cứu thời tiết và giá vàng&rdquo;).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
          {lookups.map((item) => {
            const isLoading = loadingId === item.id;
            return (
              <div
                key={item.id}
                className={`glass-panel p-4 flex flex-col justify-between gap-3 transition-all ${
                  !item.active ? "opacity-75 border-slate-700/60" : ""
                }`}
              >
                <div>
                  {/* Top row: Status badge & Recurrence badge */}
                  <div className="flex justify-between items-center gap-2 mb-2.5">
                    <span
                      className={`badge ${
                        item.active ? "badge-active" : "badge-pending"
                      }`}
                    >
                      {item.active ? "Active" : "Paused"}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                      <Clock size={12} />
                      {formatSchedule(item)}
                    </span>
                  </div>

                  {/* Instruction */}
                  <h4 className="font-semibold text-sm text-slate-100 mb-2 leading-snug">
                    {item.instruction}
                  </h4>

                  {/* Last Run Info */}
                  <div className="pt-2 border-t border-white/[0.06] text-xs">
                    <div className="text-slate-400 mb-1 flex items-center justify-between">
                      <span>Lần chạy gần nhất:</span>
                      {item.lastRun ? (
                        item.lastRun.status === "sent" ? (
                          <span className="badge badge-active py-0.5 px-2 text-[11px] flex items-center gap-1">
                            <CheckCircle2 size={11} /> Sent ({item.lastRun.fireDate})
                          </span>
                        ) : item.lastRun.status === "running" ? (
                          <span className="badge badge-pending py-0.5 px-2 text-[11px] flex items-center gap-1">
                            <Clock size={11} /> Running (lần {item.lastRun.attemptCount})
                          </span>
                        ) : (
                          <span className="badge badge-disabled py-0.5 px-2 text-[11px] flex items-center gap-1">
                            <AlertCircle size={11} /> Failed ({item.lastRun.fireDate})
                          </span>
                        )
                      ) : (
                        <span className="text-slate-500 italic">Chưa chạy</span>
                      )}
                    </div>

                    {item.lastRun?.status === "failed" && item.lastRun.lastError && (
                      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2 rounded text-[11px] font-mono break-all mt-1">
                        {item.lastRun.lastError}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom action buttons: Pause/Resume & Delete */}
                <div className="flex justify-end items-center gap-2 pt-2 border-t border-white/[0.04]">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleToggle(item)}
                    className={`btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 ${
                      item.active
                        ? "text-amber-400 hover:text-amber-300"
                        : "text-emerald-400 hover:text-emerald-300"
                    }`}
                    title={item.active ? "Tạm dừng" : "Tiếp tục"}
                  >
                    {item.active ? (
                      <>
                        <Pause size={13} />
                        <span>Tạm dừng</span>
                      </>
                    ) : (
                      <>
                        <Play size={13} />
                        <span>Kích hoạt</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleDelete(item.id)}
                    className="btn btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5"
                    title="Xoá"
                  >
                    <Trash2 size={13} />
                    <span>Xoá</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
