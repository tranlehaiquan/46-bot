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
    <div className="glass-panel" style={{ padding: "1.5rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <CalendarDays size={22} color="var(--accent-primary)" />
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Global Calendar</h2>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {/* Holiday toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              cursor: "pointer",
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={showHolidays}
              onChange={(e) => setShowHolidays(e.target.checked)}
              style={{ accentColor: "var(--accent-primary)" }}
            />
            🇻🇳 Vietnam Holidays
          </label>

          {/* Channel filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Filter size={14} color="var(--text-muted)" />
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="form-input"
              style={{ width: "auto", fontSize: "0.82rem", padding: "0.35rem 0.65rem" }}
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
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Loading…</span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#f87171" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(239,68,68,0.3)", display: "inline-block" }} />
          Public Holiday
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#c084fc" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(167,139,250,0.3)", display: "inline-block" }} />
          Cultural Observance
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--accent-primary)" }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(99,102,241,0.3)", display: "inline-block" }} />
          Channel Event
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
