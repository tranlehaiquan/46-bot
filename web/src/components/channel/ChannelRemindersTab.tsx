import React, { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { CalendarMonthGrid } from "../CalendarMonthGrid";
import type { EventItem, HolidayOccurrence, CalendarEventOccurrence } from "../../api";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
    setDialogOpen(true);
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
    setDialogOpen(true);
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
        <div className="flex items-center gap-2">
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
        <div className="text-center text-slate-400 py-8 text-sm glass-panel">
          No events or reminders recorded for this channel.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="glass-panel p-4 flex flex-col gap-2 transition-all hover:border-white/20"
            >
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-sm text-slate-100 flex-1">{ev.title}</h4>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleStartEdit(ev)}
                    title="Edit event"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEventToDelete(ev.id)}
                    className="text-slate-400 hover:text-rose-400"
                    title="Delete event"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap text-xs">
                <Badge variant="indigo">
                  {ev.day}/{ev.month} {ev.calendar === "lunar" ? "(Âm lịch)" : "(Dương lịch)"}
                  {ev.year ? `/${ev.year}` : ""}
                </Badge>
                <Badge variant="default">{ev.kind}</Badge>
                <Badge variant="default" className="text-slate-400">{ev.recurrence}</Badge>
                {ev.remindDaysBefore > 0 && (
                  <Badge variant="pending">Remind {ev.remindDaysBefore}d before</Badge>
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? `Edit Event: ${editingEvent.title}` : "Create New Event"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Event Title *</label>
                <Input
                  required
                  placeholder="e.g. Dad's Birthday..."
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
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
                  onChange={(e) =>
                    setEventForm({
                      ...eventForm,
                      calendar: e.target.value as "solar" | "lunar",
                    })
                  }
                  className="form-input"
                >
                  <option value="solar">Solar (Dương lịch)</option>
                  <option value="lunar">Lunar (Âm lịch)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Day / Month</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={eventForm.day}
                    onChange={(e) => setEventForm({ ...eventForm, day: Number(e.target.value) })}
                    placeholder="Day"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={eventForm.month}
                    onChange={(e) => setEventForm({ ...eventForm, month: Number(e.target.value) })}
                    placeholder="Month"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Year (Optional)</label>
                <Input
                  type="number"
                  min={1900}
                  max={2100}
                  placeholder="e.g. 1990"
                  value={eventForm.year}
                  onChange={(e) => setEventForm({ ...eventForm, year: e.target.value })}
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
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={eventForm.remindDaysBefore}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, remindDaysBefore: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Notes (Optional)</label>
                <Input
                  placeholder="Additional details..."
                  value={eventForm.notes}
                  onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createEventMutation.isPending || updateEventMutation.isPending}
              >
                {editingEvent ? "Update Event" : "Save Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={eventToDelete !== null}
        onOpenChange={(open) => !open && setEventToDelete(null)}
        title="Delete Event"
        description="Are you sure you want to delete this event? This action will remove all upcoming reminders for this event."
        confirmText="Delete Event"
        variant="destructive"
        loading={deleteEventMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
