import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkLottery,
  checkNorthernLottery,
  checkSouthernCentralLottery,
  checkVietlottLottery,
  createLotteryTool,
  normalizeDate,
  parseXsktRssDescription,
  parseXsktVietlottHtml,
  resolveStation,
} from "./lottery.js";

describe("Lottery station resolution & date normalization", () => {
  it("resolves various colloquial aliases for Southern provinces", () => {
    assert.strictEqual(resolveStation("TP.HCM")?.code, "xshcm");
    assert.strictEqual(resolveStation("Sài Gòn")?.code, "xshcm");
    assert.strictEqual(resolveStation("tp hcm")?.code, "xshcm");
    assert.strictEqual(resolveStation("Bình Dương")?.code, "xsbd");
    assert.strictEqual(resolveStation("Đà Lạt")?.code, "xsld");
    assert.strictEqual(resolveStation("Tiền Giang")?.code, "xstg");
    assert.strictEqual(resolveStation("Đồng Nai")?.code, "xsdn");
  });

  it("resolves Northern and Central stations", () => {
    assert.strictEqual(resolveStation("Miền Bắc")?.code, "xsmb");
    assert.strictEqual(resolveStation("Hà Nội")?.code, "xsmb");
    assert.strictEqual(resolveStation("xsmb")?.code, "xsmb");
    assert.strictEqual(resolveStation("Đà Nẵng")?.code, "xsdng");
    assert.strictEqual(resolveStation("Khánh Hòa")?.code, "xskh");
    assert.strictEqual(resolveStation("Thừa Thiên Huế")?.code, "xstth");
  });

  it("resolves Vietlott games", () => {
    assert.strictEqual(resolveStation("Vietlott Mega")?.code, "mega645");
    assert.strictEqual(resolveStation("Mega 6/45")?.code, "mega645");
    assert.strictEqual(resolveStation("Power 6/55")?.code, "power655");
    assert.strictEqual(resolveStation("xspower")?.code, "power655");
  });

  it("normalizes date formats properly", () => {
    const fixedNow = new Date("2026-10-07T12:00:00Z");
    assert.strictEqual(normalizeDate("05/10/2026", fixedNow), "05/10/2026");
    assert.strictEqual(normalizeDate("2026-10-05", fixedNow), "05/10/2026");
    assert.strictEqual(normalizeDate("5-10-2026", fixedNow), "05/10/2026");
    assert.strictEqual(normalizeDate("05/10", fixedNow), "05/10/2026");
  });
});

describe("Southern / Central prize verification (XSMN, XSMT)", () => {
  const prizes = {
    ĐB: ["750136"],
    "1": ["99882"],
    "2": ["10842"],
    "3": ["99092", "75676"],
    "4": ["44118", "39055", "75974", "55336", "55027", "70253", "03612"],
    "5": ["2393"],
    "6": ["6709", "6519", "9382"],
    "7": ["674"],
    "8": ["36"],
  };

  it("detects winning Giải Đặc Biệt (6 numbers match)", () => {
    const matches = checkSouthernCentralLottery("750136", prizes);
    assert.ok(matches.some((m) => m.prizeName === "Giải Đặc Biệt"));
  });

  it("detects winning Giải Phụ Đặc Biệt / An Ủi (wrong first digit, 5 trailing match)", () => {
    const matches = checkSouthernCentralLottery("850136", prizes);
    assert.ok(matches.some((m) => m.prizeName === "Giải Phụ Đặc Biệt (An Ủi)"));
  });

  it("detects winning Giải Khuyến Khích (matching first digit, only 1 of remaining 5 differs)", () => {
    const matches = checkSouthernCentralLottery("750936", prizes); // 1 differs to 9
    assert.ok(matches.some((m) => m.prizeName === "Giải Khuyến Khích"));
  });

  it("detects lower tier matches (Giải Tám and Giải Tư)", () => {
    // 55027 matches Giải Tư (55027)
    const matchesG4 = checkSouthernCentralLottery("155027", prizes);
    assert.ok(matchesG4.some((m) => m.prizeName === "Giải Tư"));

    // ends in 36 matches Giải Tám (36)
    const matchesG8 = checkSouthernCentralLottery("999936", prizes);
    assert.ok(matchesG8.some((m) => m.prizeName === "Giải Tám"));
  });

  it("returns empty array for non-winning ticket", () => {
    const matches = checkSouthernCentralLottery("000000", prizes);
    assert.strictEqual(matches.length, 0);
  });
});

describe("Northern prize verification (XSMB)", () => {
  const prizes = {
    ĐB: ["12554"],
    "1": ["26733"],
    "2": ["59151", "17771"],
    "3": ["03151", "68114", "40389", "58145", "45943", "53888"],
    "4": ["1684", "8376", "3445", "8586"],
    "5": ["8860", "3678", "7808", "7697", "2736", "4819"],
    "6": ["572", "875", "605"],
    "7": ["49", "97", "79", "70"],
  };

  it("detects winning Giải Đặc Biệt", () => {
    const matches = checkNorthernLottery("12554", prizes);
    assert.ok(matches.some((m) => m.prizeName === "Giải Đặc Biệt"));
  });

  it("detects winning Giải Phụ Đặc Biệt (4 trailing match)", () => {
    const matches = checkNorthernLottery("92554", prizes);
    assert.ok(matches.some((m) => m.prizeName === "Giải Phụ Đặc Biệt"));
  });

  it("detects winning Giải Khuyến Khích (2 trailing match)", () => {
    const matches = checkNorthernLottery("99954", prizes);
    assert.ok(matches.some((m) => m.prizeName === "Giải Khuyến Khích"));
  });

  it("detects Giải Bảy (2 trailing digits match 49, 97, 79, 70)", () => {
    const matches = checkNorthernLottery("11149", prizes);
    assert.ok(matches.some((m) => m.prizeName === "Giải Bảy"));
  });

  it("returns empty array for non-winning ticket", () => {
    const matches = checkNorthernLottery("00001", prizes);
    assert.strictEqual(matches.length, 0);
  });
});

describe("Vietlott prize verification", () => {
  it("evaluates Mega 6/45 wins properly", () => {
    const winning = ["02", "04", "13", "25", "31", "39"];

    // 6/6 Jackpot
    const match6 = checkVietlottLottery("02 04 13 25 31 39", "mega645", winning);
    assert.ok(match6.some((m) => m.prizeName === "Giải Jackpot"));

    // 5/6 Giải Nhất
    const match5 = checkVietlottLottery("02 04 13 25 31 44", "mega645", winning);
    assert.ok(match5.some((m) => m.prizeName === "Giải Nhất"));

    // 4/6 Giải Nhì
    const match4 = checkVietlottLottery("02 04 13 25 40 44", "mega645", winning);
    assert.ok(match4.some((m) => m.prizeName === "Giải Nhì"));

    // 3/6 Giải Ba
    const match3 = checkVietlottLottery("02 04 13 41 42 43", "mega645", winning);
    assert.ok(match3.some((m) => m.prizeName === "Giải Ba"));

    // 2/6 No win
    const match2 = checkVietlottLottery("02 04 40 41 42 43", "mega645", winning);
    assert.strictEqual(match2.length, 0);
  });

  it("evaluates Power 6/55 Jackpot 2 bonus number win", () => {
    const mainWinning = ["07", "11", "13", "16", "18", "54"];
    const bonus = "41";

    // 5 main + bonus = Jackpot 2
    const matchJp2 = checkVietlottLottery("07 11 13 16 18 41", "power655", mainWinning, bonus);
    assert.ok(matchJp2.some((m) => m.prizeName === "Giải Jackpot 2"));

    // 6 main = Jackpot 1
    const matchJp1 = checkVietlottLottery("07 11 13 16 18 54", "power655", mainWinning, bonus);
    assert.ok(matchJp1.some((m) => m.prizeName === "Giải Jackpot 1"));
  });
});

describe("Data parsing & fetchLotteryResults caching", () => {
  it("parses RSS description with merged 7 and 8 lines", () => {
    const rawRss = `
ĐB: 750136
1: 99882
2: 10842
3: 99092 - 75676
4: 44118 - 39055
5: 2393
6: 6709 - 6519
7: 6748: 59`;
    const parsed = parseXsktRssDescription(rawRss);
    assert.deepStrictEqual(parsed["ĐB"], ["750136"]);
    assert.deepStrictEqual(parsed["1"], ["99882"]);
    assert.deepStrictEqual(parsed["7"], ["674"]);
    assert.deepStrictEqual(parsed["8"], ["59"]);
  });

  it("parses Vietlott HTML correctly", () => {
    const mockHtml = `
<div class="box-ketqua">
<h2><a href="/xsmega645">Xổ số Vietlott Mega</a> <a href="/xsmega645/ngay-27-9"> ngày 27/09</a></h2>
<table class="result">
<tr><td class="ketquatxt">Kết quả</td><td class="megaresult"><em>02 04 13 25 31 39</em></td></tr>
</table>
</div>`;
    const parsed = parseXsktVietlottHtml(mockHtml, "27/09/2026");
    assert.ok(parsed);
    assert.deepStrictEqual(parsed.numbers, ["02", "04", "13", "25", "31", "39"]);
  });

  it("checks lottery and utilizes in-memory cache", async () => {
    let fetchCount = 0;
    const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
<channel>
<item>
<title>KẾT QUẢ XỔ SỐ HỒ CHÍ MINH NGÀY 05/10 (Thứ Hai)</title>
<description>
ĐB: 750136
1: 99882
2: 10842
3: 99092
4: 44118
5: 2393
6: 6709
7: 674
8: 59</description>
</item>
</channel>
</rss>`;

    const mockFetch = async () => {
      fetchCount++;
      return {
        ok: true,
        text: async () => mockXml,
      } as Response;
    };

    // First call
    const res1 = await checkLottery({
      station: "TP.HCM",
      date: "05/10/2026",
      ticketNumber: "750136",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.won, true);
    assert.strictEqual(fetchCount, 1);

    // Second call with same station and date should hit cache
    const res2 = await checkLottery({
      station: "TP.HCM",
      date: "05/10/2026",
      ticketNumber: "000000",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.won, false);
    assert.strictEqual(fetchCount, 1, "Cache hit should not trigger extra fetch");
  });
});

describe("AI SDK tool execution", () => {
  it("invokes lottery_check tool and returns valid result", async () => {
    const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
<channel>
<item>
<title>KẾT QUẢ XỔ SỐ BÌNH DƯƠNG NGÀY 02/10 (Thứ Sáu)</title>
<description>
ĐB: 123456
1: 11111
8: 99</description>
</item>
</channel>
</rss>`;

    const mockFetch = async () => ({
      ok: true,
      text: async () => mockXml,
    });

    const { lottery_check } = createLotteryTool(mockFetch as unknown as typeof fetch);
    const result = await (lottery_check.execute as any)(
      {
        station: "Bình Dương",
        date: "02/10/2026",
        ticketNumber: "123456",
      },
      { messages: [] },
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.won, true);
    assert.ok(result.message.includes("CHÚC MỪNG"));
  });
});
