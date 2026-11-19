import { addDays, formatDay } from "./dates";
import source from "../../docs/content/islamic-events.json";

export interface MonthAnchor { year: number; month: number; date: string; source: string }
export const hijriMonths = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Akhir", "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Shaʿban", "Ramadan", "Shawwal", "Dhu al-Qaʿdah", "Dhu al-Hijjah"];
export const hijriMonthsBn = ["মুহাররম", "সফর", "রবিউল আউয়াল", "রবিউস সানি", "জমাদিউল আউয়াল", "জমাদিউস সানি", "রজব", "শাবান", "রমজান", "শাওয়াল", "জিলকদ", "জিলহজ"];
const formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { timeZone: "UTC", day: "numeric", month: "numeric", year: "numeric" });
const ordinal = (year: number, month: number) => year * 12 + month - 1;

export function rawHijri(day: string) {
  const parts = formatter.formatToParts(new Date(`${day}T12:00:00Z`));
  const get = (key: string) => Number(parts.find(part => part.type === key)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const lastSupportedYear = rawHijri("9998-01-01").year;
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

export function dayDifference(a: string, b: string) {
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

export function hijriLabel(day: string, adjust = 0, anchors: MonthAnchor[] = [], locale = "en") {
  const hijri = hijriOn(day, adjust, anchors);
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  const months = locale.startsWith("bn") ? hijriMonthsBn : hijriMonths;
  return `${number.format(hijri.day)} ${months[hijri.month - 1]} ${number.format(hijri.year)}`;
}

export interface EventOverride { date?: string; source?: string; adjust: -1 | 0 | 1 }
export interface CalendarSettings {
  anchors: MonthAnchor[];
  overrides: Record<string, EventOverride>;
  sightingSource?: string;
  moonReminders?: Record<string, boolean>;
}
export const calendarDefaults: CalendarSettings = { anchors: [], overrides: {} };

export function moonWatchDay(year: number, month: number, adjust: number, anchors: MonthAnchor[]) {
  const previous = monthStart(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1, adjust, anchors);
  return addDays(previous.date, 28);
}

export function possibleMonthStarts(year: number, month: number, adjust: number, anchors: MonthAnchor[]) {
  const start = monthStart(year, month, adjust, anchors);
  if (start.confirmed) return [start.date];
  const watch = moonWatchDay(year, month, adjust, anchors);
  return [addDays(watch, 1), addDays(watch, 2)];
}

export type CalendarEvent = typeof source.events[number] & {
  id: string; year: number; month: number; dates: string[]; confirmed: boolean; source?: string;
};

function datedEvent(year: number, month: number, id: string, item: typeof source.events[number], adjust: number, config: CalendarSettings): CalendarEvent {
  const start = monthStart(year, month, adjust, config.anchors);
  const override = config.overrides[id];
  const offset = override?.adjust ?? 0;
  const dates = override?.date ? [addDays(override.date, offset)]
    : possibleMonthStarts(year, month, adjust, config.anchors).map(date => addDays(date, item.hijriDay - 1 + offset));
  return { ...item, id, year, month, dates, confirmed: dates.length === 1, source: override?.source ?? start.source };
}

function eventForMonth(year: number, month: number, index: number, adjust: number, config: CalendarSettings) {
  return datedEvent(year, month, `${year}-${month}-${index}`, source.events[index], adjust, config);
}

export function monthStartEvent(year: number, month: number, adjust: number, config: CalendarSettings) {
  const named = source.events.findIndex(item => item.kind === "moon" && item.hijriMonth === month && item.hijriDay === 1);
  if (named >= 0) return eventForMonth(year, month, named, adjust, config);
  return datedEvent(year, month, `${year}-${month}-start`, {
    kind: "moon", hijriDay: 1, hijriMonth: month, label: "1 " + hijriMonths[month - 1], title: hijriMonths[month - 1] + " begins",
  }, adjust, config);
}

export function calendarEventById(id: string, adjust: number, config: CalendarSettings) {
  if (!/^\d{3,4}-\d{1,2}-(?:\d{1,2}|start)$/.test(id)) return undefined;
  const [yearPart, monthPart, selector] = id.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (year < 1 || year > lastSupportedYear || month < 1 || month > 12) return undefined;
  if (selector === "start") return monthStartEvent(year, month, adjust, config);
  const index = Number(selector);
  const item = source.events[index];
  if (!item || item.kind === "weekly" || (item.hijriMonth && month !== item.hijriMonth)) return undefined;
  return eventForMonth(year, month, index, adjust, config);
}

export function calendarEvents(start: string, end: string, adjust: number, config = calendarDefaults) {
  const year = hijriOn(addDays(start, -2), adjust, config.anchors).year;
  const endYear = hijriOn(addDays(end, 2), adjust, config.anchors).year;
  const events: CalendarEvent[] = [];
  for (let y = year; y <= endYear; y++) {
    for (const [index, item] of source.events.entries()) {
      if (item.kind === "weekly") continue;
      const months = item.hijriMonth ? [item.hijriMonth] : hijriMonths.map((_, i) => i + 1);
      for (const month of months) {
        const event = eventForMonth(y, month, index, adjust, config);
        if (event.dates.some(day => day >= start && day <= end)) events.push(event);
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

export function eventMoonReminder(event: CalendarEvent, config: CalendarSettings) {
  return !event.confirmed && event.hijriDay === 1 && (config.moonReminders?.[event.id] ?? event.title === "Eid al-Fitr");
}

export function eventDisplayDates(event: CalendarEvent, language: string, separator: string) {
  const shortDate = { day: "numeric", month: "short" } as const;
  return event.dates.map(day => {
    if (!event.title.startsWith("White days")) return formatDay(day, { ...shortDate, weekday: "short" }, language);
    const end = addDays(day, 2);
    const startStyle = day.slice(0, 7) === end.slice(0, 7) ? { day: "numeric" } as const : shortDate;
    return `${formatDay(day, startStyle, language)}–${formatDay(end, shortDate, language)}`;
  }).join(separator);
}
