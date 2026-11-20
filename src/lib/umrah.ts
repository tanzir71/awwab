import { dateKey } from "./dates";
import { cities, currentPrayerSchedule, schedule } from "./prayerServices";

export const makkah = cities.find(city => city.name === "Makkah");
export const madinah = cities.find(city => city.name === "Madinah");
export const states = ["At the hotel", "Walking", "In the Haram", "Doing Umrah", "Resting", "Eating out"] as const;
export type TripState = typeof states[number];
export type Coord = { lat: number; lon: number };
export type SaiEnd = "safa" | "marwah";
export type SaiProgress = { count: number; last?: SaiEnd; lastAt?: number; exited: boolean; detected?: boolean };
export type SaiCourse = Readonly<Record<SaiEnd, Coord>>;
export const initialSai: SaiProgress = { count: 0, exited: true };
export const tripChecklist = ["passport", "rawdah", "ihram", "toiletries", "sandals", "shoeBag",
  "talbiyah", "miqat", "phrases", "rituals", "duas", "family"] as const;
export type TripCheck = typeof tripChecklist[number];
export const emptyPreparation = {
  hotelArabic: "", hotelAddress: "", leader: "", phone: "", makkahNights: undefined as number | undefined,
  madinahNights: undefined as number | undefined, completed: [] as TripCheck[],
};

export const initialTrip = {
  start: "", end: "", hotel: { name: "", room: "", point: undefined as Coord | undefined }, group: "",
  meeting: undefined as Coord | undefined, gate: "", state: "At the hotel" as TripState,
  walk: 10, crowd: 20, iqamah: 15, gps: false, auto: false,
  tawaf: 0, step: 0, sai: initialSai, saiPaused: false, dhikr: {} as Record<string, number>,
  juz: {} as Record<string, number>, haramPrayers: {} as Record<string, string[]>,
  requests: [] as { id: string; name: string; for: string; done: string[] }[],
  preparation: undefined as typeof emptyPreparation | undefined,
};
export type UmrahTrip = typeof initialTrip;

export function maskedPhone(phone: string) {
  let digits = 0;
  return phone.replace(/\p{Nd}/gu, digit => ++digits <= 4 ? digit : "•");
}

export function tripDates(trip: Pick<UmrahTrip, "start" | "end">, locale: string) {
  if (!trip.start || !trip.end || trip.start > trip.end) return undefined;
  const start = new Date(`${trip.start}T12:00Z`);
  const end = new Date(`${trip.end}T12:00Z`);
  if (!Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf())) return undefined;
  const format: Intl.DateTimeFormat & { formatRange?: (start: Date, end: Date) => string } = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale,
    { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
  return format.formatRange?.(start, end) ?? (trip.start === trip.end ? format.format(start) : `${format.format(start)} – ${format.format(end)}`);
}

const radians = (degrees: number) => degrees * Math.PI / 180;

export function distance(a: Coord, b: Coord) {
  const lat = radians(b.lat - a.lat);
  const lon = radians(b.lon - a.lon);
  const chord = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(chord)));
}

export function bearing(a: Coord, b: Coord) {
  const lon = radians(b.lon - a.lon);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const angle = Math.atan2(Math.sin(lon) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon));
  return (angle * 180 / Math.PI + 360) % 360;
}

export function saiLapEnds(lap: number): { from: SaiEnd; to: SaiEnd } {
  return lap % 2 === 1 ? { from: "safa", to: "marwah" } : { from: "marwah", to: "safa" };
}

export function saiGuidePosition(course: SaiCourse, point: Coord, destination: SaiEnd) {
  const { safa, marwah } = course;
  const length = distance(safa, marwah);
  if (!Number.isFinite(length) || length <= 0) return undefined;
  const angle = radians(bearing(safa, point) - bearing(safa, marwah));
  const fromSafa = distance(safa, point);
  const along = fromSafa * Math.cos(angle);
  const across = fromSafa * Math.sin(angle);
  const nearest = Math.max(0, Math.min(length, along));
  if (!Number.isFinite(along) || Math.hypot(across, along - nearest) > 60) return undefined;
  return { fraction: nearest / length, meters: distance(point, course[destination]) };
}

export function advanceSai(progress: SaiProgress, zone: SaiEnd | undefined, at: number, betweenZones: number): SaiProgress {
  if (progress.count >= 7) return progress;
  if (!zone) return progress.exited ? progress : { ...progress, exited: true };
  if (!progress.last) return zone === "safa" ? { ...progress, last: zone, lastAt: at, exited: false } : progress;
  if (zone === progress.last || !progress.exited || at - (progress.lastAt ?? at) < 60_000 || betweenZones < 300) return progress;
  return { count: progress.count + 1, last: zone, lastAt: at, exited: false, detected: true };
}

export function correctSai(progress: SaiProgress, count: number, at: number): SaiProgress {
  const next = Math.max(0, Math.min(7, count));
  return next === progress.count ? progress : { count: next, last: saiLapEnds(next).to, lastAt: at, exited: false };
}

export function umrahContext(now: Date, trip: typeof initialTrip) {
  const { day, current, next } = currentPrayerSchedule(makkah, "UmmAlQura", "shafi", now);
  const times = schedule(day, makkah, "UmmAlQura", "shafi");
  const friday = new Date(`${next.date}T12:00:00Z`).getUTCDay() === 5;
  const leave = new Date(next.starts.valueOf() - (trip.walk + trip.crowd + (friday ? 10 : 0)) * 60_000);
  const iqamah = current && new Date(current.starts.valueOf() + trip.iqamah * 60_000);
  const duha = new Date(times.sunrise.valueOf() + 20 * 60_000);
  const tripActive = (!trip.start || day >= trip.start) && (!trip.end || day <= trip.end);
  const tahajjud = new Date(next.id === "fajr" ? next.starts.valueOf() - 60 * 60_000 : times.fajr.valueOf() - 60 * 60_000);
  return { day: dateKey(now, makkah.timeZone), current, next, leave, iqamah, duha, tripActive, tahajjud, times };
}
