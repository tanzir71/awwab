import { addDays } from "./dates";
import { schedule } from "./prayerServices";
import { prayerIds } from "@/types/Prayer";
import type { Settings } from "./storageService";
import { calendarEventById, calendarEvents, eventMoonReminder, moonWatchDay, type CalendarEvent, type CalendarSettings } from "./hijri";
import { downloadFile } from "./download";
import { message } from "./copy";
import { planAuthorities, planEventLabels, planMonth } from "./plan-copy";
import { prayerCityLabel } from "./settings-copy";

interface CalendarItem { id: string; title: string; start: Date | string; alarm?: number; description?: string }
const escapeText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[;,]/g, "\\$&");
const instant = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, "");

function fold(line: string) {
  const encoder = new TextEncoder();
  let result = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { result += "\r\n "; bytes = 1; }
    result += char;
    bytes += size;
  }
  return result;
}

export function calendarFile(items: CalendarItem[], now = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Awwab//Reminders//EN", "CALSCALE:GREGORIAN"];
  for (const item of items) {
    lines.push("BEGIN:VEVENT", `UID:${item.id}@awwab`, `DTSTAMP:${instant(now)}`,
      typeof item.start === "string" ? `DTSTART;VALUE=DATE:${item.start.replace(/-/g, "")}` : `DTSTART:${instant(item.start)}`,
      `SUMMARY:${escapeText(item.title)}`);
    if (item.description) lines.push(`DESCRIPTION:${escapeText(item.description)}`);
    if (item.alarm !== undefined) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:-PT${item.alarm}M`, `DESCRIPTION:${escapeText(item.title)}`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  return [...lines, "END:VCALENDAR", ""].map(fold).join("\r\n");
}

export function saveCalendar(items: CalendarItem[], file = "awwab-reminders.ics") {
  downloadFile(new Blob([calendarFile(items)], { type: "text/calendar;charset=utf-8" }), file);
}

export function prayerReminders(day: string, settings: Settings, days: number, alarm: number) {
  const t = message.bind(null, { ...settings, pseudoLocale: undefined });
  const description = t("settingsCalendarPrayerCity", { city: prayerCityLabel(settings.city, t) });
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(day, i);
    const times = schedule(date, settings.city, settings.method, settings.school);
    return prayerIds.filter(id => Number.isFinite(times[id].valueOf())).map(id => ({
      id: `prayer-${date}-${id}`, title: t("settingsCalendarPrayerTitle", { name: t(id) }),
      start: times[id], alarm, description,
    }));
  }).flat();
}

export function eventReminders(day: string, settings: Settings, calendar: CalendarSettings) {
  const t = message.bind(null, { ...settings, pseudoLocale: undefined });
  const localized = settings.language !== "en";
  const end = addDays(day, 365);
  const events = calendarEvents(day, end, settings.hijriAdjust, calendar).filter(event => event.kind !== "weekly");
  const customStarts = new Set([
    ...calendar.anchors.map(anchor => `${anchor.year}-${anchor.month}-start`),
    ...Object.keys(calendar.overrides).filter(id => id.endsWith("-start")),
    ...Object.keys(calendar.moonReminders ?? {}).filter(id => id.endsWith("-start") && calendar.moonReminders[id]),
  ]);
  const additional = [...customStarts].map(id => calendarEventById(id, settings.hijriAdjust, calendar))
    .filter((event): event is CalendarEvent => !!event && event.dates.some(date => date >= day && date <= end));
  const distinct = new Map([...events, ...additional].map(event => [event.id, event]));
  return [...distinct.values()].flatMap(event => {
    const [name, , note] = localized ? planEventLabels(event, settings.language, t) : [event.title];
    const title = event.confirmed ? name : t("settingsCalendarExpected", { event: name });
    const authority = localized && planAuthorities.find(option => option.value === event.source);
    const confirmation = authority ? t(authority.label) : event.source;
    const description = [note, event.confirmed ? confirmation : t("settingsCalendarEstimate")].filter(Boolean).join("\n") || undefined;
    const entries: CalendarItem[] = event.dates.map((date, i) => ({
      id: `event-${event.id}-${i}`, title, start: date, description,
    }));
    if (eventMoonReminder(event, calendar)) {
      const watch = moonWatchDay(event.year, event.month, settings.hijriAdjust, calendar.anchors);
      const reminder = crescentReminder(watch, settings, event.year, event.month);
      if (watch >= day && reminder) entries.push(reminder);
    }
    return entries;
  });
}

export function crescentReminder(day: string, settings: Settings, year: number, month: number): CalendarItem | undefined {
  const start = schedule(day, settings.city, settings.method, settings.school).maghrib;
  if (!Number.isFinite(start.valueOf())) return undefined;
  const title = message({ ...settings, pseudoLocale: undefined }, "settingsCalendarMoonTitle", {
    month: planMonth(month, settings.language),
  });
  return { id: `moon-watch-${year}-${month}`, title, start, alarm: 0 };
}
