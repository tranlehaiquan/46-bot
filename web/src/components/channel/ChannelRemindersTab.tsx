import React, { useState } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { CalendarMonthGrid } from "../CalendarMonthGrid";
import type { EventItem, HolidayOccurrence, CalendarEventOccurrence } from "../../api";

interface ChannelRemindersTabProps {
  events: EventItem[];
  calYear: number;
  calMonth: number;
  calHolidays: HolidayOccurrence[];
  calEvents: CalendarEventOccurrence[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCreateEvent: (eventData: {
    title: string;
    kind: string;
    calendar: "solar" | "lunar";
    day: number;
    month: number;
    year?: number;
    recurrence: string;
    remindDaysBefore: number;
    notes?: string;
  }) => Promise<void>;
  onUpdateEvent: (id: number, eventData: Partial<EventItem>) => Promise<void>;
  onDeleteEvent: (id: number) => Promise<void>;
}

export function ChannelRemindersTab({
  events,
  calYear,
  calMonth,
  calHolidays,
  calEvents,
  onPrevMonth,
  onNextMonth,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
}: ChannelRemindersTabProps) {
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  const [eventForm, setEventForm] = useState({
    title: "",
    kind: "event",
    calendar: "solar" as "solar" | "lunar",
    day: 1,
    month: 1,
    year: "",
    recurrence: "yearly",
    remindDaysBefore: 0,
    notes: "",
  });

  const handleStartCreate = () => {
    if (showEventForm && !editingEvent) {
      setShowEventForm(false);
    } else {
      setEditingEvent(null);
      setEventForm({
        title: "",
        kind: "event",
        calendar: "solar",
        day: 1,
        month: 1,
        year: "",
        recurrence: "yearly",
        remindDaysBefore: 0,
        notes: "",
      });
      setShowEventForm(true);
    }
  };

  const handleStartEdit = (ev: EventItem) => {
    setEditingEvent(ev);
    setEventForm({
      title: ev.title,
      kind: ev.kind,
      calendar: ev.calendar,
      day: ev.day,
      month: ev.month,
      year: ev.year ? String(ev.year) : "",
      recurrence: ev.recurrence,
      remindDaysBefore: ev.remindDaysBefore,
      notes: ev.notes || "",
    });
    setShowEventForm(true);
  };

  const handleCancelForm = () => {
    setEditingEvent(null);
    setShowEventForm(false);
    setEventForm({
      title: "",
      kind: "event",
      calendar: "solar",
      day: 1,
      month: 1,
      year: "",
      recurrence: "yearly",
      remindDaysBefore: 0,
      notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: eventForm.title,
      kind: eventForm.kind as EventItem["kind"],
      calendar: eventForm.calendar,
      day: Number(eventForm.day),
      month: Number(eventForm.month),
      year: eventForm.year ? Number(eventForm.year) : undefined,
      recurrence: eventForm.recurrence as EventItem["recurrence"],
      remindDaysBefore: Number(eventForm.remindDaysBefore),
      notes: eventForm.notes || undefined,
    };

    if (editingEvent) {
      await onUpdateEvent(editingEvent.id, payload);
    } else {
      await onCreateEvent(payload);
    }

    handleCancelForm();
  };

  const filteredMonthHolidays = calHolidays.filter((h) => {
    const [hy, hm] = h.occurrenceDateStr.split("-").map(Number);
    return hy === calYear && hm === calMonth;
  });

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
        <h3 className="text-lg font-bold text-white">Events & Reminders</h3>
        <button
          onClick={handleStartCreate}
          className="btn btn-primary text-xs px-3.5 py-2"
        >
          <Plus size={14} />
          <span>{showEventForm && !editingEvent ? "Close Form" : "Create New Event"}</span>
        </button>
      </div>

      {/* Event Form (Create or Edit) */}
      {showEventForm && (
        <form onSubmit={handleSubmit} className="glass-panel p-5 mb-6 border border-indigo-500/40 shadow-lg">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">
                {editingEvent ? `Edit Event: ${editingEvent.title}` : "Create New Event"}
              </span>
              {editingEvent && (
                <span className="badge badge-pending text-[10px]">Editing</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleCancelForm}
              className="text-slate-400 hover:text-slate-200 p-1"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5 mb-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Event Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Dad's Birthday..."
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                className="form-input"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Event Type</label>
              <select
                value={eventForm.kind}
                onChange={(e) => setEventForm({ ...eventForm, kind: e.target.value })}
                className="form-input"
              >
                <option value="event">General Event</option>
                <option value="birthday">Birthday</option>
                <option value="anniversary">Anniversary</option>
                <option value="gio">Death Anniversary (Giỗ)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Calendar</label>
              <select
                value={eventForm.calendar}
                onChange={(e) => setEventForm({ ...eventForm, calendar: e.target.value as "solar" | "lunar" })}
                className="form-input"
              >
                <option value="solar">Solar (Dương lịch)</option>
                <option value="lunar">Lunar (Âm lịch)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Day / Month</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={eventForm.day}
                  onChange={(e) => setEventForm({ ...eventForm, day: Number(e.target.value) })}
                  className="form-input"
                  placeholder="Day"
                />
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={eventForm.month}
                  onChange={(e) => setEventForm({ ...eventForm, month: Number(e.target.value) })}
                  className="form-input"
                  placeholder="Month"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Year (Optional)</label>
              <input
                type="number"
                min={1900}
                max={2100}
                placeholder="e.g. 1990"
                value={eventForm.year}
                onChange={(e) => setEventForm({ ...eventForm, year: e.target.value })}
                className="form-input"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Recurrence</label>
              <select
                value={eventForm.recurrence}
                onChange={(e) => setEventForm({ ...eventForm, recurrence: e.target.value })}
                className="form-input"
              >
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
                <option value="none">One-time</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Remind In Advance (days)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={eventForm.remindDaysBefore}
                onChange={(e) => setEventForm({ ...eventForm, remindDaysBefore: Number(e.target.value) })}
                className="form-input"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Notes (Optional)</label>
              <input
                type="text"
                placeholder="Additional details..."
                value={eventForm.notes}
                onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                className="form-input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancelForm}
              className="btn btn-secondary px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary px-4 py-2 text-sm">
              {editingEvent ? "Update Event" : "Save Event"}
            </button>
          </div>
        </form>
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <div className="text-center text-slate-400 py-8 text-sm">
          No events or reminders recorded for this channel.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {events.map((ev) => (
            <div
              key={ev.id}
              className={`glass-panel p-4 flex flex-col gap-2 transition-all ${
                editingEvent?.id === ev.id ? "border-indigo-500/80 shadow-[0_0_15px_rgba(99,102,241,0.25)]" : ""
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-sm text-slate-100 flex-1">{ev.title}</h4>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleStartEdit(ev)}
                    className="text-slate-400 hover:text-indigo-400 p-1 transition-colors"
                    title="Edit event"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => onDeleteEvent(ev.id)}
                    className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                    title="Delete event"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap text-xs">
                <span className="badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  {ev.day}/{ev.month} {ev.calendar === "lunar" ? "(Âm lịch)" : "(Dương lịch)"}
                  {ev.year ? `/${ev.year}` : ""}
                </span>
                <span className="badge bg-slate-800 text-slate-300">
                  {ev.kind}
                </span>
                <span className="badge bg-slate-800/80 text-slate-400">
                  {ev.recurrence}
                </span>
                {ev.remindDaysBefore > 0 && (
                  <span className="badge badge-pending">Remind {ev.remindDaysBefore}d before</span>
                )}
              </div>
              {ev.notes && (
                <p className="text-xs text-slate-400 mt-1 italic border-t border-white/[0.04] pt-1.5">
                  {ev.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
