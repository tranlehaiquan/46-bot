import { tool } from "ai";
import { z } from "zod";
import type { GroupMemberRepository } from "../db/repositories/group-members.js";
import {
  detectPromptInjection,
  isMemorySafe,
  PROMPT_INJECTION_REFUSAL_MESSAGE,
} from "../llm/prompt-security.js";
import { containsSensitiveData, SENSITIVE_DATA_REJECTION_MESSAGE } from "./memory.js";

export function createGroupMemberTools(
  repo: GroupMemberRepository,
  context: {
    chatId: string;
    currentSenderId: string;
    currentSenderName: string;
  },
) {
  const { chatId, currentSenderId, currentSenderName } = context;

  const list_group_members = tool({
    description:
      "Xem danh sách các thành viên trong nhóm, bao gồm tên hiển thị, biệt danh/vai vế trong gia đình (Bố, Mẹ, Con...), mối quan hệ và ghi chú cá nhân.",
    inputSchema: z.object({}),
    execute: async () => {
      const members = await repo.listMembers(chatId);
      if (members.length === 0) {
        return {
          success: true,
          count: 0,
          members: [],
          message: "Chưa ghi nhận thành viên nào trong nhóm.",
        };
      }

      return {
        success: true,
        count: members.length,
        members: members.map((m) => ({
          senderId: m.senderId,
          senderName: m.senderName,
          alias: m.alias,
          relationship: m.relationship,
          notes: m.notes,
        })),
        message: `Nhóm có ${members.length} thành viên đã được ghi nhận.`,
      };
    },
  });

  const update_group_member = tool({
    description:
      "Cập nhật hoặc đặt biệt danh/vai vế trong gia đình (Bố, Mẹ, Bé Bông...), mối quan hệ, hoặc ghi chú về một thành viên trong nhóm. KHÔNG lưu trữ mật khẩu, thông tin ngân hàng hay dữ liệu nhạy cảm.",
    inputSchema: z.object({
      target: z
        .string()
        .optional()
        .describe(
          "Người cần cập nhật: có thể là 'tôi' / 'mình' (người đang nói), hoặc tên hiển thị / biệt danh / ID của thành viên cần cập nhật",
        ),
      alias: z
        .string()
        .optional()
        .describe("Biệt danh hoặc vai vế gia đình (ví dụ: 'Bố', 'Mẹ', 'Bé Bông')"),
      relationship: z
        .string()
        .optional()
        .describe("Mối quan hệ trong gia đình (ví dụ: 'Cha', 'Mẹ', 'Con gái cả')"),
      notes: z
        .string()
        .optional()
        .describe("Ghi chú hoặc thông tin cá nhân về thành viên (ví dụ: 'Thích uống cà phê sữa không đường')"),
    }),
    execute: async ({ target, alias, relationship, notes }) => {
      if (containsSensitiveData(alias, relationship, notes)) {
        return {
          success: false,
          message: SENSITIVE_DATA_REJECTION_MESSAGE,
        };
      }

      const combinedText = [alias, relationship, notes].filter(Boolean).join(" ");
      if (combinedText && (!isMemorySafe(alias || "", notes || "") || detectPromptInjection(combinedText).isInjection)) {
        return {
          success: false,
          message: PROMPT_INJECTION_REFUSAL_MESSAGE,
        };
      }

      let targetMemberId = currentSenderId;
      const normalizedTarget = target?.trim().toLowerCase();

      if (
        normalizedTarget &&
        normalizedTarget !== "tôi" &&
        normalizedTarget !== "mình" &&
        normalizedTarget !== "em" &&
        normalizedTarget !== "anh" &&
        normalizedTarget !== currentSenderId.toLowerCase()
      ) {
        // Try direct lookup by senderId
        const byId = await repo.getMember(chatId, target!.trim());
        if (byId) {
          targetMemberId = byId.senderId;
        } else {
          const matches = await repo.findByAliasOrName(chatId, target!.trim());
          if (matches.length === 0) {
            return {
              success: false,
              message: `Không tìm thấy thành viên nào phù hợp với "${target}" trong nhóm.`,
            };
          }
          if (matches.length > 1) {
            return {
              success: false,
              message: `Tìm thấy nhiều thành viên trùng khớp với "${target}". Vui lòng chỉ rõ hơn tên hoặc ID.`,
            };
          }
          targetMemberId = matches[0].senderId;
        }
      }

      let updated = await repo.updateMember(chatId, targetMemberId, {
        alias,
        relationship,
        notes,
      });

      if (!updated && targetMemberId === currentSenderId) {
        await repo.recordActivity(chatId, currentSenderId, currentSenderName);
        updated = await repo.updateMember(chatId, targetMemberId, {
          alias,
          relationship,
          notes,
        });
      }

      if (!updated) {
        return {
          success: false,
          message: "Không tìm thấy hồ sơ thành viên để cập nhật.",
        };
      }

      const displayName = updated.alias ? `${updated.senderName} (${updated.alias})` : updated.senderName;
      return {
        success: true,
        member: {
          senderId: updated.senderId,
          senderName: updated.senderName,
          alias: updated.alias,
          relationship: updated.relationship,
          notes: updated.notes,
        },
        message: `Đã cập nhật thông tin thành viên ${displayName} thành công!`,
      };
    },
  });

  return {
    list_group_members,
    update_group_member,
  };
}
