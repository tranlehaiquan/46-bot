import { tool } from "ai";
import { z } from "zod";

export type Region = "mien-bac" | "mien-nam" | "mien-trung" | "vietlott";

export interface StationInfo {
  code: string;
  name: string;
  region: Region;
  rssSlug?: string;
  webSlug?: string;
  drawDays?: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  drawTime: string;
}

export interface LotteryResultData {
  stationCode: string;
  stationName: string;
  region: Region;
  date: string; // "DD/MM/YYYY"
  prizes: Record<string, string[]>;
  specialBonusNumber?: string; // For Vietlott Power 6/55 Jackpot 2
}

export interface PrizeMatch {
  prizeName: string;
  matchedValue: string;
  prizeAmount: string;
  description: string;
}

export interface LotteryCheckResult {
  success: boolean;
  station: string;
  stationName?: string;
  region?: Region;
  date: string;
  ticketNumber?: string;
  won: boolean;
  prizesWon: PrizeMatch[];
  fullPrizes?: Record<string, string[]>;
  message: string;
}

// Canonical station registry
export const STATIONS: Record<string, StationInfo> = {
  // Miền Bắc
  xsmb: {
    code: "xsmb",
    name: "Miền Bắc (Hà Nội)",
    region: "mien-bac",
    rssSlug: "mien-bac-xsmb",
    drawDays: [0, 1, 2, 3, 4, 5, 6],
    drawTime: "18:15",
  },

  // Miền Nam
  xshcm: {
    code: "xshcm",
    name: "TP. Hồ Chí Minh",
    region: "mien-nam",
    rssSlug: "ho-chi-minh-xshcm",
    webSlug: "xshcm-xstp",
    drawDays: [1, 6], // Thứ 2, Thứ 7
    drawTime: "16:15",
  },
  xsdt: {
    code: "xsdt",
    name: "Đồng Tháp",
    region: "mien-nam",
    rssSlug: "dong-thap-xsdt",
    drawDays: [1],
    drawTime: "16:15",
  },
  xscm: {
    code: "xscm",
    name: "Cà Mau",
    region: "mien-nam",
    rssSlug: "ca-mau-xscm",
    drawDays: [1],
    drawTime: "16:15",
  },
  xsbt: {
    code: "xsbt",
    name: "Bến Tre",
    region: "mien-nam",
    rssSlug: "ben-tre-xsbt",
    drawDays: [2],
    drawTime: "16:15",
  },
  xsvt: {
    code: "xsvt",
    name: "Vũng Tàu",
    region: "mien-nam",
    rssSlug: "vung-tau-xsvt",
    drawDays: [2],
    drawTime: "16:15",
  },
  xsbl: {
    code: "xsbl",
    name: "Bạc Liêu",
    region: "mien-nam",
    rssSlug: "bac-lieu-xsbl",
    drawDays: [2],
    drawTime: "16:15",
  },
  xsdn: {
    code: "xsdn",
    name: "Đồng Nai",
    region: "mien-nam",
    rssSlug: "dong-nai-xsdn",
    drawDays: [3],
    drawTime: "16:15",
  },
  xsct: {
    code: "xsct",
    name: "Cần Thơ",
    region: "mien-nam",
    rssSlug: "can-tho-xsct",
    drawDays: [3],
    drawTime: "16:15",
  },
  xsst: {
    code: "xsst",
    name: "Sóc Trăng",
    region: "mien-nam",
    rssSlug: "soc-trang-xsst",
    drawDays: [3],
    drawTime: "16:15",
  },
  xstn: {
    code: "xstn",
    name: "Tây Ninh",
    region: "mien-nam",
    rssSlug: "tay-ninh-xstn",
    drawDays: [4],
    drawTime: "16:15",
  },
  xsag: {
    code: "xsag",
    name: "An Giang",
    region: "mien-nam",
    rssSlug: "an-giang-xsag",
    drawDays: [4],
    drawTime: "16:15",
  },
  xsbth: {
    code: "xsbth",
    name: "Bình Thuận",
    region: "mien-nam",
    rssSlug: "binh-thuan-xsbth",
    drawDays: [4],
    drawTime: "16:15",
  },
  xsvl: {
    code: "xsvl",
    name: "Vĩnh Long",
    region: "mien-nam",
    rssSlug: "vinh-long-xsvl",
    drawDays: [5],
    drawTime: "16:15",
  },
  xsbd: {
    code: "xsbd",
    name: "Bình Dương",
    region: "mien-nam",
    rssSlug: "binh-duong-xsbd",
    drawDays: [5],
    drawTime: "16:15",
  },
  xstv: {
    code: "xstv",
    name: "Trà Vinh",
    region: "mien-nam",
    rssSlug: "tra-vinh-xstv",
    drawDays: [5],
    drawTime: "16:15",
  },
  xsla: {
    code: "xsla",
    name: "Long An",
    region: "mien-nam",
    rssSlug: "long-an-xsla",
    drawDays: [6],
    drawTime: "16:15",
  },
  xsbp: {
    code: "xsbp",
    name: "Bình Phước",
    region: "mien-nam",
    rssSlug: "binh-phuoc-xsbp",
    drawDays: [6],
    drawTime: "16:15",
  },
  xshg: {
    code: "xshg",
    name: "Hậu Giang",
    region: "mien-nam",
    rssSlug: "hau-giang-xshg",
    drawDays: [6],
    drawTime: "16:15",
  },
  xstg: {
    code: "xstg",
    name: "Tiền Giang",
    region: "mien-nam",
    rssSlug: "tien-giang-xstg",
    drawDays: [0],
    drawTime: "16:15",
  },
  xskg: {
    code: "xskg",
    name: "Kiên Giang",
    region: "mien-nam",
    rssSlug: "kien-giang-xskg",
    drawDays: [0],
    drawTime: "16:15",
  },
  xsld: {
    code: "xsld",
    name: "Đà Lạt (Lâm Đồng)",
    region: "mien-nam",
    rssSlug: "lam-dong-xsld",
    webSlug: "xsld-xsdl",
    drawDays: [0],
    drawTime: "16:15",
  },

  // Miền Trung
  xstth: {
    code: "xstth",
    name: "Thừa Thiên Huế",
    region: "mien-trung",
    rssSlug: "thua-thien-hue-xstth",
    drawDays: [0, 1], // Chủ nhật, Thứ 2
    drawTime: "17:15",
  },
  xspy: {
    code: "xspy",
    name: "Phú Yên",
    region: "mien-trung",
    rssSlug: "phu-yen-xspy",
    drawDays: [1],
    drawTime: "17:15",
  },
  xsdlk: {
    code: "xsdlk",
    name: "Đắk Lắk",
    region: "mien-trung",
    rssSlug: "dak-lak-xsdlk",
    drawDays: [2],
    drawTime: "17:15",
  },
  xsqnm: {
    code: "xsqnm",
    name: "Quảng Nam",
    region: "mien-trung",
    rssSlug: "quang-nam-xsqnm",
    webSlug: "xsqnm-xsqna",
    drawDays: [2],
    drawTime: "17:15",
  },
  xsdng: {
    code: "xsdng",
    name: "Đà Nẵng",
    region: "mien-trung",
    rssSlug: "da-nang-xsdng",
    webSlug: "xsdng-xsdna",
    drawDays: [3, 6], // Thứ 4, Thứ 7
    drawTime: "17:15",
  },
  xskh: {
    code: "xskh",
    name: "Khánh Hòa",
    region: "mien-trung",
    rssSlug: "khanh-hoa-xskh",
    drawDays: [0, 3], // Chủ nhật, Thứ 4
    drawTime: "17:15",
  },
  xsbdi: {
    code: "xsbdi",
    name: "Bình Định",
    region: "mien-trung",
    rssSlug: "binh-dinh-xsbdi",
    drawDays: [4],
    drawTime: "17:15",
  },
  xsqt: {
    code: "xsqt",
    name: "Quảng Trị",
    region: "mien-trung",
    rssSlug: "quang-tri-xsqt",
    drawDays: [4],
    drawTime: "17:15",
  },
  xsqb: {
    code: "xsqb",
    name: "Quảng Bình",
    region: "mien-trung",
    rssSlug: "quang-binh-xsqb",
    drawDays: [4],
    drawTime: "17:15",
  },
  xsgl: {
    code: "xsgl",
    name: "Gia Lai",
    region: "mien-trung",
    rssSlug: "gia-lai-xsgl",
    drawDays: [5],
    drawTime: "17:15",
  },
  xsnt: {
    code: "xsnt",
    name: "Ninh Thuận",
    region: "mien-trung",
    rssSlug: "ninh-thuan-xsnt",
    drawDays: [5],
    drawTime: "17:15",
  },
  xsqng: {
    code: "xsqng",
    name: "Quảng Ngãi",
    region: "mien-trung",
    rssSlug: "quang-ngai-xsqng",
    drawDays: [6],
    drawTime: "17:15",
  },
  xsdno: {
    code: "xsdno",
    name: "Đắk Nông",
    region: "mien-trung",
    rssSlug: "dak-nong-xsdno",
    drawDays: [6],
    drawTime: "17:15",
  },
  xskt: {
    code: "xskt",
    name: "Kon Tum",
    region: "mien-trung",
    rssSlug: "kon-tum-xskt",
    drawDays: [0],
    drawTime: "17:15",
  },

  // Vietlott
  mega645: {
    code: "mega645",
    name: "Vietlott Mega 6/45",
    region: "vietlott",
    drawDays: [0, 3, 5], // Thứ 4, Thứ 6, Chủ nhật
    drawTime: "18:10",
  },
  power655: {
    code: "power655",
    name: "Vietlott Power 6/55",
    region: "vietlott",
    drawDays: [2, 4, 6], // Thứ 3, Thứ 5, Thứ 7
    drawTime: "18:10",
  },
};

// Aliases mapping common colloquial names, provinces, and codes to canonical station code
const STATION_ALIASES: Record<string, string> = {
  // Miền Bắc
  "xsmb": "xsmb",
  "mb": "xsmb",
  "mien bac": "xsmb",
  "bac": "xsmb",
  "ha noi": "xsmb",
  "hn": "xsmb",
  "quang ninh": "xsmb",
  "bac ninh": "xsmb",
  "hai phong": "xsmb",
  "nam dinh": "xsmb",
  "thai binh": "xsmb",

  // TP.HCM
  "tphcm": "xshcm",
  "tp hcm": "xshcm",
  "tp.hcm": "xshcm",
  "hcm": "xshcm",
  "sai gon": "xshcm",
  "saigon": "xshcm",
  "ho chi minh": "xshcm",
  "tp ho chi minh": "xshcm",
  "thanh pho ho chi minh": "xshcm",
  "xshcm": "xshcm",
  "xstp": "xshcm",

  // Southern Provinces
  "dong thap": "xsdt",
  "xsdt": "xsdt",
  "dt": "xsdt",
  "ca mau": "xscm",
  "xscm": "xscm",
  "cm": "xscm",
  "ben tre": "xsbt",
  "xsbt": "xsbt",
  "bt": "xsbt",
  "vung tau": "xsvt",
  "xsvt": "xsvt",
  "vt": "xsvt",
  "ba ria": "xsvt",
  "ba ria vung tau": "xsvt",
  "bac lieu": "xsbl",
  "xsbl": "xsbl",
  "bl": "xsbl",
  "dong nai": "xsdn",
  "xsdn": "xsdn",
  "dn": "xsdn",
  "can tho": "xsct",
  "xsct": "xsct",
  "ct": "xsct",
  "soc trang": "xsst",
  "xsst": "xsst",
  "st": "xsst",
  "tay ninh": "xstn",
  "xstn": "xstn",
  "tn": "xstn",
  "an giang": "xsag",
  "xsag": "xsag",
  "ag": "xsag",
  "binh thuan": "xsbth",
  "xsbth": "xsbth",
  "bth": "xsbth",
  "vinh long": "xsvl",
  "xsvl": "xsvl",
  "vl": "xsvl",
  "binh duong": "xsbd",
  "xsbd": "xsbd",
  "bd": "xsbd",
  "song be": "xsbd",
  "tra vinh": "xstv",
  "xstv": "xstv",
  "tv": "xstv",
  "long an": "xsla",
  "xsla": "xsla",
  "la": "xsla",
  "binh phuoc": "xsbp",
  "xsbp": "xsbp",
  "bp": "xsbp",
  "hau giang": "xshg",
  "xshg": "xshg",
  "hg": "xshg",
  "tien giang": "xstg",
  "xstg": "xstg",
  "tg": "xstg",
  "my tho": "xstg",
  "kien giang": "xskg",
  "xskg": "xskg",
  "kg": "xskg",
  "da lat": "xsld",
  "dalat": "xsld",
  "lam dong": "xsld",
  "xsld": "xsld",
  "xsdl": "xsld",
  "dl": "xsld",

  // Central Provinces
  "thua thien hue": "xstth",
  "hue": "xstth",
  "xstth": "xstth",
  "tth": "xstth",
  "phu yen": "xspy",
  "xspy": "xspy",
  "py": "xspy",
  "dak lak": "xsdlk",
  "dac lac": "xsdlk",
  "daklak": "xsdlk",
  "xsdlk": "xsdlk",
  "dlk": "xsdlk",
  "quang nam": "xsqnm",
  "xsqnm": "xsqnm",
  "qnm": "xsqnm",
  "da nang": "xsdng",
  "danang": "xsdng",
  "xsdng": "xsdng",
  "dng": "xsdng",
  "khanh hoa": "xskh",
  "nha trang": "xskh",
  "xskh": "xskh",
  "kh": "xskh",
  "binh dinh": "xsbdi",
  "quy nhon": "xsbdi",
  "xsbdi": "xsbdi",
  "bdi": "xsbdi",
  "quang tri": "xsqt",
  "xsqt": "xsqt",
  "qt": "xsqt",
  "quang binh": "xsqb",
  "xsqb": "xsqb",
  "qb": "xsqb",
  "quang ngai": "xsqng",
  "xsqng": "xsqng",
  "qng": "xsqng",
  "gia lai": "xsgl",
  "pleiku": "xsgl",
  "xsgl": "xsgl",
  "gl": "xsgl",
  "ninh thuan": "xsnt",
  "phan rang": "xsnt",
  "xsnt": "xsnt",
  "nt": "xsnt",
  "dak nong": "xsdno",
  "dac nong": "xsdno",
  "daknong": "xsdno",
  "xsdno": "xsdno",
  "dno": "xsdno",
  "kon tum": "xskt",
  "kontum": "xskt",
  "xskt": "xskt",
  "kt": "xskt",

  // Vietlott
  "mega": "mega645",
  "mega 6/45": "mega645",
  "mega645": "mega645",
  "xsmega": "mega645",
  "xsmega645": "mega645",
  "vietlott mega": "mega645",
  "power": "power655",
  "power 6/55": "power655",
  "power655": "power655",
  "xspower": "power655",
  "xspower655": "power655",
  "vietlott power": "power655",
};

/**
 * Normalizes input text into a search-friendly string (lowercase, unaccented, trimmed).
 */
export function removeVietnameseAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/**
 * Resolves a station name, code, or alias to canonical StationInfo.
 */
export function resolveStation(input: string): StationInfo | null {
  if (!input) return null;
  const clean = removeVietnameseAccents(input)
    .replace(/[._\-\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Direct alias match
  if (STATION_ALIASES[clean]) {
    const code = STATION_ALIASES[clean];
    return STATIONS[code] || null;
  }

  // Without spaces match (e.g. "tphcm", "xshcm")
  const noSpace = clean.replace(/\s+/g, "");
  if (STATION_ALIASES[noSpace]) {
    const code = STATION_ALIASES[noSpace];
    return STATIONS[code] || null;
  }

  // Substring check in registry
  for (const station of Object.values(STATIONS)) {
    const normName = removeVietnameseAccents(station.name);
    if (normName.includes(clean) || clean.includes(normName)) {
      return station;
    }
  }

  return null;
}

/**
 * Parses and formats dates into DD/MM/YYYY.
 * Defaults to current Vietnam date if unspecified.
 */
export function normalizeDate(inputDate?: string, now = new Date()): string {
  if (!inputDate || !inputDate.trim()) {
    // Current date in GMT+7
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now); // "DD/MM/YYYY"
    return parts;
  }

  const clean = inputDate.trim();

  // Check YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  // Check DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  // Check DD/MM (assume current year)
  const dmMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (dmMatch) {
    const currentYear = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
    }).format(now);
    const [, d, m] = dmMatch;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${currentYear}`;
  }

  return clean;
}

/**
 * Checks ticket against Northern (XSMB - 5 digits) prize results.
 */
export function checkNorthernLottery(
  ticket: string,
  prizes: Record<string, string[]>,
): PrizeMatch[] {
  const cleanTicket = ticket.replace(/\D/g, "");
  if (cleanTicket.length !== 5) return [];

  const matches: PrizeMatch[] = [];
  const gdb = prizes["ĐB"]?.[0] || prizes["db"]?.[0] || "";

  // 1. Check Giải Đặc Biệt
  if (gdb && cleanTicket === gdb) {
    matches.push({
      prizeName: "Giải Đặc Biệt",
      matchedValue: gdb,
      prizeAmount: "500.000.000 đ",
      description: "Trúng cả 5 chữ số của Giải Đặc Biệt",
    });
  } else if (gdb) {
    // 2. Check Giải Phụ Đặc Biệt: Trùng 4 số cuối của GĐB
    if (cleanTicket.slice(1) === gdb.slice(1)) {
      matches.push({
        prizeName: "Giải Phụ Đặc Biệt",
        matchedValue: cleanTicket.slice(1),
        prizeAmount: "20.000.000 đ",
        description: "Trùng 4 chữ số cuối của Giải Đặc Biệt",
      });
    }

    // 3. Check Giải Khuyến Khích: Trùng 2 số cuối của GĐB
    if (cleanTicket.slice(3) === gdb.slice(3)) {
      matches.push({
        prizeName: "Giải Khuyến Khích",
        matchedValue: cleanTicket.slice(3),
        prizeAmount: "40.000 đ",
        description: "Trùng 2 chữ số cuối của Giải Đặc Biệt",
      });
    }
  }

  // Helper for matching trailing digits
  const checkTier = (tierName: string, tierKey: string, digitCount: number, prizeAmount: string) => {
    const values = prizes[tierKey] || [];
    const suffix = cleanTicket.slice(5 - digitCount);
    for (const val of values) {
      if (val.endsWith(suffix) && val.length >= digitCount) {
        matches.push({
          prizeName: tierName,
          matchedValue: val,
          prizeAmount,
          description: `Trùng ${digitCount} chữ số cuối (${suffix})`,
        });
        break; // Count once per tier
      }
    }
  };

  checkTier("Giải Nhất", "1", 5, "10.000.000 đ");
  checkTier("Giải Nhì", "2", 5, "5.000.000 đ");
  checkTier("Giải Ba", "3", 5, "1.000.000 đ");
  checkTier("Giải Tư", "4", 4, "400.000 đ");
  checkTier("Giải Năm", "5", 4, "200.000 đ");
  checkTier("Giải Sáu", "6", 3, "100.000 đ");
  checkTier("Giải Bảy", "7", 2, "40.000 đ");

  return matches;
}

/**
 * Checks ticket against Southern / Central (XSMN, XSMT - 6 digits) prize results.
 */
export function checkSouthernCentralLottery(
  ticket: string,
  prizes: Record<string, string[]>,
): PrizeMatch[] {
  const cleanTicket = ticket.replace(/\D/g, "");
  if (cleanTicket.length !== 6) return [];

  const matches: PrizeMatch[] = [];
  const gdb = prizes["ĐB"]?.[0] || prizes["db"]?.[0] || "";

  if (gdb && gdb.length === 6) {
    if (cleanTicket === gdb) {
      matches.push({
        prizeName: "Giải Đặc Biệt",
        matchedValue: gdb,
        prizeAmount: "2.000.000.000 đ",
        description: "Trúng cả 6 chữ số của Giải Đặc Biệt",
      });
    } else {
      // Giải Phụ Đặc Biệt (An Ủi): Trùng 5 số cuối của GĐB (chỉ sai chữ số đầu tiên)
      if (cleanTicket.slice(1) === gdb.slice(1) && cleanTicket[0] !== gdb[0]) {
        matches.push({
          prizeName: "Giải Phụ Đặc Biệt (An Ủi)",
          matchedValue: cleanTicket.slice(1),
          prizeAmount: "50.000.000 đ",
          description: "Trùng 5 chữ số cuối của Giải Đặc Biệt (chỉ sai số đầu tiên)",
        });
      }

      // Giải Khuyến Khích: Trùng chữ số đầu tiên, chỉ sai 1 chữ số bất kỳ ở 5 vị trí còn lại
      if (cleanTicket[0] === gdb[0]) {
        let diffCount = 0;
        for (let i = 1; i < 6; i++) {
          if (cleanTicket[i] !== gdb[i]) diffCount++;
        }
        if (diffCount === 1) {
          matches.push({
            prizeName: "Giải Khuyến Khích",
            matchedValue: cleanTicket,
            prizeAmount: "6.000.000 đ",
            description: "Trùng số đầu và chỉ sai 1 trong 5 số còn lại so với Giải Đặc Biệt",
          });
        }
      }
    }
  }

  const checkTier = (tierName: string, tierKey: string, digitCount: number, prizeAmount: string) => {
    const values = prizes[tierKey] || [];
    const suffix = cleanTicket.slice(6 - digitCount);
    for (const val of values) {
      if (val.endsWith(suffix) && val.length >= digitCount) {
        matches.push({
          prizeName: tierName,
          matchedValue: val,
          prizeAmount,
          description: `Trùng ${digitCount} chữ số cuối (${suffix})`,
        });
        break;
      }
    }
  };

  checkTier("Giải Nhất", "1", 5, "30.000.000 đ");
  checkTier("Giải Nhì", "2", 5, "15.000.000 đ");
  checkTier("Giải Ba", "3", 5, "10.000.000 đ");
  checkTier("Giải Tư", "4", 5, "3.000.000 đ");
  checkTier("Giải Năm", "5", 4, "1.000.000 đ");
  checkTier("Giải Sáu", "6", 4, "400.000 đ");
  checkTier("Giải Bảy", "7", 3, "200.000 đ");
  checkTier("Giải Tám", "8", 2, "100.000 đ");

  return matches;
}

/**
 * Checks ticket against Vietlott (Mega 6/45, Power 6/55).
 */
export function checkVietlottLottery(
  ticket: string,
  gameType: "mega645" | "power655",
  winningNumbers: string[],
  specialBonusNumber?: string,
): PrizeMatch[] {
  // Extract 2-digit numbers
  const ticketNums = Array.from(new Set(ticket.match(/\b\d{1,2}\b/g)?.map((n) => n.padStart(2, "0")) || []));
  if (ticketNums.length < 6) return [];

  const winningSet = new Set(winningNumbers.map((n) => n.padStart(2, "0")));
  const matchCount = ticketNums.filter((n) => winningSet.has(n)).length;
  const matches: PrizeMatch[] = [];

  if (gameType === "mega645") {
    if (matchCount === 6) {
      matches.push({
        prizeName: "Giải Jackpot",
        matchedValue: `${matchCount}/6 số`,
        prizeAmount: "Tối thiểu 12 tỷ đồng (Jackpot)",
        description: "Trúng toàn bộ 6 bộ số",
      });
    } else if (matchCount === 5) {
      matches.push({
        prizeName: "Giải Nhất",
        matchedValue: "5/6 số",
        prizeAmount: "10.000.000 đ",
        description: "Trúng 5 trong 6 số",
      });
    } else if (matchCount === 4) {
      matches.push({
        prizeName: "Giải Nhì",
        matchedValue: "4/6 số",
        prizeAmount: "300.000 đ",
        description: "Trúng 4 trong 6 số",
      });
    } else if (matchCount === 3) {
      matches.push({
        prizeName: "Giải Ba",
        matchedValue: "3/6 số",
        prizeAmount: "30.000 đ",
        description: "Trúng 3 trong 6 số",
      });
    }
  } else if (gameType === "power655") {
    const hasBonus = specialBonusNumber && ticketNums.includes(specialBonusNumber.padStart(2, "0"));

    if (matchCount === 6) {
      matches.push({
        prizeName: "Giải Jackpot 1",
        matchedValue: "6/6 số chính",
        prizeAmount: "Tối thiểu 30 tỷ đồng (Jackpot 1)",
        description: "Trúng cả 6 số chính",
      });
    } else if (matchCount === 5 && hasBonus) {
      matches.push({
        prizeName: "Giải Jackpot 2",
        matchedValue: "5 số chính + 1 số đặc biệt",
        prizeAmount: "Tối thiểu 3 tỷ đồng (Jackpot 2)",
        description: "Trúng 5 số chính và số đặc biệt JP2",
      });
    } else if (matchCount === 5) {
      matches.push({
        prizeName: "Giải Nhất",
        matchedValue: "5/6 số chính",
        prizeAmount: "40.000.000 đ",
        description: "Trúng 5 số chính",
      });
    } else if (matchCount === 4) {
      matches.push({
        prizeName: "Giải Nhì",
        matchedValue: "4/6 số chính",
        prizeAmount: "500.000 đ",
        description: "Trúng 4 số chính",
      });
    } else if (matchCount === 3) {
      matches.push({
        prizeName: "Giải Ba",
        matchedValue: "3/6 số chính",
        prizeAmount: "50.000 đ",
        description: "Trúng 3 số chính",
      });
    }
  }

  return matches;
}

// In-memory cache: key = `${stationCode}:${normalizedDate}`
const resultCache = new Map<string, { data: LotteryResultData; cachedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h for past results

/**
 * Parses RSS XML description text from xskt.com.vn.
 */
export function parseXsktRssDescription(desc: string): Record<string, string[]> {
  const prizes: Record<string, string[]> = {};
  // Fix joined 7 and 8 lines like "7: 6748: 59" -> "7: 674\n8: 59"
  const normalized = desc.replace(/7:\s*(\d{3,4})\s*8:\s*(\d{2})/g, "7: $1\n8: $2");

  const lines = normalized.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Pattern: "ĐB: 12554" or "1: 26733" or "3: 03151 - 68114"
    const match = line.match(/^([A-ZĐđ0-9]+):\s*(.+)$/);
    if (match) {
      const key = match[1].toUpperCase();
      const numbers = match[2]
        .split("-")
        .map((n) => n.trim().replace(/\D/g, ""))
        .filter(Boolean);
      if (numbers.length > 0) {
        prizes[key] = numbers;
      }
    }
  }

  return prizes;
}

/**
 * Parses Vietlott HTML from xskt.com.vn/xsmega645 or xspower.
 */
export function parseXsktVietlottHtml(
  html: string,
  targetDate: string,
): { numbers: string[]; specialBonusNumber?: string; drawDate: string } | null {
  // Regex finding box-ketqua sections
  // Date format in header: "ngày 27/09" or "ngày 03/10"
  const [targetDay, targetMonth] = targetDate.split("/");
  const shortTarget = `${parseInt(targetDay, 10)}/${parseInt(targetMonth, 10)}`;

  const boxRegex = /<div class="box-ketqua">([\s\S]*?)<\/table>/g;
  let match: RegExpExecArray | null;

  while ((match = boxRegex.exec(html)) !== null) {
    const block = match[1];
    // Check if date matches
    const dateMatch = block.match(/ngày\s*([0-9]{1,2})\/([0-9]{1,2})/i);
    if (dateMatch) {
      const blockDay = parseInt(dateMatch[1], 10);
      const blockMonth = parseInt(dateMatch[2], 10);
      const blockDateShort = `${blockDay}/${blockMonth}`;

      if (blockDateShort === shortTarget || !targetDate) {
        // Extract winning numbers from <td class="megaresult"><em>02 04 13 25 31 39</em></td>
        const numbersMatch = block.match(/<td class="megaresult"><em>([0-9\s]+)<\/em><\/td>/i);
        if (numbersMatch) {
          const numbers = numbersMatch[1].trim().split(/\s+/).map((n) => n.padStart(2, "0"));
          // Check for JP2 bonus in Power 6/55
          const jp2Match = block.match(/<td title="Số trúng giải Jackpot 2">Số JP2<\/td><td class="megaresult">(\d+)<\/td>/i);
          const specialBonusNumber = jp2Match ? jp2Match[1].padStart(2, "0") : undefined;

          return {
            numbers,
            specialBonusNumber,
            drawDate: `${blockDay.toString().padStart(2, "0")}/${blockMonth.toString().padStart(2, "0")}`,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Fetches lottery results from xskt RSS / HTML.
 */
export async function fetchLotteryResults(
  station: StationInfo,
  targetDate: string,
  fetchFn: typeof fetch = fetch,
): Promise<LotteryResultData | null> {
  const cacheKey = `${station.code}:${targetDate}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // Handle Vietlott
  if (station.region === "vietlott") {
    const url =
      station.code === "mega645"
        ? "https://xskt.com.vn/xsmega645"
        : "https://xskt.com.vn/xspower";

    try {
      const res = await fetchFn(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) return null;
      const html = await res.text();
      const parsed = parseXsktVietlottHtml(html, targetDate);
      if (!parsed) return null;

      const result: LotteryResultData = {
        stationCode: station.code,
        stationName: station.name,
        region: "vietlott",
        date: targetDate,
        prizes: {
          Jackpot: parsed.numbers,
        },
        specialBonusNumber: parsed.specialBonusNumber,
      };

      resultCache.set(cacheKey, { data: result, cachedAt: Date.now() });
      return result;
    } catch {
      return null;
    }
  }

  // Handle Traditional Lotteries via RSS
  const rssSlug = station.rssSlug || "mien-bac-xsmb";
  const url = `https://xskt.com.vn/rss-feed/${rssSlug}.rss`;

  try {
    const res = await fetchFn(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const xml = await res.text();

    // Match RSS items
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let itemMatch: RegExpExecArray | null;

    const [targetDay, targetMonth] = targetDate.split("/");
    const shortDay = targetDay.padStart(2, "0");
    const shortMonth = targetMonth.padStart(2, "0");
    const datePattern = `${shortDay}/${shortMonth}`;

    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const itemContent = itemMatch[1];
      const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
      const title = titleMatch ? titleMatch[1] : "";

      // Check if item corresponds to targetDate
      if (title.includes(datePattern)) {
        const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/);
        if (descMatch) {
          const desc = descMatch[1];
          const prizes = parseXsktRssDescription(desc);

          if (Object.keys(prizes).length > 0) {
            const result: LotteryResultData = {
              stationCode: station.code,
              stationName: station.name,
              region: station.region,
              date: targetDate,
              prizes,
            };

            resultCache.set(cacheKey, { data: result, cachedAt: Date.now() });
            return result;
          }
        }
      }
    }

    // If not found in recent RSS items, fallback to direct date web page on xskt.com.vn
    const dateParts = targetDate.split("/");
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10);
      const year = dateParts[2];
      const webSlug = station.webSlug || station.code;
      const webUrl = `https://xskt.com.vn/${webSlug}/ngay-${day}-${month}-${year}`;

      try {
        const webRes = await fetchFn(webUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          redirect: "follow",
        });
        if (webRes.ok) {
          const webHtml = await webRes.text();
          const webPrizes = parseXsktHtmlResult(webHtml);
          if (Object.keys(webPrizes).length > 0) {
            const result: LotteryResultData = {
              stationCode: station.code,
              stationName: station.name,
              region: station.region,
              date: targetDate,
              prizes: webPrizes,
            };

            resultCache.set(cacheKey, { data: result, cachedAt: Date.now() });
            return result;
          }
        }
      } catch {
        // Fallback error ignored
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parses prizes from an HTML result box on xskt.com.vn (useful for historical draws).
 */
export function parseXsktHtmlResult(html: string): Record<string, string[]> {
  const prizes: Record<string, string[]> = {};
  const boxMatch = html.match(/<div class="box-ketqua">[\s\S]*?<\/table>/);
  if (!boxMatch) return prizes;

  const rowRegex = /<tr><td[^>]*>(?:G|Giải\s*)?([0-9]|ĐB|db)<\/td><td[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(boxMatch[0])) !== null) {
    const key = m[1].toUpperCase();
    const rawNumbers = m[2].replace(/<[^>]+>/g, " ");
    const numbers = rawNumbers.split(/\s+/).map((n) => n.replace(/\D/g, "")).filter(Boolean);
    if (numbers.length > 0) {
      prizes[key] = numbers;
    }
  }
  return prizes;
}

/**
 * Core entrypoint verifying a ticket or getting results for a station.
 */
export async function checkLottery(params: {
  station: string;
  date?: string;
  ticketNumber?: string;
  fetchFn?: typeof fetch;
}): Promise<LotteryCheckResult> {
  const stationInfo = resolveStation(params.station);
  if (!stationInfo) {
    return {
      success: false,
      station: params.station,
      date: normalizeDate(params.date),
      won: false,
      prizesWon: [],
      message: `Không tìm thấy đài/tỉnh "${params.station}". Vui lòng chọn đài cụ thể (ví dụ: TP.HCM, Bình Dương, Miền Bắc, Vietlott Mega, Power...).`,
    };
  }

  const date = normalizeDate(params.date);
  const data = await fetchLotteryResults(stationInfo, date, params.fetchFn);

  if (!data) {
    return {
      success: false,
      station: stationInfo.code,
      stationName: stationInfo.name,
      region: stationInfo.region,
      date,
      ticketNumber: params.ticketNumber,
      won: false,
      prizesWon: [],
      message: `Chưa có kết quả xổ số đài ${stationInfo.name} ngày ${date}. Đài này thường quay thưởng vào lúc ${stationInfo.drawTime}. Bạn kiểm tra lại ngày mở thưởng trên vé nhé!`,
    };
  }

  // If ticket number provided, evaluate matching
  let prizesWon: PrizeMatch[] = [];
  if (params.ticketNumber && params.ticketNumber.trim()) {
    const rawTicket = params.ticketNumber.trim();
    if (stationInfo.region === "mien-bac") {
      prizesWon = checkNorthernLottery(rawTicket, data.prizes);
    } else if (stationInfo.region === "mien-nam" || stationInfo.region === "mien-trung") {
      prizesWon = checkSouthernCentralLottery(rawTicket, data.prizes);
    } else if (stationInfo.region === "vietlott") {
      const numbers = data.prizes["Jackpot"] || [];
      prizesWon = checkVietlottLottery(
        rawTicket,
        stationInfo.code as "mega645" | "power655",
        numbers,
        data.specialBonusNumber,
      );
    }
  }

  const won = prizesWon.length > 0;
  let summaryMessage = "";

  if (!params.ticketNumber) {
    summaryMessage = `Đã tra cứu xong kết quả đài ${stationInfo.name} ngày ${date}.`;
  } else if (won) {
    const prizeSummary = prizesWon.map((p) => `${p.prizeName} (${p.prizeAmount})`).join(", ");
    summaryMessage = `CHÚC MỪNG! Vé số ${params.ticketNumber} của bạn đã TRÚNG: ${prizeSummary}!`;
  } else {
    summaryMessage = `Rất tiếc, vé số ${params.ticketNumber} (đài ${stationInfo.name}, ngày ${date}) chưa trúng thưởng lần này. Chúc bạn may mắn lần sau nhé!`;
  }

  return {
    success: true,
    station: stationInfo.code,
    stationName: stationInfo.name,
    region: stationInfo.region,
    date,
    ticketNumber: params.ticketNumber,
    won,
    prizesWon,
    fullPrizes: data.prizes,
    message: summaryMessage,
  };
}

/**
 * Creates the lottery checking tool for the AI SDK.
 */
export function createLotteryTool(fetchFn: typeof fetch = fetch) {
  const lottery_check = tool({
    description:
      "Tra cứu kết quả xổ số Việt Nam (Xổ số kiến thiết Miền Bắc, Miền Nam, Miền Trung và Vietlott Mega 6/45, Power 6/55) và tự động so khớp vé số xem có trúng giải không. Nhận diện các đài tỉnh (TP.HCM, Bình Dương, Đồng Nai, Tiền Giang, Đà Lạt, Hà Nội, v.v.), ngày mở thưởng và dãy số vé.",
    inputSchema: z.object({
      station: z
        .string()
        .describe("Tên đài hoặc tỉnh thành mở thưởng (ví dụ: 'TP.HCM', 'Bình Dương', 'Miền Bắc', 'Tiền Giang', 'Đà Lạt', 'Vietlott Mega', 'Power')"),
      date: z
        .string()
        .optional()
        .describe("Ngày mở thưởng trên vé (định dạng DD/MM/YYYY hoặc YYYY-MM-DD). Nếu không có, mặc định là ngày hôm nay."),
      ticketNumber: z
        .string()
        .optional()
        .describe("Dãy số vé dự thưởng cần dò (ví dụ: '750136' đối với Miền Nam/Trung, '12554' đối với Miền Bắc, hoặc '02 04 13 25 31 39' đối với Vietlott)"),
    }),
    execute: async ({ station, date, ticketNumber }): Promise<LotteryCheckResult> => {
      try {
        return await checkLottery({
          station,
          date,
          ticketNumber,
          fetchFn,
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          station,
          date: date || "",
          ticketNumber,
          won: false,
          prizesWon: [],
          message: `Lỗi khi tra cứu kết quả xổ số: ${errMsg}`,
        };
      }
    },
  });

  return { lottery_check };
}
