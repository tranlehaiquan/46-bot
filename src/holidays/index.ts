import { lunarToSolar } from "../lunar/index.js";
import {
  createUtc7Date,
  diffDays,
  formatUtc7DateStr,
  getUtc7Parts,
} from "../db/repositories/events.js";

export type HolidayDefinition = {
  id: string;
  name: string;
  calendar: "solar" | "lunar";
  day: number;
  month: number;
  daysOfLeave?: number;
  isPublicHoliday: boolean;
  description?: string;
};

export const VIETNAMESE_HOLIDAYS: HolidayDefinition[] = [
  // 1. Official Public Paid Holidays (Điều 112 Bộ luật Lao động 2019)
  {
    id: "tet-duong-lich",
    name: "Tết Dương lịch",
    calendar: "solar",
    day: 1,
    month: 1,
    daysOfLeave: 1,
    isPublicHoliday: true,
    description: "Nghỉ 1 ngày (01/01 Dương lịch)",
  },
  {
    id: "tet-nguyen-dan",
    name: "Tết Nguyên Đán",
    calendar: "lunar",
    day: 1,
    month: 1,
    daysOfLeave: 5,
    isPublicHoliday: true,
    description: "Nghỉ 5 ngày (từ 29 hoặc 30 tháng Chạp đến hết mùng 4 hoặc 5 tháng Giêng)",
  },
  {
    id: "gio-to-hung-vuong",
    name: "Giỗ Tổ Hùng Vương",
    calendar: "lunar",
    day: 10,
    month: 3,
    daysOfLeave: 1,
    isPublicHoliday: true,
    description: "Nghỉ 1 ngày (10/03 Âm lịch)",
  },
  {
    id: "ngay-chien-thang",
    name: "Ngày Chiến thắng (30/4)",
    calendar: "solar",
    day: 30,
    month: 4,
    daysOfLeave: 1,
    isPublicHoliday: true,
    description: "Nghỉ 1 ngày (30/04 Dương lịch)",
  },
  {
    id: "quoc-te-lao-dong",
    name: "Ngày Quốc tế Lao động (1/5)",
    calendar: "solar",
    day: 1,
    month: 5,
    daysOfLeave: 1,
    isPublicHoliday: true,
    description: "Nghỉ 1 ngày (01/05 Dương lịch)",
  },
  {
    id: "quoc-khanh",
    name: "Ngày Quốc khánh (2/9)",
    calendar: "solar",
    day: 2,
    month: 9,
    daysOfLeave: 2,
    isPublicHoliday: true,
    description: "Nghỉ 2 ngày (ngày 02/09 và 01 ngày liền kề)",
  },
  {
    id: "ngay-van-hoa-viet-nam",
    name: "Ngày Văn hóa Việt Nam (24/11)",
    calendar: "solar",
    day: 24,
    month: 11,
    daysOfLeave: 1,
    isPublicHoliday: true,
    description: "Nghỉ 1 ngày (24/11 Dương lịch, chính thức từ năm 2026)",
  },

  // 2. Traditional Lunar Cultural Festivals & Family Observational Days
  {
    id: "ong-tao",
    name: "Lễ cúng Ông Công Ông Táo",
    calendar: "lunar",
    day: 23,
    month: 12,
    isPublicHoliday: false,
    description: "23 tháng Chạp Âm lịch",
  },
  {
    id: "giao-thua",
    name: "Đêm Giao thừa (Tất niên)",
    calendar: "lunar",
    day: 30,
    month: 12,
    isPublicHoliday: false,
    description: "Đêm 29 hoặc 30 tháng Chạp Âm lịch",
  },
  {
    id: "ram-thang-gieng",
    name: "Tết Nguyên Tiêu (Rằm tháng Giêng)",
    calendar: "lunar",
    day: 15,
    month: 1,
    isPublicHoliday: false,
    description: "15/01 Âm lịch",
  },
  {
    id: "quoc-te-phu-nu",
    name: "Ngày Quốc tế Phụ nữ (8/3)",
    calendar: "solar",
    day: 8,
    month: 3,
    isPublicHoliday: false,
    description: "08/03 Dương lịch",
  },
  {
    id: "tet-doan-ngo",
    name: "Tết Đoan Ngọ",
    calendar: "lunar",
    day: 5,
    month: 5,
    isPublicHoliday: false,
    description: "05/05 Âm lịch",
  },
  {
    id: "quoc-te-thieu-nhi",
    name: "Ngày Quốc tế Thiếu nhi (1/6)",
    calendar: "solar",
    day: 1,
    month: 6,
    isPublicHoliday: false,
    description: "01/06 Dương lịch",
  },
  {
    id: "ngay-gia-dinh-viet-nam",
    name: "Ngày Gia đình Việt Nam (28/6)",
    calendar: "solar",
    day: 28,
    month: 6,
    isPublicHoliday: false,
    description: "28/06 Dương lịch",
  },
  {
    id: "le-vu-lan",
    name: "Lễ Vu Lan (Báo hiếu)",
    calendar: "lunar",
    day: 15,
    month: 7,
    isPublicHoliday: false,
    description: "15/07 Âm lịch",
  },
  {
    id: "tet-trung-thu",
    name: "Tết Trung Thu",
    calendar: "lunar",
    day: 15,
    month: 8,
    isPublicHoliday: false,
    description: "15/08 Âm lịch",
  },
  {
    id: "phu-nu-viet-nam",
    name: "Ngày Phụ nữ Việt Nam (20/10)",
    calendar: "solar",
    day: 20,
    month: 10,
    isPublicHoliday: false,
    description: "20/10 Dương lịch",
  },
  {
    id: "nha-giao-viet-nam",
    name: "Ngày Nhà giáo Việt Nam (20/11)",
    calendar: "solar",
    day: 20,
    month: 11,
    isPublicHoliday: false,
    description: "20/11 Dương lịch",
  },
];

export type UpcomingHoliday = {
  id: string;
  name: string;
  calendar: "solar" | "lunar";
  originalDate: string;
  occurrenceDate: Date;
  occurrenceDateStr: string;
  daysRemaining: number;
  daysOfLeave?: number;
  isPublicHoliday: boolean;
  description?: string;
};

export type GetUpcomingHolidaysOptions = {
  windowDays?: number;
  publicOnly?: boolean;
  referenceDate?: Date;
};

/**
 * Calculates the next occurrence of a given holiday relative to a reference date.
 */
export function getNextHolidayOccurrence(
  holiday: HolidayDefinition,
  referenceDate: Date = new Date(),
): { date: Date; dateStr: string; daysRemaining: number } {
  const refParts = getUtc7Parts(referenceDate);

  if (holiday.calendar === "lunar") {
    const candidateYears = [
      refParts.year - 1,
      refParts.year,
      refParts.year + 1,
      refParts.year + 2,
    ];

    let bestOccurrence: { date: Date; dateStr: string; daysRemaining: number } | null = null;

    for (const candYear of candidateYears) {
      const solar = lunarToSolar(holiday.day, holiday.month, candYear, false);
      const targetDate = createUtc7Date(solar.year, solar.month, solar.day);
      const days = diffDays(targetDate, referenceDate);
      if (days >= 0) {
        if (!bestOccurrence || days < bestOccurrence.daysRemaining) {
          bestOccurrence = {
            date: targetDate,
            dateStr: formatUtc7DateStr(targetDate),
            daysRemaining: days,
          };
        }
      }
    }

    if (bestOccurrence) {
      return bestOccurrence;
    }
  }

  // Solar holiday
  const targetThisYear = createUtc7Date(refParts.year, holiday.month, holiday.day);
  const daysThisYear = diffDays(targetThisYear, referenceDate);
  if (daysThisYear >= 0) {
    return {
      date: targetThisYear,
      dateStr: formatUtc7DateStr(targetThisYear),
      daysRemaining: daysThisYear,
    };
  }

  const targetNextYear = createUtc7Date(refParts.year + 1, holiday.month, holiday.day);
  const daysNextYear = diffDays(targetNextYear, referenceDate);
  return {
    date: targetNextYear,
    dateStr: formatUtc7DateStr(targetNextYear),
    daysRemaining: daysNextYear,
  };
}

/**
 * Retrieves upcoming holidays within the specified day window, sorted chronologically.
 */
export function getUpcomingHolidays(
  options: GetUpcomingHolidaysOptions = {},
): UpcomingHoliday[] {
  const { windowDays = 365, publicOnly = false, referenceDate = new Date() } = options;

  const results: UpcomingHoliday[] = [];

  for (const holiday of VIETNAMESE_HOLIDAYS) {
    if (publicOnly && !holiday.isPublicHoliday) {
      continue;
    }

    const occ = getNextHolidayOccurrence(holiday, referenceDate);
    if (occ.daysRemaining <= windowDays) {
      const calLabel = holiday.calendar === "lunar" ? "Âm lịch" : "Dương lịch";
      const originalDate = `${holiday.day}/${holiday.month} (${calLabel})`;

      results.push({
        id: holiday.id,
        name: holiday.name,
        calendar: holiday.calendar,
        originalDate,
        occurrenceDate: occ.date,
        occurrenceDateStr: occ.dateStr,
        daysRemaining: occ.daysRemaining,
        daysOfLeave: holiday.daysOfLeave,
        isPublicHoliday: holiday.isPublicHoliday,
        description: holiday.description,
      });
    }
  }

  // Sort chronologically by remaining days ASC
  results.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return results;
}
