import { tool } from "ai";
import { z } from "zod";
import type { ListRepository } from "../db/list-repo.js";

export function createListTools(
  repo: ListRepository,
  context: { chatId: string; senderName: string },
) {
  const { chatId, senderName } = context;

  const list_create = tool({
    description: "Tạo danh sách mới cho nhóm chat (ví dụ: 'Đi chợ', 'Việc nhà', 'Đồ đi biển').",
    inputSchema: z.object({
      name: z.string().describe("Tên danh sách cần tạo"),
    }),
    execute: async ({ name }) => {
      const list = repo.getOrCreateList(chatId, name);
      return {
        success: true,
        listId: list.id,
        listName: list.name,
        message: `Đã tạo hoặc tìm thấy danh sách "${list.name}".`,
      };
    },
  });

  const list_add_item = tool({
    description: "Thêm một hoặc nhiều món/việc vào một danh sách.",
    inputSchema: z.object({
      listName: z.string().describe("Tên danh sách (ví dụ: 'Đi chợ')"),
      items: z.array(z.string()).min(1).describe("Mảng các món cần thêm (ví dụ: ['trứng', 'sữa'])"),
    }),
    execute: async ({ listName, items }) => {
      const list = repo.getOrCreateList(chatId, listName);
      const added = repo.addItems(list.id, items, senderName);
      return {
        success: true,
        listName: list.name,
        addedCount: added.length,
        items: added.map((i) => i.text),
        message: `Đã thêm ${added.length} món vào danh sách "${list.name}".`,
      };
    },
  });

  const list_check_item = tool({
    description: "Đánh dấu một món trong danh sách là đã hoàn thành (xong) hoặc chưa hoàn thành.",
    inputSchema: z.object({
      listName: z.string().describe("Tên danh sách"),
      itemText: z.string().describe("Tên hoặc từ khóa của món cần đánh dấu (ví dụ: 'trứng')"),
      done: z.boolean().default(true).describe("true nếu đã làm/mua xong, false nếu chưa xong"),
    }),
    execute: async ({ listName, itemText, done }) => {
      const isDone = done ?? true;
      const list = repo.getListByName(chatId, listName);
      if (!list) {
        return {
          success: false,
          message: `Không tìm thấy danh sách "${listName}".`,
        };
      }
      const updated = repo.checkItem(list.id, itemText, isDone);
      if (!updated) {
        return {
          success: false,
          message: `Không tìm thấy món nào khớp với "${itemText}" trong danh sách "${list.name}".`,
        };
      }
      return {
        success: true,
        listName: list.name,
        itemText: updated.text,
        done: updated.done,
        message: `Đã đánh dấu "${updated.text}" là ${updated.done ? "đã xong" : "chưa xong"}.`,
      };
    },
  });

  const list_remove_item = tool({
    description: "Xóa hẳn một món khỏi danh sách.",
    inputSchema: z.object({
      listName: z.string().describe("Tên danh sách"),
      itemText: z.string().describe("Tên hoặc từ khóa của món cần xóa"),
    }),
    execute: async ({ listName, itemText }) => {
      const list = repo.getListByName(chatId, listName);
      if (!list) {
        return {
          success: false,
          message: `Không tìm thấy danh sách "${listName}".`,
        };
      }
      const removed = repo.removeItem(list.id, itemText);
      if (!removed) {
        return {
          success: false,
          message: `Không tìm thấy món nào khớp với "${itemText}" trong danh sách "${list.name}".`,
        };
      }
      return {
        success: true,
        listName: list.name,
        removedItem: itemText,
        message: `Đã xóa món khớp với "${itemText}" khỏi danh sách "${list.name}".`,
      };
    },
  });

  const list_show = tool({
    description: "Xem các món trong một danh sách cụ thể hoặc liệt kê tất cả các danh sách trong nhóm.",
    inputSchema: z.object({
      listName: z.string().optional().describe("Tên danh sách muốn xem. Nếu để trống sẽ hiển thị tất cả các danh sách hiện có."),
    }),
    execute: async ({ listName }) => {
      if (listName && listName.trim().length > 0) {
        const listWithItems = repo.getListWithItems(chatId, listName);
        if (!listWithItems) {
          return {
            success: false,
            message: `Không tìm thấy danh sách "${listName}".`,
          };
        }
        return {
          success: true,
          listName: listWithItems.name,
          totalItems: listWithItems.items.length,
          items: listWithItems.items.map((i) => ({
            id: i.id,
            text: i.text,
            done: i.done,
            addedBy: i.addedBy,
          })),
        };
      }

      const allLists = repo.getListsByChat(chatId);
      return {
        success: true,
        lists: allLists.map((l) => ({ id: l.id, name: l.name })),
        totalLists: allLists.length,
      };
    },
  });

  return {
    list_create,
    list_add_item,
    list_check_item,
    list_remove_item,
    list_show,
  };
}
