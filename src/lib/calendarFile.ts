import { addDays } from "./dates";
import { schedule } from "./prayerServices";
import { prayerIds, prayerNames } from "@/types/Prayer";
import type { Settings } from "./storageService";
import { calendarEventById, calendarEvents, eventMoonReminder, hijriMonths, moonWatchDay, type CalendarEvent, type CalendarSettings } from "./hijri";
import { downloadFile } from "./download";

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
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(day, i);
    const times = schedule(date, settings.city, settings.method, settings.school);
    return prayerIds.filter(id => Number.isFinite(times[id].valueOf())).map(id => ({
      id: `prayer-${date}-${id}`, title: `${prayerNames[id]} prayer`, start: times[id], alarm,
      description: `Calculated on device for ${settings.city.name}.`,
    }));
  }).flat();
}

export function eventReminders(day: string, settings: Settings, calendar: CalendarSettings) {
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
    const entries: CalendarItem[] = event.dates.map((date, i) => ({
      id: `event-${event.id}-${i}`,
      title: event.confirmed ? event.title : `Expected: ${event.title}`,
      start: date,
      description: event.confirmed ? event.source : "Estimated Hijri date. Check your local moon-sighting announcement.",
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
  return { id: `moon-watch-${year}-${month}`, title: `Check the moon for ${hijriMonths[month - 1]}`, start, alarm: 0 };
}
