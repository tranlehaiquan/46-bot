import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  type EventOccurrence,
  getUtc7Parts,
  formatUtc7DateStr,
} from "../db/repositories/events.js";
import { getEventsImageDir } from "../server.js";

export type CalendarScope = "week" | "month" | "year";

export type RenderCalendarImageOptions = {
  scope: CalendarScope;
  chatId: string;
  title?: string;
  subtitle?: string;
  events: EventOccurrence[];
  startDate: Date;
  endDate: Date;
  referenceDate?: Date;
};

const FONT_FAMILY = "'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";

const VIETNAMESE_DAYS = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

const VIETNAMESE_DAYS_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const KIND_METADATA: Record<
  string,
  { label: string; dot: string; bg: string; text: string }
> = {
  birthday: { label: "Sinh nhật", dot: "#f43f5e", bg: "#be123c", text: "#ffe4e6" },
  gio: { label: "Giỗ", dot: "#f59e0b", bg: "#b45309", text: "#fef3c7" },
  anniversary: { label: "Kỷ niệm", dot: "#ec4899", bg: "#a21caf", text: "#fae8ff" },
  appointment: { label: "Lịch hẹn", dot: "#60a5fa", bg: "#1d4ed8", text: "#dbeafe" },
  reminder: { label: "Nhắc nhở", dot: "#34d399", bg: "#047857", text: "#d1fae5" },
  event: { label: "Sự kiện", dot: "#a78bfa", bg: "#6d28d9", text: "#ede9fe" },
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getKindMeta(kind: string) {
  return (
    KIND_METADATA[kind] ?? {
      label: kind,
      dot: "#94a3b8",
      bg: "#475569",
      text: "#f1f5f9",
    }
  );
}

/**
 * Generate weekly SVG layout (Monday to Sunday cards)
 */
function renderWeekSvg(options: RenderCalendarImageOptions): string {
  const width = 850;
  const startMid = Date.UTC(
    getUtc7Parts(options.startDate).year,
    getUtc7Parts(options.startDate).month - 1,
    getUtc7Parts(options.startDate).day,
  );

  // Group events by occurrence date string YYYY-MM-DD
  const eventsByDate = new Map<string, EventOccurrence[]>();
  for (const occ of options.events) {
    const list = eventsByDate.get(occ.occurrenceDateStr) ?? [];
    list.push(occ);
    eventsByDate.set(occ.occurrenceDateStr, list);
  }

  // 7 days from start date
  const dayCards: Array<{
    dateStr: string;
    solarText: string;
    dowText: string;
    lunarText: string;
    isWeekend: boolean;
    events: EventOccurrence[];
  }> = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startMid + i * 24 * 60 * 60 * 1000);
    const parts = getUtc7Parts(d);
    const dateStr = formatUtc7DateStr(d);
    const dow = (parts.day - 1 + 7) % 7; // rough
    const actualDow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
    const dayEvents = eventsByDate.get(dateStr) ?? [];

    let lunarText = "";
    if (dayEvents.length > 0) {
      const first = dayEvents[0]!;
      lunarText = `ÂL: ${first.lunarDay}/${first.lunarMonth}${first.isLunarLeap ? " (nhuận)" : ""}`;
    }

    dayCards.push({
      dateStr,
      solarText: `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`,
      dowText: VIETNAMESE_DAYS[actualDow] ?? `T${actualDow + 1}`,
      lunarText,
      isWeekend: actualDow === 0 || actualDow === 6,
      events: dayEvents,
    });
  }

  // Calculate dynamic height based on event counts
  let contentSvg = "";
  let y = 140;

  for (const card of dayCards) {
    const hasEvents = card.events.length > 0;
    const cardHeight = hasEvents ? 40 + card.events.length * 36 : 48;
    const bgFill = card.isWeekend ? "#1e293b" : "#0f172a";
    const borderStroke = hasEvents ? "#38bdf8" : "#334155";
    const dowColor = card.isWeekend ? "#f43f5e" : "#38bdf8";

    contentSvg += `
      <g transform="translate(40, ${y})">
        <rect width="770" height="${cardHeight}" rx="10" fill="${bgFill}" stroke="${borderStroke}" stroke-width="${hasEvents ? "1.5" : "1"}" />
        <text x="20" y="30" font-family="${FONT_FAMILY}" font-size="15" font-weight="700" fill="${dowColor}">${escapeXml(card.dowText)}</text>
        <text x="120" y="30" font-family="${FONT_FAMILY}" font-size="15" font-weight="600" fill="#f8fafc">${escapeXml(card.solarText)}</text>
        ${card.lunarText ? `<text x="180" y="30" font-family="${FONT_FAMILY}" font-size="13" font-weight="400" fill="#94a3b8">${escapeXml(card.lunarText)}</text>` : ""}
    `;

    if (!hasEvents) {
      contentSvg += `
        <text x="320" y="30" font-family="${FONT_FAMILY}" font-size="13" font-style="italic" fill="#64748b">Không có sự kiện</text>
      `;
    } else {
      let eventY = 54;
      for (const ev of card.events) {
        const meta = getKindMeta(ev.event.kind);
        const title = escapeXml(ev.event.title);
        const note = ev.event.notes ? ` - ${escapeXml(ev.event.notes)}` : "";
        contentSvg += `
          <g transform="translate(20, ${eventY - 18})">
            <rect width="84" height="22" rx="4" fill="${meta.bg}" />
            <circle cx="10" cy="11" r="3.5" fill="${meta.dot}" />
            <text x="18" y="15" font-family="${FONT_FAMILY}" font-size="11" font-weight="600" fill="${meta.text}">${escapeXml(meta.label)}</text>
            <text x="96" y="16" font-family="${FONT_FAMILY}" font-size="14" font-weight="500" fill="#f1f5f9">${title}<tspan fill="#94a3b8" font-size="12">${note}</tspan></text>
          </g>
        `;
        eventY += 34;
      }
    }

    contentSvg += `</g>`;
    y += cardHeight + 12;
  }

  const totalHeight = y + 40;
  const title = options.title ?? "LỊCH SỰ KIỆN TUẦN";
  const startP = getUtc7Parts(options.startDate);
  const endP = getUtc7Parts(options.endDate);
  const subtitle =
    options.subtitle ??
    `Từ ngày ${startP.day}/${startP.month}/${startP.year} đến ngày ${endP.day}/${endP.month}/${endP.year}`;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#090d16"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${totalHeight}" fill="url(#bg)"/>
      <g transform="translate(40, 45)">
        <text x="0" y="25" font-family="${FONT_FAMILY}" font-size="24" font-weight="800" fill="#f8fafc" letter-spacing="0.5">${escapeXml(title)}</text>
        <text x="0" y="52" font-family="${FONT_FAMILY}" font-size="14" font-weight="400" fill="#38bdf8">${escapeXml(subtitle)}</text>
        <text x="${width - 80}" y="35" text-anchor="end" font-family="${FONT_FAMILY}" font-size="13" font-weight="600" fill="#a855f7">Tổng cộng: ${options.events.length} sự kiện</text>
      </g>
      ${contentSvg}
    </svg>
  `;
}

/**
 * Generate monthly SVG layout
 */
function renderMonthSvg(options: RenderCalendarImageOptions): string {
  const width = 850;
  const events = options.events;
  const parts = getUtc7Parts(options.startDate);
  const month = parts.month;
  const year = parts.year;
  const title = options.title ?? `LỊCH SỰ KIỆN THÁNG ${month}/${year}`;
  const subtitle = options.subtitle ?? `Danh sách sự kiện, sinh nhật, giỗ chạp trong tháng ${month}`;

  let y = 140;
  let contentSvg = "";

  if (events.length === 0) {
    const emptyHeight = 120;
    contentSvg = `
      <g transform="translate(40, ${y})">
        <rect width="770" height="${emptyHeight}" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <g transform="translate(365, 25)">
          <rect x="0" y="0" width="40" height="36" rx="6" fill="#334155" stroke="#38bdf8" stroke-width="2"/>
          <rect x="0" y="0" width="40" height="10" rx="4" fill="#38bdf8"/>
          <circle cx="10" cy="5" r="2" fill="#0f172a"/>
          <circle cx="30" cy="5" r="2" fill="#0f172a"/>
        </g>
        <text x="385" y="90" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="15" fill="#94a3b8">Không có sự kiện hoặc nhắc nhở nào trong tháng ${month}/${year}</text>
      </g>
    `;
    y += emptyHeight + 30;
  } else {
    // Group occurrences by day
    const dayGroups = new Map<number, EventOccurrence[]>();
    for (const ev of events) {
      const list = dayGroups.get(ev.solarDay) ?? [];
      list.push(ev);
      dayGroups.set(ev.solarDay, list);
    }

    const sortedDays = Array.from(dayGroups.keys()).sort((a, b) => a - b);

    for (const day of sortedDays) {
      const dayEvents = dayGroups.get(day)!;
      const first = dayEvents[0]!;
      const dowText = VIETNAMESE_DAYS[first.dayOfWeek] ?? "";
      const cardHeight = 36 + dayEvents.length * 36;

      contentSvg += `
        <g transform="translate(40, ${y})">
          <rect width="770" height="${cardHeight}" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1"/>
          <!-- Day badge -->
          <rect x="15" y="12" width="60" height="${cardHeight - 24}" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="45" y="${Math.floor(cardHeight / 2) - 2}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="18" font-weight="800" fill="#f8fafc">${String(day).padStart(2, "0")}</text>
          <text x="45" y="${Math.floor(cardHeight / 2) + 14}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="11" font-weight="600" fill="#38bdf8">${escapeXml(dowText)}</text>
      `;

      let eventY = 28;
      for (const ev of dayEvents) {
        const meta = getKindMeta(ev.event.kind);
        const title = escapeXml(ev.event.title);
        const note = ev.event.notes ? ` (${escapeXml(ev.event.notes)})` : "";
        const calLabel =
          ev.event.calendar === "lunar"
            ? `ÂL: ${ev.lunarDay}/${ev.lunarMonth}${ev.isLunarLeap ? " (nhuận)" : ""}`
            : "";

        contentSvg += `
          <g transform="translate(90, ${eventY - 14})">
            <rect width="80" height="22" rx="4" fill="${meta.bg}" />
            <circle cx="10" cy="11" r="3.5" fill="${meta.dot}" />
            <text x="18" y="15" font-family="${FONT_FAMILY}" font-size="11" font-weight="600" fill="${meta.text}">${escapeXml(meta.label)}</text>
            <text x="92" y="16" font-family="${FONT_FAMILY}" font-size="14" font-weight="500" fill="#f8fafc">${title}<tspan fill="#94a3b8" font-size="12">${note}</tspan></text>
            ${calLabel ? `<text x="660" y="16" text-anchor="end" font-family="${FONT_FAMILY}" font-size="12" font-weight="500" fill="#fbbf24">${escapeXml(calLabel)}</text>` : ""}
          </g>
        `;
        eventY += 34;
      }

      contentSvg += `</g>`;
      y += cardHeight + 12;
    }
  }

  const totalHeight = y + 40;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#090d16"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${totalHeight}" fill="url(#bg)"/>
      <g transform="translate(40, 45)">
        <text x="0" y="25" font-family="${FONT_FAMILY}" font-size="24" font-weight="800" fill="#f8fafc" letter-spacing="0.5">${escapeXml(title)}</text>
        <text x="0" y="52" font-family="${FONT_FAMILY}" font-size="14" font-weight="400" fill="#38bdf8">${escapeXml(subtitle)}</text>
        <text x="${width - 80}" y="35" text-anchor="end" font-family="${FONT_FAMILY}" font-size="13" font-weight="600" fill="#a855f7">Tổng cộng: ${events.length} sự kiện</text>
      </g>
      ${contentSvg}
    </svg>
  `;
}

/**
 * Generate yearly SVG layout
 */
function renderYearSvg(options: RenderCalendarImageOptions): string {
  const width = 900;
  const events = options.events;
  const year = getUtc7Parts(options.startDate).year;
  const title = options.title ?? `TỔNG HỢP SỰ KIỆN NĂM ${year}`;
  const subtitle = options.subtitle ?? `Danh sách các sự kiện quan trọng trong cả năm ${year}`;

  let y = 140;
  let contentSvg = "";

  // Group events by month (1..12)
  const monthGroups = new Map<number, EventOccurrence[]>();
  for (const ev of events) {
    const list = monthGroups.get(ev.solarMonth) ?? [];
    list.push(ev);
    monthGroups.set(ev.solarMonth, list);
  }

  for (let m = 1; m <= 12; m++) {
    const mEvents = monthGroups.get(m) ?? [];
    const hasEvents = mEvents.length > 0;
    const cardHeight = hasEvents ? 36 + mEvents.length * 32 : 44;
    const bgFill = hasEvents ? "#1e293b" : "#0f172a";
    const strokeColor = hasEvents ? "#38bdf8" : "#334155";

    contentSvg += `
      <g transform="translate(40, ${y})">
        <rect width="820" height="${cardHeight}" rx="10" fill="${bgFill}" stroke="${strokeColor}" stroke-width="${hasEvents ? "1.5" : "1"}"/>
        <text x="20" y="28" font-family="${FONT_FAMILY}" font-size="15" font-weight="700" fill="#38bdf8">THÁNG ${m}</text>
    `;

    if (!hasEvents) {
      contentSvg += `
        <text x="140" y="28" font-family="${FONT_FAMILY}" font-size="13" font-style="italic" fill="#64748b">Không có sự kiện</text>
      `;
    } else {
      let evY = 32;
      for (const ev of mEvents) {
        const meta = getKindMeta(ev.event.kind);
        const title = escapeXml(ev.event.title);
        const dateStr = `${String(ev.solarDay).padStart(2, "0")}/${String(ev.solarMonth).padStart(2, "0")}`;
        const calLabel =
          ev.event.calendar === "lunar"
            ? ` (ÂL: ${ev.lunarDay}/${ev.lunarMonth})`
            : "";

        contentSvg += `
          <g transform="translate(130, ${evY - 14})">
            <text x="0" y="15" font-family="${FONT_FAMILY}" font-size="13" font-weight="600" fill="#f8fafc">${dateStr}</text>
            <rect x="55" y="1" width="76" height="20" rx="4" fill="${meta.bg}"/>
            <circle cx="65" cy="11" r="3" fill="${meta.dot}" />
            <text x="73" y="15" font-family="${FONT_FAMILY}" font-size="10" font-weight="600" fill="${meta.text}">${escapeXml(meta.label)}</text>
            <text x="142" y="15" font-family="${FONT_FAMILY}" font-size="13" font-weight="500" fill="#f1f5f9">${title}<tspan fill="#fbbf24" font-size="11">${escapeXml(calLabel)}</tspan></text>
          </g>
        `;
        evY += 30;
      }
    }

    contentSvg += `</g>`;
    y += cardHeight + 10;
  }

  const totalHeight = y + 40;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#090d16"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${totalHeight}" fill="url(#bg)"/>
      <g transform="translate(40, 45)">
        <text x="0" y="25" font-family="${FONT_FAMILY}" font-size="24" font-weight="800" fill="#f8fafc" letter-spacing="0.5">${escapeXml(title)}</text>
        <text x="0" y="52" font-family="${FONT_FAMILY}" font-size="14" font-weight="400" fill="#38bdf8">${escapeXml(subtitle)}</text>
        <text x="${width - 80}" y="35" text-anchor="end" font-family="${FONT_FAMILY}" font-size="13" font-weight="600" fill="#a855f7">Tổng cộng: ${events.length} sự kiện</text>
      </g>
      ${contentSvg}
    </svg>
  `;
}

/**
 * Generates an SVG string representing the calendar graphic for the given scope
 */
export function generateCalendarSvg(options: RenderCalendarImageOptions): string {
  let svg: string;
  switch (options.scope) {
    case "week":
      svg = renderWeekSvg(options);
      break;
    case "year":
      svg = renderYearSvg(options);
      break;
    case "month":
    default:
      svg = renderMonthSvg(options);
      break;
  }
  return svg.trim();
}

/**
 * Renders the calendar graphic as a PNG Buffer using sharp
 */
export async function renderCalendarPng(
  options: RenderCalendarImageOptions,
): Promise<Buffer> {
  const svg = generateCalendarSvg(options);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Renders and saves the calendar image to disk in the images/events directory
 */
export async function saveCalendarImage(
  options: RenderCalendarImageOptions & { outputDir?: string; filename?: string },
): Promise<{ filePath: string; filename: string; buffer: Buffer }> {
  const buffer = await renderCalendarPng(options);
  const dir = options.outputDir ?? getEventsImageDir(process.env.DB_PATH);
  await fs.mkdir(dir, { recursive: true });

  const safeChatId = options.chatId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename =
    options.filename ??
    `events_${safeChatId}_${options.scope}_${Date.now()}.png`;
  const filePath = path.join(dir, filename);

  await fs.writeFile(filePath, buffer);
  return { filePath, filename, buffer };
}
