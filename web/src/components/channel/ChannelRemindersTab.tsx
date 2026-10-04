import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  onDeleteEvent,
}: ChannelRemindersTabProps) {
  const [showEventForm, setShowEventForm] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateEvent({
      title: eventForm.title,
      kind: eventForm.kind,
      calendar: eventForm.calendar,
      day: Number(eventForm.day),
      month: Number(eventForm.month),
      year: eventForm.year ? Number(eventForm.year) : undefined,
      recurrence: eventForm.recurrence,
      remindDaysBefore: Number(eventForm.remindDaysBefore),
      notes: eventForm.notes || undefined,
    });
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
        />
      </div>

      {/* Events List Header */}
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-white">Events & Reminders</h3>
        <button
          onClick={() => setShowEventForm(!showEventForm)}
          className="btn btn-primary text-xs px-3.5 py-2"
        >
          <Plus size={14} />
          <span>{showEventForm ? "Close Form" : "Create New Event"}</span>
        </button>
      </div>

      {/* Event Form */}
      {showEventForm && (
        <form onSubmit={handleSubmit} className="glass-panel p-5 mb-6">
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
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary px-4 py-2 text-sm">
              Save Event
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
            <div key={ev.id} className="glass-panel p-4 flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-sm text-slate-100">{ev.title}</h4>
                <button
                  onClick={() => onDeleteEvent(ev.id)}
                  className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                  title="Delete event"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap text-xs">
                <span className="badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  {ev.day}/{ev.month} {ev.calendar === "lunar" ? "(Âm lịch)" : "(Dương lịch)"}
                </span>
                <span className="badge bg-slate-800 text-slate-300">
                  {ev.kind}
                </span>
                {ev.remindDaysBefore > 0 && (
                  <span className="badge badge-pending">Remind {ev.remindDaysBefore}d before</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
