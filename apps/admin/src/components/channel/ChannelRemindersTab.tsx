import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Calendar,
  Cake,
  Heart,
  Flame,
  Clock,
  Sun,
  Moon,
} from "lucide-react";
import { CalendarMonthGrid } from "../CalendarMonthGrid";
import type { EventItem, HolidayOccurrence, CalendarEventOccurrence } from "../../api";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from "../../hooks/useAdminQueries";

interface ChannelRemindersTabProps {
  chatId: string;
  events: EventItem[];
  calYear: number;
  calMonth: number;
  calHolidays: HolidayOccurrence[];
  calEvents: CalendarEventOccurrence[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const EVENT_KINDS = [
  { id: "birthday", label: "Sinh nhật", icon: Cake, color: "text-pink-400 bg-pink-500/10 border-pink-500/30" },
  { id: "anniversary", label: "Kỷ niệm", icon: Heart, color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
  { id: "gio", label: "Giỗ chạp", icon: Flame, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  { id: "event", label: "Sự kiện", icon: Calendar, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30" },
] as const;

const RECURRENCE_OPTIONS = [
  { id: "yearly", label: "Hàng năm" },
  { id: "monthly", label: "Hàng tháng" },
  { id: "none", label: "Một lần" },
] as const;

const ADVANCE_DAYS_OPTIONS = [
  { days: 0, label: "Đúng ngày" },
  { days: 1, label: "Trước 1 ngày" },
  { days: 3, label: "Trước 3 ngày" },
  { days: 7, label: "Trước 7 ngày" },
] as const;

export function ChannelRemindersTab({
  chatId,
  events,
  calYear,
  calMonth,
  calHolidays,
  calEvents,
  onPrevMonth,
  onNextMonth,
}: ChannelRemindersTabProps) {
  const createEventMutation = useCreateEvent(chatId);
  const updateEventMutation = useUpdateEvent(chatId);
  const deleteEventMutation = useDeleteEvent(chatId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);

  const [eventForm, setEventForm] = useState({
    title: "",
    kind: "birthday" as EventItem["kind"],
    calendar: "solar" as "solar" | "lunar",
    day: 1,
    month: 1,
    year: "",
    recurrence: "yearly" as EventItem["recurrence"],
    remindDaysBefore: 0,
    notes: "",
  });

  const handleStartCreate = () => {
    setEditingEvent(null);
    setEventForm({
      title: "",
      kind: "birthday",
      calendar: "solar",
      day: new Date().getDate(),
      month: new Date().getMonth() + 1,
      year: "",
      recurrence: "yearly",
      remindDaysBefore: 0,
      notes: "",
    });
    setDialogOpen(true);
  };

  const handleStartEdit = (ev: EventItem) => {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title,
      kind: ev.kind as EventItem["kind"],
      calendar: ev.calendar,
      day: ev.day,
      month: ev.month,
      year: ev.year ? String(ev.year) : "",
      recurrence: ev.recurrence,
      remindDaysBefore: ev.remindDaysBefore,
      notes: ev.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: eventForm.title.trim(),
      kind: eventForm.kind,
      calendar: eventForm.calendar,
      day: Number(eventForm.day),
      month: Number(eventForm.month),
      year: eventForm.year ? Number(eventForm.year) : undefined,
      recurrence: eventForm.recurrence,
      remindDaysBefore: Number(eventForm.remindDaysBefore),
      notes: eventForm.notes.trim() || undefined,
    };

    try {
      if (editingEvent) {
        await updateEventMutation.mutateAsync({ id: editingEvent.id, updates: payload });
      } else {
        await createEventMutation.mutateAsync(payload);
      }
      setDialogOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save event");
    }
  };

  const handleDelete = async () => {
    if (!eventToDelete) return;
    try {
      await deleteEventMutation.mutateAsync(eventToDelete);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setEventToDelete(null);
    }
  };

  const filteredMonthHolidays = calHolidays.filter((h) => {
    const [hy, hm] = h.occurrenceDateStr.split("-").map(Number);
    return hy === calYear && hm === calMonth;
  });

  const currentKindConfig = EVENT_KINDS.find((k) => k.id === eventForm.kind) || EVENT_KINDS[0];
  const KindIcon = currentKindConfig.icon;

  // Context-aware year label & placeholder based on event kind
  const yearMeta = (() => {
    switch (eventForm.kind) {
      case "gio":
        return { label: "Năm mất (Tùy chọn)", placeholder: "VD: 2015" };
      case "birthday":
        return { label: "Năm sinh (Tùy chọn)", placeholder: "VD: 1990" };
      case "anniversary":
        return { label: "Năm bắt đầu (Tùy chọn)", placeholder: "VD: 2018" };
      default:
        return { label: "Năm (Tùy chọn)", placeholder: "VD: 2026" };
    }
  })();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Channel Calendar */}
      <div className="glass-panel p-5 mb-6">
        <CalendarMonthGrid
          year={calYear}
          month={calMonth}
          holidays={filteredMonthHolidays}
          events={calEvents}
          showChannelLabels={false}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          onSelectEvent={(eventId) => {
            const ev = events.find((e) => e.id === eventId);
            if (ev) handleStartEdit(ev);
          }}
        />
      </div>

      {/* Events List Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2.5">
          <Calendar size={20} className="text-indigo-400" />
          <h3 className="text-lg font-bold text-white">Events & Reminders</h3>
          <Badge variant="indigo">{events.length}</Badge>
        </div>
        <Button size="sm" onClick={handleStartCreate}>
          <Plus size={14} />
          <span>Create New Event</span>
        </Button>
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <div className="text-center text-slate-400 py-12 text-sm glass-panel">
          <Calendar size={36} className="mx-auto mb-3 opacity-30 text-indigo-400" />
          <p className="font-semibold text-slate-300 mb-1">Chưa có sự kiện nào</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Nhấn &ldquo;Create New Event&rdquo; để thiết lập sinh nhật, ngày giỗ, hoặc nhắc nhở định kỳ cho nhóm này.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {events.map((ev) => {
            const kindMeta = EVENT_KINDS.find((k) => k.id === ev.kind);
            const Icon = kindMeta?.icon || Calendar;
            return (
              <div
                key={ev.id}
                className="glass-panel p-4 flex flex-col justify-between gap-3 transition-all hover:border-white/20 hover:shadow-lg"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`p-1.5 rounded-lg shrink-0 ${kindMeta?.color || "text-indigo-400 bg-indigo-500/10"}`}>
                        <Icon size={14} />
                      </div>
                      <h4 className="font-bold text-sm text-slate-100 truncate" title={ev.title}>
                        {ev.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleStartEdit(ev)}
                        title="Edit event"
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEventToDelete(ev.id)}
                        className="text-slate-400 hover:text-rose-400"
                        title="Delete event"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-wrap text-xs mb-2">
                    <Badge variant={ev.calendar === "lunar" ? "purple" : "indigo"}>
                      {ev.calendar === "lunar" ? "🌙 Âm lịch" : "☀️ Dương lịch"} ({ev.day}/{ev.month}
                      {ev.year ? `/${ev.year}` : ""})
                    </Badge>
                    <Badge variant="default" className="text-slate-300">
                      {kindMeta?.label || ev.kind}
                    </Badge>
                    <Badge variant="default" className="text-slate-400">
                      {ev.recurrence}
                    </Badge>
                    {ev.remindDaysBefore > 0 && (
                      <Badge variant="pending">
                        <Clock size={10} className="mr-0.5 inline" /> Nhắc trước {ev.remindDaysBefore}d
                      </Badge>
                    )}
                  </div>

                  {ev.notes && (
                    <p className="text-xs text-slate-400 italic border-t border-white/[0.04] pt-2 line-clamp-2">
                      {ev.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modern Redesigned Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl p-6 sm:p-7 gap-5 border border-white/10 shadow-2xl">
          <DialogHeader className="pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${currentKindConfig.color}`}>
                <KindIcon size={20} />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {editingEvent ? `Chỉnh sửa: ${editingEvent.title}` : "Tạo sự kiện mới"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Thiết lập ngày kỷ niệm, lịch âm/dương và chu kỳ nhắc nhở tự động
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Event Title */}
            <div>
              <Label htmlFor="event-title" required>Tên sự kiện</Label>
              <Input
                id="event-title"
                required
                placeholder="VD: Sinh nhật Mẹ, Đám cưới Alex, Giỗ ông nội..."
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                className="text-base font-medium py-2.5"
                autoFocus
              />
            </div>

            {/* Event Kind (Type) Chips */}
            <div>
              <Label>Loại sự kiện</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EVENT_KINDS.map((kind) => {
                  const Icon = kind.icon;
                  const isSelected = eventForm.kind === kind.id;
                  return (
                    <button
                      key={kind.id}
                      type="button"
                      onClick={() => setEventForm({ ...eventForm, kind: kind.id })}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? `${kind.color} shadow-sm shadow-indigo-500/20 ring-1 ring-white/20`
                          : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <Icon size={15} />
                      <span>{kind.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calendar & Date Box */}
            <div className="p-4 rounded-xl bg-black/25 border border-white/[0.08] flex flex-col gap-3.5">
              {/* Solar vs Lunar Segmented Control */}
              <div>
                <Label>Hệ lịch</Label>
                <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setEventForm({ ...eventForm, calendar: "solar" })}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      eventForm.calendar === "solar"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Sun size={14} className={eventForm.calendar === "solar" ? "text-amber-300" : ""} />
                    <span>Dương lịch (Solar)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEventForm({ ...eventForm, calendar: "lunar" })}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      eventForm.calendar === "lunar"
                        ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Moon size={14} className={eventForm.calendar === "lunar" ? "text-amber-200" : ""} />
                    <span>Âm lịch (Lunar)</span>
                  </button>
                </div>
              </div>

              {/* Day, Month, Year Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="event-day" required>Ngày (Day)</Label>
                  <Input
                    id="event-day"
                    type="number"
                    min={1}
                    max={31}
                    required
                    value={eventForm.day}
                    onChange={(e) => setEventForm({ ...eventForm, day: Number(e.target.value) })}
                    className="text-center font-mono text-base font-bold"
                  />
                </div>

                <div>
                  <Label htmlFor="event-month" required>Tháng (Month)</Label>
                  <Input
                    id="event-month"
                    type="number"
                    min={1}
                    max={12}
                    required
                    value={eventForm.month}
                    onChange={(e) => setEventForm({ ...eventForm, month: Number(e.target.value) })}
                    className="text-center font-mono text-base font-bold"
                  />
                </div>

                <div>
                  <Label htmlFor="event-year">{yearMeta.label}</Label>
                  <Input
                    id="event-year"
                    type="number"
                    min={1900}
                    max={2100}
                    placeholder={yearMeta.placeholder}
                    value={eventForm.year}
                    onChange={(e) => setEventForm({ ...eventForm, year: e.target.value })}
                    className="text-center font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Recurrence & Remind Advance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Recurrence Segmented Control */}
              <div>
                <Label>Chu kỳ lặp lại</Label>
                <div className="grid grid-cols-3 gap-1 bg-black/30 p-1 rounded-xl border border-white/[0.08]">
                  {RECURRENCE_OPTIONS.map((opt) => {
                    const isSelected = eventForm.recurrence === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEventForm({ ...eventForm, recurrence: opt.id })}
                        className={`py-2 px-1 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                          isSelected
                            ? "bg-slate-700 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Remind in Advance with Wrapping Presets & Input */}
              <div>
                <Label htmlFor="event-remind">Nhắc trước</Label>
                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {ADVANCE_DAYS_OPTIONS.map((opt) => {
                      const isSelected = eventForm.remindDaysBefore === opt.days;
                      return (
                        <button
                          key={opt.days}
                          type="button"
                          onClick={() => setEventForm({ ...eventForm, remindDaysBefore: opt.days })}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/50 shadow-sm"
                              : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Input
                      id="event-remind"
                      type="number"
                      min={0}
                      max={30}
                      value={eventForm.remindDaysBefore}
                      onChange={(e) => setEventForm({ ...eventForm, remindDaysBefore: Number(e.target.value) })}
                      className="font-mono text-center w-14 py-1 text-sm h-8"
                    />
                    <span className="text-xs text-slate-400">ngày</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="event-notes">Ghi chú (Tùy chọn)</Label>
              <Input
                id="event-notes"
                placeholder="Gợi ý quà tặng, địa điểm liên hoan hoặc lưu ý đặc biệt..."
                value={eventForm.notes}
                onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-3 mt-1 border-t border-white/[0.08] flex justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDialogOpen(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                loading={createEventMutation.isPending || updateEventMutation.isPending}
                className="px-5 shadow-lg shadow-indigo-600/25"
              >
                {editingEvent ? "Cập nhật sự kiện" : "Lưu sự kiện"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={eventToDelete !== null}
        onOpenChange={(open) => !open && setEventToDelete(null)}
        title="Xoá sự kiện nhắc nhở"
        description="Bạn có chắc chắn muốn xoá sự kiện này không? Bot sẽ ngừng gửi thông báo cho sự kiện này."
        confirmText="Xoá sự kiện"
        variant="destructive"
        loading={deleteEventMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
