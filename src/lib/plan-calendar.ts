import { addDays } from "./dates";
import { calendarEvents, dayDifference, hijriOn, monthStartEvent, type CalendarEvent, type CalendarSettings } from "./hijri";
import { assignedMosque, mosqueWeekday, type MosquePlan } from "./mosques";

// CLDR 48 first-day exceptions to the Monday default. See public/app/cldr-week-data-notice.txt.
const sundayRegions = new Set([
  "AG", "AS", "BD", "BR", "BS", "BT", "BW", "BZ", "CA", "CO", "DM", "DO", "ET", "GT", "GU", "HK", "HN", "ID", "IL",
  "IN", "IS", "JM", "JP", "KE", "KH", "KR", "LA", "MH", "MM", "MO", "MT", "MX", "MZ", "NI", "NP", "PA", "PE", "PH",
  "PK", "PR", "PT", "PY", "SA", "SG", "SV", "TH", "TT", "TW", "UM", "US", "VE", "VI", "WS", "YE", "ZA", "ZW",
]);
const saturdayRegions = new Set(["AF", "BH", "DJ", "DZ", "EG", "IQ", "IR", "JO", "KW", "LY", "OM", "QA", "SD", "SY"]);

export function calendarMonthOn(day: string, offset = 0) {
  const date = new Date(day.slice(0, 7) + "-01T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function gregorianMonthBounds(month: string) {
  return { first: month + "-01", last: addDays(calendarMonthOn(month, 1) + "-01", -1) };
}

export function readCalendarMonth(value: string | null, today: string) {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    value >= calendarMonthOn(today, -48) && value <= calendarMonthOn(today, 48)) return value;
  return calendarMonthOn(today);
}

export function readCalendarDay(value: string | null, today: string) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value) ||
    value.slice(0, 7) < calendarMonthOn(today, -49) || value.slice(0, 7) > calendarMonthOn(today, 49)) return undefined;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}

export function calendarWeekStart(language: string, zone: string, preferred: readonly string[]) {
  if (zone === "Asia/Dhaka" || language === "bn") return 0;
  const tag = preferred.find(locale => locale.split("-")[0] === language) ?? language;
  const locale = new Intl.Locale(tag) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
    weekInfo?: { firstDay: number };
  };
  const first = locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay;
  if (first !== undefined) return first % 7;
  const region = locale.maximize().region;
  if (sundayRegions.has(region)) return 0;
  if (saturdayRegions.has(region)) return 6;
  return region === "MV" ? 5 : 1;
}

export function monthStartsInRange(first: string, last: string, adjustment: number, config: CalendarSettings) {
  const ordinal = (day: string) => {
    const date = hijriOn(day, adjustment, config.anchors);
    return date.year * 12 + date.month - 1;
  };
  const start = ordinal(addDays(first, -3));
  const end = ordinal(addDays(last, 3));
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const month = start + i;
    return monthStartEvent(Math.floor(month / 12), month % 12 + 1, adjustment, config);
  }).filter(event => event.dates.some(day => day >= first && day <= last));
}

function eventsByDay(first: string, last: string, adjustment: number, config: CalendarSettings) {
  const starts = monthStartsInRange(first, last, adjustment, config);
  const observances = calendarEvents(addDays(first, -2), last, adjustment, config).filter(event => event.kind !== "weekly");
  const events = new Map([...observances, ...starts].map(event => [event.id, event]));
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events.values()) {
    const dates = event.title.startsWith("White days") ? event.dates.flatMap(day => [day, addDays(day, 1), addDays(day, 2)]) : event.dates;
    for (const day of new Set(dates)) {
      const cell = byDay.get(day) ?? [];
      cell.push(event);
      byDay.set(day, cell);
    }
  }
  return byDay;
}

export function calendarDayEvents(day: string, adjustment: number, config: CalendarSettings) {
  return eventsByDay(day, day, adjustment, config).get(day) ?? [];
}

export function gregorianMonthCells(month: string, firstWeekday: number, adjustment: number, config: CalendarSettings) {
  const { first, last } = gregorianMonthBounds(month);
  const before = (mosqueWeekday(first) + 7 - firstWeekday) % 7;
  const after = (firstWeekday + 6 - mosqueWeekday(last) + 7) % 7;
  const start = addDays(first, -before);
  const end = addDays(last, after);
  const events = eventsByDay(start, end, adjustment, config);
  return Array.from({ length: dayDifference(end, start) + 1 }, (_, i) => {
    const day = addDays(start, i);
    return { day, weekday: mosqueWeekday(day), adjacent: day.slice(0, 7) !== month,
      hijri: hijriOn(day, adjustment, config.anchors), events: events.get(day) ?? [] };
  });
}

export function fridayMosque(plan: MosquePlan) {
  const assigned = assignedMosque(5, "dhuhr", plan);
  if (assigned) return assigned;
  const friday = plan.mosques.filter(mosque => mosque.role === "jumuah" && mosque.jumuah?.prayer);
  return friday.length === 1 ? friday[0] : undefined;
}

export function shiftPlanEvent(config: CalendarSettings, id: string, step: -1 | 1): CalendarSettings {
  const old = config.overrides[id];
  const overrides = { ...config.overrides };
  if (old?.adjust === step && !old.date && !old.source) delete overrides[id];
  else overrides[id] = { ...old, adjust: old?.adjust === step ? 0 : step };
  return { ...config, overrides };
}
