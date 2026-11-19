import { addDays } from "./dates";
import source from "../../docs/content/islamic-events.json";

export interface MonthAnchor { year: number; month: number; date: string; source: string }
export const hijriMonths = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Akhir", "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Shaʿban", "Ramadan", "Shawwal", "Dhu al-Qaʿdah", "Dhu al-Hijjah"];
const formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { timeZone: "UTC", day: "numeric", month: "numeric", year: "numeric" });
const ordinal = (year: number, month: number) => year * 12 + month - 1;

export function rawHijri(day: string) {
  const parts = formatter.formatToParts(new Date(`${day}T12:00:00Z`));
  const get = (key: string) => Number(parts.find(part => part.type === key)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const baselineStarts = new Map<number, string>();
export function baselineMonthStart(year: number, month: number) {
  const key = ordinal(year, month);
  let result = baselineStarts.get(key);
  if (!result) {
    const approximate = Date.UTC(2020, 7, 20) / 86400000 + (key - ordinal(1442, 1)) * 29.530588;
    let low = Math.floor(approximate - 12);
    let high = Math.ceil(approximate + 12);
    const toDay = (value: number) => new Date(value * 86400000).toISOString().slice(0, 10);
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const value = rawHijri(toDay(mid));
      if (ordinal(value.year, value.month) < key) low = mid + 1;
      else high = mid;
    }
    result = toDay(low);
    baselineStarts.set(key, result);
  }
  return result;
}

function dayDifference(a: string, b: string) {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
}

export function monthStart(year: number, month: number, adjust: number, anchors: MonthAnchor[]) {
  const key = ordinal(year, month);
  const anchor = anchors
    .filter(item => ordinal(item.year, item.month) <= key)
    .sort((a, b) => ordinal(b.year, b.month) - ordinal(a.year, a.month))[0];
  const baseline = baselineMonthStart(year, month);
  const shift = anchor ? dayDifference(anchor.date, baselineMonthStart(anchor.year, anchor.month)) : -adjust;
  const confirmed = anchor?.year === year && anchor.month === month;
  return { date: addDays(baseline, shift), confirmed, source: confirmed ? anchor.source : undefined };
}

export function hijriOn(day: string, adjust = 0, anchors: MonthAnchor[] = []) {
  const guess = rawHijri(day);
  const key = ordinal(guess.year, guess.month);
  for (let month = key + 1; month >= key - 1; month--) {
    const year = Math.floor(month / 12);
    const number = month % 12 + 1;
    const start = monthStart(year, number, adjust, anchors).date;
    if (start <= day) return { year, month: number, day: dayDifference(day, start) + 1 };
  }
  return guess;
}

export function hijriLabel(day: string, adjust = 0, anchors: MonthAnchor[] = []) {
  const hijri = hijriOn(day, adjust, anchors);
  return `${hijri.day} ${hijriMonths[hijri.month - 1]} ${hijri.year}`;
}

export interface EventOverride { date?: string; source?: string; adjust: -1 | 0 | 1 }
export interface CalendarSettings { anchors: MonthAnchor[]; overrides: Record<string, EventOverride> }
export const calendarDefaults: CalendarSettings = { anchors: [], overrides: {} };

export function calendarEvents(start: string, end: string, adjust: number, config = calendarDefaults) {
  const year = hijriOn(addDays(start, -1), adjust, config.anchors).year;
  const endYear = hijriOn(end, adjust, config.anchors).year;
  const events = [];
  for (let y = year; y <= endYear; y++) {
    for (const [index, item] of source.events.entries()) {
      if (item.kind === "weekly") continue;
      const months = item.hijriMonth ? [item.hijriMonth] : hijriMonths.map((_, i) => i + 1);
      for (const month of months) {
        const id = `${y}-${month}-${index}`;
        const anchor = monthStart(y, month, adjust, config.anchors);
        const override = config.overrides[id];
        const first = override?.date ?? addDays(anchor.date, item.hijriDay - 1 + (override?.adjust ?? 0));
        const confirmed = anchor.confirmed || !!override?.date;
        const dates = confirmed ? [first] : [first, addDays(first, 1)];
        if (dates.some(day => day >= start && day <= end)) events.push({ ...item, id, year: y, month, dates, confirmed, source: override?.source ?? anchor.source });
      }
    }
  }
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday === 1 || weekday === 4) {
      const date = hijriOn(day, adjust, config.anchors);
      events.push({ label: "Monday and Thursday", title: "Sunnah fasts", kind: "weekly", hijriDay: date.day, hijriMonth: date.month, id: `weekly-${day}`, year: date.year, month: date.month, dates: [day], confirmed: true, source: undefined });
    }
  }
  return events.sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
}
