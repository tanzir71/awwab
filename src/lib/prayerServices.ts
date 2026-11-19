import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from "adhan";
import { addDays, dateKey } from "./dates";
import { type Prayer, type PrayerLog, prayerIds, prayerNames } from "../types/Prayer";
import structure from "../../docs/content/rakat-structure.json";

export type PrayerMethod = keyof typeof CalculationMethod;
export type AsrSchool = "hanafi" | "shafi";

export interface City {
  name: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

export const cities: City[] = [
  { name: "Dhaka", latitude: 23.8103, longitude: 90.4125, timeZone: "Asia/Dhaka" },
  { name: "Chattogram", latitude: 22.3569, longitude: 91.7832, timeZone: "Asia/Dhaka" },
  { name: "Sylhet", latitude: 24.8949, longitude: 91.8687, timeZone: "Asia/Dhaka" },
  { name: "Rajshahi", latitude: 24.3745, longitude: 88.6042, timeZone: "Asia/Dhaka" },
  { name: "Khulna", latitude: 22.8456, longitude: 89.5403, timeZone: "Asia/Dhaka" },
  { name: "Makkah", latitude: 21.3891, longitude: 39.8579, timeZone: "Asia/Riyadh" },
  { name: "Madinah", latitude: 24.4672, longitude: 39.6111, timeZone: "Asia/Riyadh" },
  { name: "Karachi", latitude: 24.8607, longitude: 67.0011, timeZone: "Asia/Karachi" },
  { name: "Kolkata", latitude: 22.5726, longitude: 88.3639, timeZone: "Asia/Kolkata" },
  { name: "London", latitude: 51.5072, longitude: -0.1276, timeZone: "Europe/London" },
  { name: "New York", latitude: 40.7128, longitude: -74.006, timeZone: "America/New_York" },
  { name: "Sydney", latitude: -33.8688, longitude: 151.2093, timeZone: "Australia/Sydney" },
];

export const methodNames: Record<PrayerMethod, string> = {
  MuslimWorldLeague: "Muslim World League",
  Egyptian: "Egyptian General Authority",
  Karachi: "Karachi",
  UmmAlQura: "Umm al-Qura",
  Dubai: "Dubai",
  MoonsightingCommittee: "Moonsighting Committee",
  NorthAmerica: "ISNA",
  Kuwait: "Kuwait",
  Qatar: "Qatar",
  Singapore: "Singapore",
  Tehran: "Tehran",
  Turkey: "Türkiye",
  Other: "Other (18° Fajr, 18° Isha)",
};

export const rakatNames: Record<string, string> = {
  sunnah: "Sunnah", fard: "Fard", nafl: "Nafl", witr: "Witr",
};

export function schedule(day: string, city: City, method: PrayerMethod, school: AsrSchool) {
  const [year, month, date] = day.split("-").map(Number);
  const params = CalculationMethod[method]();
  params.madhab = school === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  if (method === "Other") {
    params.fajrAngle = 18;
    params.ishaAngle = 18;
  }
  return new PrayerTimes(new Coordinates(city.latitude, city.longitude), new Date(year, month - 1, date, 12), params);
}

export function prayerDay(day: string, city: City, method: PrayerMethod, school: AsrSchool, now: Date, logs: PrayerLog[] = []): Prayer[] {
  const times = schedule(day, city, method, school);
  const nextFajr = schedule(addDays(day, 1), city, method, school).fajr;
  const ends = [times.sunrise, times.asr, times.maghrib, times.isha, nextFajr];
  return prayerIds.map((id, index) => {
    const starts = times[id];
    const end = ends[index];
    const log = logs.find(item => item.date === day && item.prayer === id);
    return {
      id, name: prayerNames[id], date: day, starts, ends: end,
      status: log?.status ?? (!Number.isFinite(starts.valueOf()) || !Number.isFinite(end.valueOf()) || now < starts
        ? "upcoming" : now >= end ? "missed" : "now"),
      rakats: structure.prayers[id],
    };
  });
}

export function currentPrayerSchedule(city: City, method: PrayerMethod, school: AsrSchool, now: Date, logs: PrayerLog[] = []) {
  const day = dateKey(now, city.timeZone);
  const prayers = prayerDay(day, city, method, school, now, logs);
  const yesterdayIsha = now < prayers[0].starts
    ? prayerDay(addDays(day, -1), city, method, school, now, logs)[4]
    : undefined;
  const current = [yesterdayIsha, ...prayers].find(prayer => prayer && now >= prayer.starts && now < prayer.ends);
  const next = prayers.find(prayer => now < prayer.starts)
    ?? prayerDay(addDays(day, 1), city, method, school, now, logs)[0];
  return { day, prayers, current, next };
}
