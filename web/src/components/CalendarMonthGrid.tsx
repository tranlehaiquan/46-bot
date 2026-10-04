import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HolidayOccurrence, CalendarEventOccurrence } from "../api";

// ─── Types ───────────────────────────────────────────────────────────────────

type CalendarEntry =
  | ({ _type: "holiday" } & HolidayOccurrence)
  | ({ _type: "event" } & CalendarEventOccurrence);

export type { CalendarEntry };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month is 1-indexed here
}

function getFirstDayOfWeek(year: number, month: number): number {
  // 0=Sun, 1=Mon... We want Mon=0
  const d = new Date(year, month - 1, 1).getDay();
  return (d + 6) % 7; // shift so Mon=0, Sun=6
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const KIND_EMOJI: Record<string, string> = {
  birthday: "🎂",
  anniversary: "💍",
  gio: "🕯️",
  event: "📌",
  reminder: "🔔",
  appointment: "📅",
};

// ─── Badge Components ─────────────────────────────────────────────────────────

function HolidayBadge({ holiday }: { holiday: HolidayOccurrence }) {
  const isPublic = holiday.isPublicHoliday;

  return (
    <div
      title={`${holiday.name}${holiday.description ? " — " + holiday.description : ""}`}
      className={`rounded text-[10px] font-semibold px-1.5 py-0.5 truncate cursor-default leading-tight border ${
        isPublic
          ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
          : "bg-purple-500/20 text-purple-400 border-purple-500/40"
      }`}
    >
      {isPublic ? "🇻🇳 " : "🌸 "}
      {holiday.name}
    </div>
  );
}

function EventBadge({
  ev,
  showChannelLabel,
  onSelectEvent,
}: {
  ev: CalendarEventOccurrence;
  showChannelLabel: boolean;
  onSelectEvent?: (eventId: number) => void;
}) {
  const emoji = KIND_EMOJI[ev.kind] ?? "📌";
  return (
    <div
      title={`${ev.title}${showChannelLabel ? ` [${ev.channelName}]` : ""}`}
      onClick={(e) => {
        if (onSelectEvent) {
          e.stopPropagation();
          onSelectEvent(ev.eventId);
        }
      }}
      className={`bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 rounded text-[10px] font-semibold px-1.5 py-0.5 truncate leading-tight transition-colors ${
        onSelectEvent ? "cursor-pointer hover:bg-indigo-500/30 hover:border-indigo-500/50" : "cursor-default"
      }`}
    >
      {emoji} {ev.title}
      {showChannelLabel && (
        <span className="opacity-70 ml-1">· {ev.channelName}</span>
      )}
    </div>
  );
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

function DayCell({
  day,
  year,
  month,
  entries,
  showChannelLabels,
  onSelectEvent,
}: {
  day: number;
  year: number;
  month: number;
  entries: CalendarEntry[];
  showChannelLabels: boolean;
  onSelectEvent?: (eventId: number) => void;
}) {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const dateStr = `${year}-${mm}-${dd}`;
  const isToday = dateStr === todayStr();

  const holidays = entries.filter((e): e is { _type: "holiday" } & HolidayOccurrence => e._type === "holiday");
  const events = entries.filter((e): e is { _type: "event" } & CalendarEventOccurrence => e._type === "event");

  // Lunar date label: derived from holiday metadata (first lunar holiday on this day)
  const lunarLabel = holidays.find((h) => h.calendar === "lunar")?.originalDate ?? null;

  // Show max 3 badges, with overflow indicator
  const allBadges: React.ReactNode[] = [
    ...holidays.map((h) => <HolidayBadge key={`h-${h.id}`} holiday={h} />),
    ...events.map((e) => (
      <EventBadge
        key={`e-${e.eventId}`}
        ev={e}
        showChannelLabel={showChannelLabels}
        onSelectEvent={onSelectEvent}
      />
    )),
  ];
  const visibleBadges = allBadges.slice(0, 3);
  const overflow = allBadges.length - 3;

  return (
    <div
      className={`min-h-[90px] p-1.5 rounded-lg flex flex-col gap-1 border transition-colors ${
        isToday
          ? "bg-indigo-500/10 border-indigo-500/40"
          : "bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03]"
      }`}
    >
      {/* Day number */}
      <div className="flex justify-between items-start">
        <span
          className={`text-sm leading-none ${
            isToday ? "font-bold text-indigo-400" : "font-medium text-slate-200"
          }`}
        >
          {day}
        </span>
        {lunarLabel && (
          <span className="text-[10px] text-slate-500 leading-none">
            {lunarLabel}
          </span>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-col gap-1">
        {visibleBadges}
        {overflow > 0 && (
          <div className="text-[10px] text-slate-400 pl-0.5">
            +{overflow} more
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CalendarMonthGrid({
  year,
  month,
  holidays,
  events,
  showChannelLabels,
  onPrevMonth,
  onNextMonth,
  onSelectEvent,
}: {
  year: number;
  month: number;
  holidays: HolidayOccurrence[];
  events: CalendarEventOccurrence[];
  showChannelLabels: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectEvent?: (eventId: number) => void;
}) {
  // Build a map: dateStr -> CalendarEntry[]
  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();

    for (const h of holidays) {
      const key = h.occurrenceDateStr;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ _type: "holiday", ...h });
    }

    for (const e of events) {
      const key = e.occurrenceDateStr;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ _type: "event", ...e });
    }

    return map;
  }, [holidays, events]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfWeek(year, month); // Mon=0

  // Build grid: null = empty leading cell
  const cells: (number | null)[] = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete the last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Month Nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrevMonth}
          className="btn btn-secondary px-2.5 py-1.5"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="font-bold text-lg text-white">
          {MONTH_NAMES[month - 1]} {year}
        </span>

        <button
          onClick={onNextMonth}
          className="btn btn-secondary px-2.5 py-1.5"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-bold text-slate-500 py-1 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="min-h-[90px]" />;
          }
          const mm = String(month).padStart(2, "0");
          const dd = String(day).padStart(2, "0");
          const dateStr = `${year}-${mm}-${dd}`;
          const entries = entriesByDate.get(dateStr) ?? [];
          return (
            <DayCell
              key={dateStr}
              day={day}
              year={year}
              month={month}
              entries={entries}
              showChannelLabels={showChannelLabels}
              onSelectEvent={onSelectEvent}
            />
          );
        })}
      </div>
    </div>
  );
}
