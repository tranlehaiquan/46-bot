import { tool } from "ai";
import { z } from "zod";
import type { ZaloClient } from "../zalo-client.js";

/**
 * Sticker tool — lets the LLM send a contextually appropriate Zalo sticker.
 *
 * Sticker IDs sourced from popular free packs on https://stickers.zaloapp.com/
 *   - SiuKay và Đồng bọn  (funny / expressive)
 *   - Zapy Mừng Sinh Nhật (birthday / celebration / casual)
 *   - Anh Tre Say Hi       (greeting / polite / everyday)
 */

export const ALL_CATEGORIES = [
  "funny",
  "greeting",
  "thanks",
  "celebration",
  "done",
  "confused",
  "bye",
] as const;

export type StickerCategory = (typeof ALL_CATEGORIES)[number];

export const STICKER_CATALOG: Record<StickerCategory, string[]> = {
  /** Funny / lol / surprised / shocked */
  funny: [
    "b351c332fe7717294e66", // SiuKay - Ê!!
    "5abd29de149bfdc5a48a", // SiuKay - BẠN KAY À
    "dd50af3392767b282267", // SiuKay - BÓ TAY
    "72f0ff90c2d52b8b72c4", // SiuKay - shocked cry
    "799af5fac8bf21e178ae", // SiuKay - SIU ĐÓI
    "40f7ce97f3d21a8c43c3", // SiuKay - HẢ? AI BÉC
    "b1f0399004d5ed8bb4c4", // SiuKay - Peak vì ci eo
    "d7af52cf6f8a86d4df9b", // SiuKay - CHÉ
    "c5f74e9773d29a8cc3c3", // SiuKay - ZẠN TÍM MỰC
    "ceb44cd9719c98c2c18d", // Anh Tre - MỆT QUÁ TRỜI
    "3666aa0b974e7e10275f", // Anh Tre - Ơ KÌA!
  ],

  /** Hello / greeting / happy to see you */
  greeting: [
    "e160640d5948b016e959", // Anh Tre - CHÀO BÀ CON
    "6075a81795527c0c2543", // Zapy - Xin phào (wave)
    "15e6de84e3c10a9f53d0", // Zapy - Cơm chưa
    "3d03f761ca24237a7a35", // Zapy - Tới liền
    "815744357970902ec961", // Zapy - Đang đâu á?
    "ab0a2a671722fe7ca733", // Anh Tre - ĂN CƠM CHƯA?
    "008380eebdab54f50dba", // Anh Tre - CÀ PHÊ HOK?
  ],

  /** Thank you / grateful */
  thanks: [
    "3c96b5f688b361ed38a2", // SiuKay - ĐA TẠ
    "b47832150f50e60ebf41", // Anh Tre - Cảm ơn nhiều
    "2005fc67c122287c7133", // Zapy - Cảm ơn nha (with heart)
  ],

  /** Celebration / birthday / great news */
  celebration: [
    "0d5f8a32b7775e290766", // Anh Tre - QUÁ ĐỈNH!
    "2b4aec28d16d3833617c", // Zapy - Done (sunglasses)
    "a96a6d08504db913e05c", // Zapy - Được đó
    "1fb395d3a89641c81887", // SiuKay - XINH LỖI
  ],

  /** Task done / acknowledged / roger */
  done: [
    "2b4aec28d16d3833617c", // Zapy - Done
    "a96a6d08504db913e05c", // Zapy - Được đó
    "6fb9b2db8f9e66c03f8f", // Zapy - Để tui
    "03bb80d6bd9354cd0d82", // Anh Tre - busy working
  ],

  /** Confused / don't know / thinking */
  confused: [
    "2451ab3196747f2a2665", // SiuKay - KHUM CÓ BIẾT
    "815744357970902ec961", // Zapy - Đang đâu á?
    "6068ff05c2402b1e7251", // Anh Tre - BIẾT RỒI KHÓ LẮM
    "a2353c58011de843b10c", // Anh Tre - HỔNG CÓ TIỀN
  ],

  /** Bye / goodbye */
  bye: [
    "1603926eaf2b46751f3a", // Anh Tre - BYE BYE NHÉ
    "5c3b9e59a31c4a42130d", // Zapy - sleeping (nighty night)
  ],
};

export function getRandomSticker(category: StickerCategory): string {
  const ids = STICKER_CATALOG[category];
  return ids[Math.floor(Math.random() * ids.length)];
}

export function createStickerTool(zalo: ZaloClient, chatId: string) {
  const send_sticker = tool({
    description:
      "Gửi một sticker Zalo sinh động để thể hiện cảm xúc, làm cho cuộc trò chuyện vui vẻ, ấm áp và gần gũi hơn. " +
      "Chỉ gọi tool này khi ngữ cảnh thực sự phù hợp — ví dụ: chúc mừng, cảm ơn, chào hỏi, khi hoàn thành việc xong, hoặc khi muốn tạo không khí hài hước vui vẻ. " +
      "Không lạm dụng gửi sticker khi đang trả lời các thông tin quan trọng hoặc câu hỏi nghiêm túc.",
    inputSchema: z.object({
      category: z.enum(ALL_CATEGORIES).describe(
        "Loại cảm xúc của sticker phù hợp nhất với ngữ cảnh hiện tại: " +
          "'funny' (hài hước / bất ngờ / ngạc nhiên), " +
          "'greeting' (chào hỏi / hỏi thăm / rủ rê), " +
          "'thanks' (cảm ơn / biết ơn), " +
          "'celebration' (chúc mừng / đỉnh chóp / ăn mừng), " +
          "'done' (xong việc / nhận lệnh / OK), " +
          "'confused' (không biết / khó đỡ / bối rối), " +
          "'bye' (tạm biệt / đi ngủ)",
      ),
    }),
    execute: async ({ category }) => {
      if (typeof zalo.sendSticker !== "function") {
        return { success: false, message: "Tính năng gửi sticker không khả dụng." };
      }
      const stickerId = getRandomSticker(category);
      await zalo.sendSticker(chatId, stickerId);
      return { success: true, category, stickerId };
    },
  });

  return { send_sticker };
}
