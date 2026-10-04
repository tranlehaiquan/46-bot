import React, { useState, useEffect } from "react";
import { CalendarDays, Filter } from "lucide-react";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { api, type HolidayOccurrence, type CalendarEventOccurrence, type Channel } from "../api";

export function CalendarPage({ channels }: { channels: Channel[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [holidays, setHolidays] = useState<HolidayOccurrence[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEventOccurrence[]>([]);
  const [loading, setLoading] = useState(false);

  const [showHolidays, setShowHolidays] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>("all");

  // Fetch holidays whenever year changes
  useEffect(() => {
    api.getHolidays(year).then(setHolidays).catch(console.error);
  }, [year]);

  // Fetch events whenever year/month changes
  useEffect(() => {
    setLoading(true);
    api
      .getCalendarEvents(year, month)
      .then(setAllEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year, month]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // Filter holidays to current month
  const filteredHolidays: HolidayOccurrence[] = showHolidays
    ? holidays.filter((h) => {
        const [hy, hm] = h.occurrenceDateStr.split("-").map(Number);
        return hy === year && hm === month;
      })
    : [];

  // Filter events by selected channel
  const filteredEvents: CalendarEventOccurrence[] =
    channelFilter === "all"
      ? allEvents
      : allEvents.filter((e) => e.chatId === channelFilter);

  return (
    <div className="glass-panel p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <CalendarDays size={22} className="text-indigo-400" />
          <h2 className="text-xl font-bold text-white">Global Calendar</h2>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Holiday toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300 select-none">
            <input
              type="checkbox"
              checked={showHolidays}
              onChange={(e) => setShowHolidays(e.target.checked)}
              className="accent-indigo-500 rounded"
            />
            <span>🇻🇳 Vietnam Holidays</span>
          </label>

          {/* Channel filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-slate-400" />
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="form-input w-auto text-xs py-1.5 px-3"
            >
              <option value="all">All Channels</option>
              {channels.map((c) => (
                <option key={c.chatId} value={c.chatId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {loading && (
            <span className="text-xs text-slate-400">Loading…</span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 text-rose-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/30 inline-block border border-rose-500/40" />
          <span>Public Holiday</span>
        </div>
        <div className="flex items-center gap-1.5 text-purple-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-purple-500/30 inline-block border border-purple-500/40" />
          <span>Cultural Observance</span>
        </div>
        <div className="flex items-center gap-1.5 text-indigo-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/30 inline-block border border-indigo-500/40" />
          <span>Channel Event</span>
        </div>
      </div>

      {/* Calendar grid */}
      <CalendarMonthGrid
        year={year}
        month={month}
        holidays={filteredHolidays}
        events={filteredEvents}
        showChannelLabels={true}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />
    </div>
  );
}
