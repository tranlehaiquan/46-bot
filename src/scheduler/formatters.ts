import type { DueReminder, EventRow, UpcomingEvent } from "../db/repositories/events.js";
import { formatUtc7DateStr, getUtc7Parts } from "../db/repositories/events.js";
import type { UpcomingHoliday } from "../holidays/index.js";

export type MorningBriefingInput = {
  todayEvents: UpcomingEvent[];
  todayHolidays: UpcomingHoliday[];
  upcomingMilestones: UpcomingEvent[];
  referenceDate?: Date;
};

export type WeeklyOutlookInput = {
  weekEvents: UpcomingEvent[];
  weekHolidays: UpcomingHoliday[];
  referenceDate?: Date;
};

function formatDisplayDate(date: Date): string {
  const parts = getUtc7Parts(date);
  const dd = String(parts.day).padStart(2, "0");
  const mm = String(parts.month).padStart(2, "0");
  return `${dd}/${mm}/${parts.year}`;
}

function formatShortDate(date: Date): string {
  const parts = getUtc7Parts(date);
  const dd = String(parts.day).padStart(2, "0");
  const mm = String(parts.month).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function formatMorningBriefing(input: MorningBriefingInput): string | null {
  const { todayEvents, todayHolidays, upcomingMilestones, referenceDate = new Date() } = input;

  if (todayEvents.length === 0 && todayHolidays.length === 0 && upcomingMilestones.length === 0) {
    return null;
  }

  const todayStr = formatDisplayDate(referenceDate);
  const lines: string[] = [`☀️ Chào buổi sáng gia đình! Hôm nay (${todayStr}):`];

  if (todayHolidays.length > 0) {
    lines.push("");
    lines.push("🇻🇳 Hôm nay là ngày lễ:");
    for (const h of todayHolidays) {
      const leaveText = h.daysOfLeave ? ` (Nghỉ ${h.daysOfLeave} ngày)` : "";
      lines.push(`• ${h.name}${leaveText}`);
    }
  }

  if (todayEvents.length > 0) {
    lines.push("");
    lines.push("🎉 Sự kiện hôm nay:");
    for (const item of todayEvents) {
      const calNote = item.event.calendar === "lunar" ? " (Âm lịch)" : "";
      const noteStr = item.event.notes ? ` - ${item.event.notes}` : "";
      lines.push(`• ${item.event.title}${calNote}${noteStr}`);
    }
  }

  if (upcomingMilestones.length > 0) {
    lines.push("");
    lines.push("🗓️ Sắp tới trong 7 ngày:");
    for (const item of upcomingMilestones) {
      const daysText = item.daysRemaining === 1 ? "ngày mai" : `sau ${item.daysRemaining} ngày nữa`;
      const dateText = formatShortDate(item.occurrenceDate);
      const calNote = item.event.calendar === "lunar" ? " (ÂL)" : "";
      lines.push(`• ${item.event.title}${calNote}: ${daysText} (${dateText})`);
    }
  }

  lines.push("");
  lines.push("Chúc cả nhà một ngày mới vui vẻ và an lành! ❤️");

  return lines.join("\n");
}

export function formatWeeklyOutlook(input: WeeklyOutlookInput): string | null {
  const { weekEvents, weekHolidays, referenceDate = new Date() } = input;

  if (weekEvents.length === 0 && weekHolidays.length === 0) {
    return null;
  }

  const lines: string[] = ["📋 Điểm tin tuần mới cho cả nhà:"];

  if (weekHolidays.length > 0) {
    lines.push("");
    lines.push("🇻🇳 Ngày lễ trong tuần:");
    for (const h of weekHolidays) {
      const dateText = formatShortDate(h.occurrenceDate);
      const leaveText = h.daysOfLeave ? ` (Nghỉ ${h.daysOfLeave} ngày)` : "";
      lines.push(`• ${dateText}: ${h.name}${leaveText}`);
    }
  }

  if (weekEvents.length > 0) {
    lines.push("");
    lines.push("🗓️ Lịch sự kiện gia đình tuần này:");
    for (const item of weekEvents) {
      const dateText = formatShortDate(item.occurrenceDate);
      const calNote = item.event.calendar === "lunar" ? " (Âm lịch)" : "";
      const noteStr = item.event.notes ? ` - ${item.event.notes}` : "";
      lines.push(`• ${dateText}: ${item.event.title}${calNote}${noteStr}`);
    }
  }

  lines.push("");
  lines.push("Chúc cả nhà một tuần mới làm việc và học tập hiệu quả! 💪");

  return lines.join("\n");
}

export function formatEventReminder(due: DueReminder): string {
  const { event, occurrenceDate, daysRemaining, isAdvanceNotice } = due;
  const dateStr = formatShortDate(occurrenceDate);
  const calNote = event.calendar === "lunar" ? " (Âm lịch)" : "";
  const noteStr = event.notes ? `\n📝 Ghi chú: ${event.notes}` : "";

  if (isAdvanceNotice && daysRemaining > 0) {
    const daysLabel = daysRemaining === 1 ? "ngày mai" : `còn ${daysRemaining} ngày nữa`;
    return `⏰ Nhắc trước: ${daysLabel} (${dateStr}) là đến "${event.title}"${calNote}!${noteStr}`;
  }

  return `🔔 Nhắc nhở hôm nay (${dateStr}): "${event.title}"${calNote}!${noteStr}`;
}
