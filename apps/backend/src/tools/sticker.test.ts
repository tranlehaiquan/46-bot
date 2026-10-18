import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_CATEGORIES,
  STICKER_CATALOG,
  createStickerTool,
  getRandomSticker,
  type StickerCategory,
} from "./sticker.js";
import type { ZaloClient } from "../zalo-client.js";

describe("Sticker tool & catalog", () => {
  it("has valid non-empty sticker pools for all defined categories", () => {
    assert.ok(ALL_CATEGORIES.length >= 7);
    for (const category of ALL_CATEGORIES) {
      const stickers = STICKER_CATALOG[category];
      assert.ok(Array.isArray(stickers), `Category ${category} should have an array of stickers`);
      assert.ok(stickers.length > 0, `Category ${category} should not be empty`);
      for (const id of stickers) {
        assert.equal(typeof id, "string");
        assert.ok(id.length > 0);
      }
    }
  });

  it("getRandomSticker returns a valid sticker from the requested category", () => {
    for (const category of ALL_CATEGORIES) {
      const sticker = getRandomSticker(category);
      assert.ok(STICKER_CATALOG[category].includes(sticker));
    }
  });

  it("send_sticker tool executes and calls zalo.sendSticker with chatId and random sticker", async () => {
    const sentStickers: Array<{ chatId: string; stickerId: string }> = [];
    const mockZalo: Partial<ZaloClient> = {
      async sendSticker(chatId: string, stickerId: string) {
        sentStickers.push({ chatId, stickerId });
      },
    };

    const toolGroup = createStickerTool(mockZalo as ZaloClient, "test-chat-123");
    assert.ok(toolGroup.send_sticker);

    const result = await (toolGroup.send_sticker as any).execute({
      category: "greeting" as StickerCategory,
    });

    assert.equal(sentStickers.length, 1);
    assert.equal(sentStickers[0].chatId, "test-chat-123");
    assert.ok(STICKER_CATALOG.greeting.includes(sentStickers[0].stickerId));
    assert.deepEqual(result, {
      success: true,
      category: "greeting",
      stickerId: sentStickers[0].stickerId,
    });
  });

  it("returns failure when zalo.sendSticker is not supported or undefined", async () => {
    const mockZalo: Partial<ZaloClient> = {};
    const toolGroup = createStickerTool(mockZalo as ZaloClient, "test-chat-123");

    const result = await (toolGroup.send_sticker as any).execute({
      category: "funny" as StickerCategory,
    });

    assert.equal(result.success, false);
    assert.ok(result.message);
  });
});
