/**
 * Vietnamese Lunar Calendar Algorithm (Ho Ngoc Duc / UTC+7)
 * Based on astronomical algorithms by Jean Meeus (1998) adapted for UTC+7 (105°E).
 */

const PI = Math.PI;

export const VIETNAM_TIME_ZONE = 7;

export type LunarDate = {
  day: number;
  month: number;
  year: number;
  isLeap: boolean;
};

export type SolarDate = {
  day: number;
  month: number;
  year: number;
};

/**
 * Discard the fractional part of a number, e.g. INT(3.2) = 3
 */
function INT(d: number): number {
  return Math.floor(d);
}

/**
 * Compute the Julian day number of day dd/mm/yyyy.
 */
export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

/**
 * Convert Julian day number to day/month/year.
 */
export function jdToDate(jd: number): SolarDate {
  let a: number;
  let b: number;
  let c: number;
  if (jd > 2299160) {
    a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  const day = e - INT((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * INT(m / 10);
  const year = b * 100 + d - 4800 + INT(m / 10);
  return { day, month, year };
}

/**
 * Compute the time of the k-th new moon after the new moon of 1/1/1900 13:52 UTC.
 */
export function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;

  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));

  let deltat: number;
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  return Jd1 + C1 - deltat;
}

/**
 * Compute the longitude of the sun at any time.
 */
export function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - PI * 2 * INT(L / (PI * 2));
  return L;
}

/**
 * Compute sun position at midnight of the day with the given Julian day number.
 */
export function getSunLongitude(dayNumber: number, timeZone = VIETNAM_TIME_ZONE): number {
  return INT((sunLongitude(dayNumber - 0.5 - timeZone / 24) / PI) * 6);
}

/**
 * Compute the day of the k-th new moon in the given time zone.
 */
export function getNewMoonDay(k: number, timeZone = VIETNAM_TIME_ZONE): number {
  return INT(newMoon(k) + 0.5 + timeZone / 24);
}

/**
 * Find the day that starts the lunar month 11 of the given year for the given time zone.
 */
export function getLunarMonth11(yy: number, timeZone = VIETNAM_TIME_ZONE): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

/**
 * Find the index of the leap month after the month starting on the day a11.
 */
export function getLeapMonthOffset(a11: number, timeZone = VIETNAM_TIME_ZONE): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

/**
 * Convert solar date (day, month, year) to corresponding lunar date.
 */
export function solarToLunar(
  solarDay: number,
  solarMonth: number,
  solarYear: number,
  timeZone = VIETNAM_TIME_ZONE,
): LunarDate {
  const dayNumber = jdFromDate(solarDay, solarMonth, solarYear);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  let a11 = getLunarMonth11(solarYear, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = solarYear;
    a11 = getLunarMonth11(solarYear - 1, timeZone);
  } else {
    lunarYear = solarYear + 1;
    b11 = getLunarMonth11(solarYear + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let lunarLeap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = true;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth = lunarMonth - 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return {
    day: lunarDay,
    month: lunarMonth,
    year: lunarYear,
    isLeap: lunarLeap,
  };
}

/**
 * Returns the number of days in a given lunar month (29 or 30).
 * Returns 0 if the specified leap month does not exist in the given year.
 */
export function getDaysInLunarMonth(
  lunarMonth: number,
  lunarYear: number,
  isLeap = false,
  timeZone = VIETNAM_TIME_ZONE,
): number {
  let a11: number;
  let b11: number;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, timeZone);
    b11 = getLunarMonth11(lunarYear, timeZone);
  } else {
    a11 = getLunarMonth11(lunarYear, timeZone);
    b11 = getLunarMonth11(lunarYear + 1, timeZone);
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarMonth - 11;
  if (off < 0) {
    off += 12;
  }
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    let leapMonth = leapOff - 2;
    if (leapMonth <= 0) {
      leapMonth += 12;
    }
    if (isLeap && lunarMonth !== leapMonth) {
      return 0;
    } else if (isLeap || off >= leapOff) {
      off += 1;
    }
  } else if (isLeap) {
    return 0;
  }
  const monthStart = getNewMoonDay(k + off, timeZone);
  const nextMonthStart = getNewMoonDay(k + off + 1, timeZone);
  return nextMonthStart - monthStart;
}

/**
 * Returns the lunar leap month for a given year (1..12), or 0 if the year has no leap month.
 */
export function getLeapMonth(lunarYear: number, timeZone = VIETNAM_TIME_ZONE): number {
  const a11 = getLunarMonth11(lunarYear - 1, timeZone);
  const b11 = getLunarMonth11(lunarYear, timeZone);
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    let leapMonth = leapOff - 2;
    if (leapMonth <= 0) {
      leapMonth += 12;
    }
    return leapMonth;
  }
  return 0;
}

/**
 * Convert a lunar date (day, month, year, isLeap) to corresponding solar date.
 * Automatically canonicalizes/clamps the lunar day to the end of the month if it exceeds the month's length.
 * If the leap month is invalid for the specified year, falls back to the regular month.
 */
export function lunarToSolar(
  lunarDay: number,
  lunarMonth: number,
  lunarYear: number,
  isLeap = false,
  timeZone = VIETNAM_TIME_ZONE,
): SolarDate {
  let effectiveLeap = isLeap;
  let daysInMonth = getDaysInLunarMonth(lunarMonth, lunarYear, effectiveLeap, timeZone);
  if (daysInMonth === 0 && effectiveLeap) {
    // If leap month requested but this year has no such leap month, fallback to regular month
    effectiveLeap = false;
    daysInMonth = getDaysInLunarMonth(lunarMonth, lunarYear, false, timeZone);
  }

  // Canonicalize lunar day (clamp to 1..daysInMonth)
  const clampedDay = Math.min(Math.max(1, lunarDay), daysInMonth > 0 ? daysInMonth : 30);

  let a11: number;
  let b11: number;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, timeZone);
    b11 = getLunarMonth11(lunarYear, timeZone);
  } else {
    a11 = getLunarMonth11(lunarYear, timeZone);
    b11 = getLunarMonth11(lunarYear + 1, timeZone);
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarMonth - 11;
  if (off < 0) {
    off += 12;
  }
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    let leapMonth = leapOff - 2;
    if (leapMonth <= 0) {
      leapMonth += 12;
    }
    if (effectiveLeap || off >= leapOff) {
      off += 1;
    }
  }
  const monthStart = getNewMoonDay(k + off, timeZone);
  return jdToDate(monthStart + clampedDay - 1);
}
