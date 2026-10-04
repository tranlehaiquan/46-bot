import { tool } from "ai";
import { z } from "zod";
import {
  getNextOccurrence,
  type EventsRepository,
} from "../db/repositories/events.js";

const eventKindSchema = z.enum([
  "event",
  "reminder",
  "birthday",
  "anniversary",
  "gio",
  "appointment",
]);

const eventCalendarSchema = z.enum(["solar", "lunar"]);

const eventRecurrenceSchema = z.enum([
  "none",
  "yearly",
  "monthly",
  "weekly",
  "daily",
]);

export function createEventTools(
  repo: EventsRepository,
  context: { chatId: string; senderName: string },
) {
  const { chatId, senderName } = context;

  const event_add = tool({
    description:
      "Tạo sự kiện, nhắc nhở, sinh nhật, ngày giỗ, lịch hẹn cho nhóm chat. Hỗ trợ cả dương lịch (solar) và âm lịch (lunar).",
    inputSchema: z.object({
      title: z.string().describe("Tên hoặc nội dung sự kiện/nhắc nhở"),
      kind: eventKindSchema
        .optional()
        .default("event")
        .describe("Loại sự kiện: event, reminder, birthday, anniversary, gio, appointment"),
      calendar: eventCalendarSchema
        .optional()
        .default("solar")
        .describe("Lịch: 'solar' (dương lịch) hoặc 'lunar' (âm lịch)"),
      day: z.number().int().min(1).max(31).describe("Ngày (1-31)"),
      month: z.number().int().min(1).max(12).describe("Tháng (1-12)"),
      year: z
        .number()
        .int()
        .optional()
        .describe("Năm (để trống nếu lặp lại hàng năm như sinh nhật, ngày giỗ)"),
      isLeapMonth: z
        .boolean()
        .optional()
        .default(false)
        .describe("true nếu là tháng nhuận của âm lịch"),
      recurrence: eventRecurrenceSchema
        .optional()
        .default("none")
        .describe("Tần suất lặp lại: 'none', 'yearly', 'monthly', 'weekly', 'daily'"),
      remindDaysBefore: z
        .number()
        .int()
        .min(0)
        .optional()
        .default(0)
        .describe("Số ngày nhắc nhở trước (ví dụ 1 ngày, 3 ngày)"),
      notes: z.string().optional().describe("Ghi chú bổ sung"),
    }),
    execute: async ({
      title,
      kind = "event",
      calendar = "solar",
      day,
      month,
      year,
      isLeapMonth = false,
      recurrence = "none",
      remindDaysBefore = 0,
      notes,
    }) => {
      const event = repo.createEvent({
        chatId,
        title,
        kind,
        calendar,
        day,
        month,
        year,
        isLeapMonth,
        recurrence,
        remindDaysBefore,
        notes,
        createdBy: senderName,
      });

      const occ = getNextOccurrence(event, new Date());
      const calName = calendar === "lunar" ? "âm lịch" : "dương lịch";

      return {
        success: true,
        event: {
          id: event.id,
          title: event.title,
          kind: event.kind,
          calendar: event.calendar,
          date: `${event.day}/${event.month}${event.year ? `/${event.year}` : ""}${event.isLeapMonth ? " (nhuận)" : ""}`,
          isLeapMonth: event.isLeapMonth,
          recurrence: event.recurrence,
          remindDaysBefore: event.remindDaysBefore,
          nextOccurrence: occ ? occ.dateStr : null,
          daysRemaining: occ ? occ.daysRemaining : null,
        },
        message: `Đã thêm sự kiện "${event.title}" (${calName}).`,
      };
    },
  });

  const event_list_upcoming = tool({
    description:
      "Liệt kê các sự kiện, ngày giỗ, sinh nhật, nhắc nhở sắp tới trong khoảng thời gian xác định (mặc định 30 ngày).",
    inputSchema: z.object({
      windowDays: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .default(30)
        .describe("Số ngày sắp tới để tìm kiếm sự kiện (mặc định 30)"),
    }),
    execute: async ({ windowDays = 30 }) => {
      const upcoming = repo.listUpcomingEvents(chatId, windowDays, new Date());
      return {
        success: true,
        total: upcoming.length,
        events: upcoming.map((item) => ({
          id: item.event.id,
          title: item.event.title,
          kind: item.event.kind,
          calendar: item.event.calendar,
          originalDate: `${item.event.day}/${item.event.month}${item.event.year ? `/${item.event.year}` : ""}${item.event.isLeapMonth ? " (nhuận)" : ""}`,
          occurrenceDate: item.occurrenceDateStr,
          daysRemaining: item.daysRemaining,
          recurrence: item.event.recurrence,
          remindDaysBefore: item.event.remindDaysBefore,
          notes: item.event.notes,
        })),
        message: `Tìm thấy ${upcoming.length} sự kiện trong ${windowDays} ngày tới.`,
      };
    },
  });

  const event_update = tool({
    description: "Cập nhật thông tin của một sự kiện/nhắc nhở bằng ID.",
    inputSchema: z.object({
      id: z.number().int().describe("ID của sự kiện cần sửa"),
      title: z.string().optional().describe("Tên mới của sự kiện"),
      kind: eventKindSchema.optional().describe("Loại sự kiện mới"),
      calendar: eventCalendarSchema.optional().describe("Lịch mới ('solar' hoặc 'lunar')"),
      day: z.number().int().min(1).max(31).optional().describe("Ngày mới"),
      month: z.number().int().min(1).max(12).optional().describe("Tháng mới"),
      year: z.number().int().nullable().optional().describe("Năm mới (null nếu muốn xóa năm)"),
      isLeapMonth: z.boolean().optional().describe("Tháng nhuận âm lịch"),
      recurrence: eventRecurrenceSchema.optional().describe("Tần suất lặp lại mới"),
      remindDaysBefore: z.number().int().min(0).optional().describe("Số ngày nhắc trước mới"),
      notes: z.string().nullable().optional().describe("Ghi chú mới"),
    }),
    execute: async ({ id, ...updates }) => {
      const updated = repo.updateEvent(id, updates);
      if (!updated) {
        return {
          success: false,
          message: `Không tìm thấy sự kiện có ID ${id}.`,
        };
      }

      const occ = getNextOccurrence(updated, new Date());
      return {
        success: true,
        event: {
          id: updated.id,
          title: updated.title,
          kind: updated.kind,
          calendar: updated.calendar,
          date: `${updated.day}/${updated.month}${updated.year ? `/${updated.year}` : ""}`,
          nextOccurrence: occ ? occ.dateStr : null,
          daysRemaining: occ ? occ.daysRemaining : null,
        },
        message: `Đã cập nhật sự kiện "${updated.title}".`,
      };
    },
  });

  const event_delete = tool({
    description: "Xóa một sự kiện/nhắc nhở theo ID.",
    inputSchema: z.object({
      id: z.number().int().describe("ID của sự kiện cần xóa"),
    }),
    execute: async ({ id }) => {
      const deleted = repo.deleteEvent(id);
      if (!deleted) {
        return {
          success: false,
          message: `Không tìm thấy sự kiện có ID ${id} để xóa.`,
        };
      }
      return {
        success: true,
        message: `Đã xóa sự kiện ID ${id}.`,
      };
    },
  });

  return {
    event_add,
    event_list_upcoming,
    event_update,
    event_delete,
  };
}
