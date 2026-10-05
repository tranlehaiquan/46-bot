import { tool } from "ai";
import { z } from "zod";
import type { LookupRepository, LookupRecurrence } from "../db/repositories/lookups.js";
import { detectPromptInjection, PROMPT_INJECTION_REFUSAL_MESSAGE } from "../llm/prompt-security.js";

const recurrenceSchema = z.enum(["daily", "weekly", "monthly"]);

const WEEKDAY_NAMES = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

export function createLookupTools(
  repo: LookupRepository,
  context: { chatId: string; senderName: string },
) {
  const { chatId, senderName } = context;

  const lookup_schedule_create = tool({
    description:
      "Tạo lịch tra cứu định kỳ trên Internet (như xem thời tiết mỗi sáng, theo dõi giá vàng, tin tức...) cho nhóm chat theo lịch hàng ngày, hàng tuần hoặc hàng tháng.",
    inputSchema: z.object({
      instruction: z
        .string()
        .describe(
          "Nội dung/chỉ dẫn tra cứu cần thực hiện định kỳ (ví dụ: 'Báo thời tiết TP.HCM', 'Giá vàng SJC hôm nay')",
        ),
      recurrence: recurrenceSchema.describe(
        "Tần suất lặp lại: 'daily' (hàng ngày), 'weekly' (hàng tuần), 'monthly' (hàng tháng)",
      ),
      time: z
        .string()
        .optional()
        .describe("Giờ thực hiện theo định dạng HH:mm (ví dụ: '07:00', '08:30', '19:00')"),
      hour: z
        .number()
        .int()
        .min(0)
        .max(23)
        .optional()
        .describe("Giờ thực hiện (0-23)"),
      minute: z
        .number()
        .int()
        .min(0)
        .max(59)
        .optional()
        .describe("Phút thực hiện (0-59)"),
      isMorning: z
        .boolean()
        .optional()
        .describe(
          "true nếu yêu cầu tra cứu vào buổi sáng mà không nói rõ giờ (hệ thống sẽ tự động dùng 07:00)",
        ),
      weekday: z
        .number()
        .int()
        .min(0)
        .max(6)
        .optional()
        .describe(
          "Thứ trong tuần cho lịch hàng tuần (0: Chủ Nhật, 1: Thứ Hai, ..., 6: Thứ Bảy). Bắt buộc khi recurrence là 'weekly'",
        ),
      dayOfMonth: z
        .number()
        .int()
        .min(1)
        .max(31)
        .optional()
        .describe(
          "Ngày dương lịch trong tháng cho lịch hàng tháng (1-31). Bắt buộc khi recurrence là 'monthly'",
        ),
    }),
    execute: async ({
      instruction,
      recurrence,
      time,
      hour,
      minute,
      isMorning,
      weekday,
      dayOfMonth,
    }) => {
      // 1. Prompt injection check
      const injectionCheck = detectPromptInjection(instruction);
      if (injectionCheck.isInjection) {
        return {
          success: false,
          message: PROMPT_INJECTION_REFUSAL_MESSAGE,
        };
      }

      // 2. Parse time
      let parsedHour = hour;
      let parsedMinute = minute ?? 0;

      if (time) {
        const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
        if (match) {
          parsedHour = parseInt(match[1], 10);
          parsedMinute = parseInt(match[2], 10);
        }
      }

      // Morning request with no clock time saves 07:00
      if (parsedHour === undefined && isMorning) {
        parsedHour = 7;
        parsedMinute = 0;
      }

      if (
        parsedHour === undefined ||
        parsedHour < 0 ||
        parsedHour > 23 ||
        parsedMinute < 0 ||
        parsedMinute > 59
      ) {
        return {
          success: false,
          message:
            "Vui lòng cho biết giờ cụ thể để thực hiện tra cứu (ví dụ: lúc 7:00 sáng hoặc 19:30).",
        };
      }

      // 3. Weekday validation
      if (recurrence === "weekly" && (weekday === undefined || weekday === null)) {
        return {
          success: false,
          message:
            "Lịch định kỳ hàng tuần cần chỉ định rõ thứ trong tuần (ví dụ: Thứ Hai hoặc Chủ Nhật).",
        };
      }

      // 4. Day of month validation
      if (recurrence === "monthly" && (dayOfMonth === undefined || dayOfMonth === null)) {
        return {
          success: false,
          message:
            "Lịch định kỳ hàng tháng cần chỉ định rõ ngày trong tháng (ngày 1 đến ngày 31).",
        };
      }

      const created = repo.createLookup({
        chatId,
        instruction: instruction.trim(),
        recurrence,
        hour: parsedHour,
        minute: parsedMinute,
        weekday: recurrence === "weekly" ? weekday : null,
        dayOfMonth: recurrence === "monthly" ? dayOfMonth : null,
        createdBy: senderName,
      });

      const timeStr = `${String(parsedHour).padStart(2, "0")}:${String(parsedMinute).padStart(2, "0")}`;
      let scheduleDesc = "";
      if (recurrence === "daily") {
        scheduleDesc = `mỗi ngày lúc ${timeStr}`;
      } else if (recurrence === "weekly") {
        scheduleDesc = `vào ${WEEKDAY_NAMES[weekday!]} hàng tuần lúc ${timeStr}`;
      } else if (recurrence === "monthly") {
        scheduleDesc = `vào ngày ${dayOfMonth} hàng tháng lúc ${timeStr} (với những tháng ngắn hơn không có ngày này, hệ thống sẽ thực hiện vào ngày cuối cùng của tháng)`;
      }

      return {
        success: true,
        lookup: {
          id: created.id,
          instruction: created.instruction,
          recurrence: created.recurrence,
          time: timeStr,
          weekday: created.weekday,
          dayOfMonth: created.dayOfMonth,
        },
        message: `Đã đặt lịch tra cứu định kỳ thành công!\n- Chỉ dẫn: "${created.instruction}"\n- Lịch chạy: ${scheduleDesc}`,
      };
    },
  });

  const lookup_schedule_list = tool({
    description: "Xem danh sách các lịch tra cứu định kỳ hiện có của nhóm chat này.",
    inputSchema: z.object({}),
    execute: async () => {
      const lookups = repo.listLookups(chatId);
      if (lookups.length === 0) {
        return {
          success: true,
          total: 0,
          lookups: [],
          message: "Hiện chưa có lịch tra cứu định kỳ nào được cài đặt trong nhóm.",
        };
      }

      return {
        success: true,
        total: lookups.length,
        lookups: lookups.map((l) => ({
          id: l.id,
          instruction: l.instruction,
          recurrence: l.recurrence,
          time: `${String(l.hour).padStart(2, "0")}:${String(l.minute).padStart(2, "0")}`,
          weekday: l.weekday !== null ? WEEKDAY_NAMES[l.weekday] : undefined,
          dayOfMonth: l.dayOfMonth,
          active: l.active,
          lastRunStatus: l.lastRun?.status,
        })),
        message: `Tìm thấy ${lookups.length} lịch tra cứu định kỳ trong nhóm.`,
      };
    },
  });

  const lookup_schedule_update = tool({
    description: "Cập nhật chỉ dẫn, giờ chạy hoặc trạng thái bật/tắt của một lịch tra cứu định kỳ.",
    inputSchema: z.object({
      id: z.number().int().describe("ID của lịch tra cứu cần cập nhật"),
      instruction: z.string().optional().describe("Chỉ dẫn tra cứu mới"),
      recurrence: recurrenceSchema.optional().describe("Tần suất mới: 'daily', 'weekly', hoặc 'monthly'"),
      time: z.string().optional().describe("Giờ thực hiện mới (HH:mm)"),
      hour: z.number().int().min(0).max(23).optional(),
      minute: z.number().int().min(0).max(59).optional(),
      weekday: z.number().int().min(0).max(6).optional(),
      dayOfMonth: z.number().int().min(1).max(31).optional(),
      active: z.boolean().optional().describe("true để bật, false để tạm dừng"),
    }),
    execute: async ({
      id,
      instruction,
      recurrence,
      time,
      hour,
      minute,
      weekday,
      dayOfMonth,
      active,
    }) => {
      const existing = repo.getLookupById(id);
      if (!existing || existing.chatId !== chatId) {
        return {
          success: false,
          message: `Không tìm thấy lịch tra cứu #${id} trong nhóm chat này.`,
        };
      }

      if (instruction !== undefined) {
        const injectionCheck = detectPromptInjection(instruction);
        if (injectionCheck.isInjection) {
          return {
            success: false,
            message: PROMPT_INJECTION_REFUSAL_MESSAGE,
          };
        }
      }

      let parsedHour = hour;
      let parsedMinute = minute;
      if (time) {
        const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
        if (match) {
          parsedHour = parseInt(match[1], 10);
          parsedMinute = parseInt(match[2], 10);
        }
      }

      const targetRecurrence = recurrence ?? existing.recurrence;
      const targetWeekday = weekday !== undefined ? weekday : existing.weekday;
      const targetDayOfMonth = dayOfMonth !== undefined ? dayOfMonth : existing.dayOfMonth;

      if (targetRecurrence === "weekly" && targetWeekday === null) {
        return {
          success: false,
          message: "Lịch hàng tuần cần chỉ định thứ trong tuần.",
        };
      }

      if (targetRecurrence === "monthly" && targetDayOfMonth === null) {
        return {
          success: false,
          message: "Lịch hàng tháng cần chỉ định ngày trong tháng.",
        };
      }

      const updated = repo.updateLookup(id, {
        instruction,
        recurrence,
        hour: parsedHour,
        minute: parsedMinute,
        weekday: targetRecurrence === "weekly" ? targetWeekday : null,
        dayOfMonth: targetRecurrence === "monthly" ? targetDayOfMonth : null,
        active,
      });

      if (!updated) {
        return {
          success: false,
          message: `Không thể cập nhật lịch tra cứu #${id}.`,
        };
      }

      const finalTimeStr = `${String(updated.hour).padStart(2, "0")}:${String(updated.minute).padStart(2, "0")}`;
      let scheduleDesc = "";
      if (updated.recurrence === "daily") {
        scheduleDesc = `mỗi ngày lúc ${finalTimeStr}`;
      } else if (updated.recurrence === "weekly") {
        scheduleDesc = `vào ${WEEKDAY_NAMES[updated.weekday!]} hàng tuần lúc ${finalTimeStr}`;
      } else if (updated.recurrence === "monthly") {
        scheduleDesc = `vào ngày ${updated.dayOfMonth} hàng tháng lúc ${finalTimeStr} (với những tháng ngắn hơn không có ngày này, hệ thống sẽ thực hiện vào ngày cuối cùng của tháng)`;
      }

      return {
        success: true,
        lookup: {
          id: updated.id,
          instruction: updated.instruction,
          recurrence: updated.recurrence,
          time: finalTimeStr,
          weekday: updated.weekday,
          dayOfMonth: updated.dayOfMonth,
          active: updated.active,
        },
        message: `Đã cập nhật lịch tra cứu #${id} thành công!\n- Chỉ dẫn: "${updated.instruction}"\n- Lịch chạy: ${scheduleDesc}\n- Trạng thái: ${updated.active ? "Đang bật" : "Tạm dừng"}`,
      };
    },
  });

  const lookup_schedule_cancel = tool({
    description: "Hủy một lịch tra cứu định kỳ trong nhóm chat.",
    inputSchema: z.object({
      id: z.number().int().describe("ID của lịch tra cứu cần hủy"),
    }),
    execute: async ({ id }) => {
      const existing = repo.getLookupById(id);
      if (!existing || existing.chatId !== chatId) {
        return {
          success: false,
          message: `Không tìm thấy lịch tra cứu #${id} trong nhóm chat này.`,
        };
      }

      const cancelled = repo.cancelLookup(id);
      if (!cancelled) {
        return {
          success: false,
          message: `Không thể hủy lịch tra cứu #${id}.`,
        };
      }

      return {
        success: true,
        message: `Đã hủy lịch tra cứu #${id} ("${existing.instruction}").`,
      };
    },
  });

  return {
    lookup_schedule_create,
    lookup_schedule_list,
    lookup_schedule_update,
    lookup_schedule_cancel,
  };
}
