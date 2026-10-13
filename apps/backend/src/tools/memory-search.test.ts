import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  removeVietnameseDiacritics,
  tokenize,
  rankMemoryCandidates,
  type MemorySearchCandidate,
} from "./memory-search.js";

describe("memory-search", () => {
  describe("removeVietnameseDiacritics", () => {
    it("converts uppercase, lowercase, and special characters correctly", () => {
      assert.equal(removeVietnameseDiacritics("Cà Phê Đen"), "ca phe den");
      assert.equal(removeVietnameseDiacritics("Đà Lạt sương mù"), "da lat suong mu");
      assert.equal(removeVietnameseDiacritics("Bé Na học giỏi"), "be na hoc gioi");
    });
  });

  describe("tokenize", () => {
    it("splits query into alphanumeric tokens of length > 1", () => {
      const tokens = tokenize("Bố thích uống cà phê, đen!");
      assert.deepEqual(tokens, ["bố", "thích", "uống", "cà", "phê", "đen"]);
    });
  });

  describe("rankMemoryCandidates", () => {
    const candidates: MemorySearchCandidate[] = [
      {
        type: "fact",
        id: 1,
        subject: "Bố",
        content: "Thích uống cà phê đen không đường",
        category: "core",
        ts: 1000,
      },
      {
        type: "fact",
        id: 2,
        subject: "Mẹ",
        content: "Thích áo màu đen và hoa hồng",
        category: "general",
        ts: 2000,
      },
      {
        type: "story",
        id: 10,
        subject: "Chuyến đi Đà Lạt đầu tiên của cả nhà",
        content: "Cả nhà đi Đà Lạt chơi vào mùa hè, ghé quán cà phê đẹp tuyệt",
        people: "Bố, Mẹ, Bé Na",
        happenedOn: "2024-06",
        ts: 3000,
      },
    ];

    it("ranks exact phrase matches higher than partial matches", () => {
      const results = rankMemoryCandidates(candidates, "cà phê đen");
      assert.ok(results.length >= 1);
      assert.equal(results[0].id, 1);
      assert.equal(results[0].type, "fact");
      assert.ok(results[0].score > (results[1]?.score ?? 0));
    });

    it("matches candidates diacritic-insensitively when user enters unaccented query", () => {
      const results = rankMemoryCandidates(candidates, "da lat");
      assert.ok(results.length >= 1);
      assert.equal(results[0].id, 10);
      assert.equal(results[0].type, "story");
    });

    it("boosts core category memories when relevance is comparable", () => {
      const similarCandidates: MemorySearchCandidate[] = [
        {
          type: "fact",
          id: 101,
          subject: "Bố",
          content: "Dị ứng hải sản",
          category: "core",
          ts: 1000,
        },
        {
          type: "fact",
          id: 102,
          subject: "Bố",
          content: "Không thích ăn hải sản nướng",
          category: "general",
          ts: 1000,
        },
      ];

      const results = rankMemoryCandidates(similarCandidates, "hải sản");
      assert.equal(results.length, 2);
      assert.equal(results[0].id, 101);
      assert.ok(results[0].score > results[1].score);
    });

    it("filters and limits results according to limit param", () => {
      const results = rankMemoryCandidates(candidates, "cà phê", 1);
      assert.equal(results.length, 1);
    });

    it("returns empty array when no candidates match", () => {
      const results = rankMemoryCandidates(candidates, "bơi lội bóng đá tennis");
      assert.equal(results.length, 0);
    });
  });
});
