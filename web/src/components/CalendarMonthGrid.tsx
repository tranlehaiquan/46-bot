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
  const bg = isPublic ? "rgba(239, 68, 68, 0.18)" : "rgba(167, 139, 250, 0.18)";
  const color = isPublic ? "#f87171" : "#c084fc";
  const border = isPublic ? "rgba(239, 68, 68, 0.35)" : "rgba(167, 139, 250, 0.35)";

  return (
    <div
      title={`${holiday.name}${holiday.description ? " — " + holiday.description : ""}`}
      style={{
        background: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: "4px",
        fontSize: "0.65rem",
        fontWeight: 600,
        padding: "1px 5px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        cursor: "default",
        lineHeight: 1.4,
      }}
    >
      {isPublic ? "🇻🇳 " : "🌸 "}
      {holiday.name}
    </div>
  );
}

function EventBadge({
  ev,
  showChannelLabel,
}: {
  ev: CalendarEventOccurrence;
  showChannelLabel: boolean;
}) {
  const emoji = KIND_EMOJI[ev.kind] ?? "📌";
  return (
    <div
      title={`${ev.title}${showChannelLabel ? ` [${ev.channelName}]` : ""}`}
      style={{
        background: "rgba(99, 102, 241, 0.15)",
        color: "var(--accent-primary)",
        border: "1px solid rgba(99, 102, 241, 0.3)",
        borderRadius: "4px",
        fontSize: "0.65rem",
        fontWeight: 600,
        padding: "1px 5px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        cursor: "default",
        lineHeight: 1.4,
      }}
    >
      {emoji} {ev.title}
      {showChannelLabel && (
        <span style={{ opacity: 0.7, marginLeft: "3px" }}>· {ev.channelName}</span>
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
}: {
  day: number;
  year: number;
  month: number;
  entries: CalendarEntry[];
  showChannelLabels: boolean;
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
    ...events.map((e) => <EventBadge key={`e-${e.eventId}`} ev={e} showChannelLabel={showChannelLabels} />),
  ];
  const visibleBadges = allBadges.slice(0, 3);
  const overflow = allBadges.length - 3;

  return (
    <div
      style={{
        minHeight: "90px",
        padding: "6px",
        background: isToday
          ? "rgba(99, 102, 241, 0.1)"
          : "rgba(255,255,255,0.01)",
        border: isToday
          ? "1px solid rgba(99, 102, 241, 0.4)"
          : "1px solid rgba(255,255,255,0.04)",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "3px",
      }}
    >
      {/* Day number */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span
          style={{
            fontSize: "0.9rem",
            fontWeight: isToday ? 700 : 500,
            color: isToday ? "var(--accent-primary)" : "var(--text-primary)",
            lineHeight: 1,
          }}
        >
          {day}
        </span>
        {lunarLabel && (
          <span style={{ fontSize: "0.58rem", color: "var(--text-muted)", lineHeight: 1 }}>
            {lunarLabel}
          </span>
        )}
      </div>

      {/* Badges */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {visibleBadges}
        {overflow > 0 && (
          <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", paddingLeft: "2px" }}>
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
}: {
  year: number;
  month: number;
  holidays: HolidayOccurrence[];
  events: CalendarEventOccurrence[];
  showChannelLabels: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <button
          onClick={onPrevMonth}
          className="btn btn-secondary"
          style={{ padding: "0.35rem 0.65rem" }}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>

        <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>
          {MONTH_NAMES[month - 1]} {year}
        </span>

        <button
          onClick={onNextMonth}
          className="btn btn-secondary"
          style={{ padding: "0.35rem 0.65rem" }}
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          marginBottom: "4px",
        }}
      >
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--text-muted)",
              padding: "4px 0",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
        }}
      >
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} style={{ minHeight: "90px" }} />;
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
            />
          );
        })}
      </div>
    </div>
  );
}
