import { tool } from "ai";
import { z } from "zod";
import type { EventsRepository } from "../db/repositories/events.js";
import { getUpcomingHolidays, VIETNAMESE_HOLIDAYS } from "../holidays/index.js";

export function createHolidayTools(
  eventsRepo?: EventsRepository,
  context?: { chatId: string; senderName: string },
) {
  const holiday_list_upcoming = tool({
    description:
      "Tra cứu các ngày lễ sắp tới của Việt Nam (bao gồm các ngày nghỉ lễ chính thức hưởng nguyên lương theo luật và các lễ hội truyền thống).",
    inputSchema: z.object({
      windowDays: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .default(365)
        .describe("Số ngày tới để tìm kiếm ngày lễ (mặc định 365 ngày)"),
      publicOnly: z
        .boolean()
        .optional()
        .default(false)
        .describe("true nếu chỉ muốn xem các ngày nghỉ lễ chính thức theo luật lao động"),
    }),
    execute: async ({ windowDays = 365, publicOnly = false }) => {
      const holidays = getUpcomingHolidays({
        windowDays,
        publicOnly,
        referenceDate: new Date(),
      });

      return {
        success: true,
        total: holidays.length,
        holidays: holidays.map((h) => ({
          id: h.id,
          name: h.name,
          calendar: h.calendar,
          originalDate: h.originalDate,
          occurrenceDate: h.occurrenceDateStr,
          daysRemaining: h.daysRemaining,
          daysOfLeave: h.daysOfLeave,
          isPublicHoliday: h.isPublicHoliday,
          description: h.description,
        })),
        message: `Tìm thấy ${holidays.length} ngày lễ trong ${windowDays} ngày tới.`,
      };
    },
  });

  const holiday_import = tool({
    description:
      "Tự động thêm các ngày nghỉ lễ chính thức hoặc lễ truyền thống của Việt Nam vào lịch sự kiện của nhóm chat.",
    inputSchema: z.object({
      includeTraditional: z
        .boolean()
        .optional()
        .default(false)
        .describe("true để thêm cả các ngày lễ truyền thống (như Trung Thu, Vu Lan, Ông Táo), false để chỉ thêm các ngày nghỉ lễ chính thức theo luật lao động"),
    }),
    execute: async ({ includeTraditional = false }) => {
      if (!eventsRepo || !context) {
        return {
          success: false,
          message: "Không thể lưu ngày lễ vì không có cơ sở dữ liệu sự kiện.",
        };
      }

      const { chatId, senderName } = context;
      const existingEvents = eventsRepo.getEventsByChat(chatId);
      const existingTitles = new Set(existingEvents.map((e) => e.title.toLowerCase().trim()));

      const targetHolidays = VIETNAMESE_HOLIDAYS.filter(
        (h) => includeTraditional || h.isPublicHoliday,
      );

      let addedCount = 0;
      for (const h of targetHolidays) {
        const normName = h.name.toLowerCase().trim();
        if (!existingTitles.has(normName)) {
          eventsRepo.createEvent({
            chatId,
            title: h.name,
            kind: "event",
            calendar: h.calendar,
            day: h.day,
            month: h.month,
            recurrence: "yearly",
            notes: h.description,
            createdBy: senderName,
          });
          existingTitles.add(normName);
          addedCount++;
        }
      }

      return {
        success: true,
        addedCount,
        totalHolidays: targetHolidays.length,
        message: `Đã thêm ${addedCount} ngày lễ vào danh sách sự kiện của nhóm.`,
      };
    },
  });

  return {
    holiday_list_upcoming,
    holiday_import,
  };
}
