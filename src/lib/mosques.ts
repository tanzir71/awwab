import { addDays, formatTime } from "./dates";
import { type Prayer, type PrayerId } from "@/types/Prayer";

export const mosqueRoles = ["home", "office", "jumuah", "eid", "hometown", "other"] as const;
export const mosqueSources = ["board photo", "imam", "friend", "visited"] as const;
export const mosqueWeek = [[0, 1, 2, 3, 4], [5, 6]] as const;
export const mosqueOccasions = ["eid_fitr", "eid_adha", "tarawih"] as const;
export const mosquePhotoTypes = ["image/jpeg", "image/png", "image/webp"];
export const mosquePhotoLimit = 2_000_000;

export interface MosqueOccasion {
  type: typeof mosqueOccasions[number];
  times: string[];
  year: number;
}

export interface Mosque {
  id: string;
  name: string;
  role: typeof mosqueRoles[number];
  jamaat: Partial<Record<PrayerId, string>>;
  jumuah?: { khutbah: string; prayer: string };
  occasional: MosqueOccasion[];
  source: typeof mosqueSources[number];
  updatedAt: string;
  photo?: Blob | string;
  refreshMonth?: number;
  contact?: string;
  location?: { lat: number; lon: number };
}

export interface MosquePlan { mosques: Mosque[]; mapping: Record<string, string> }
export const mosqueDefaults: MosquePlan = { mosques: [], mapping: {} };

export function mosqueWeekday(day: string) {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

export function mosqueClock(time: string, language: string, compact = false) {
  return formatTime(new Date(`2000-01-01T${time}:00Z`), "UTC", language, compact);
}

export function assignedMosque(weekday: number, id: PrayerId, plan: MosquePlan) {
  return plan.mosques.find(mosque => mosque.id === plan.mapping[`${weekday}-${id}`]);
}

export function mosqueForPrayer(day: string, id: PrayerId, plan: MosquePlan) {
  return assignedMosque(mosqueWeekday(day), id, plan);
}

export function mosqueTime(mosque: Mosque | undefined, id: PrayerId, weekday: number) {
  if (id === "dhuhr" && weekday === 5 && mosque?.jumuah?.prayer) return mosque.jumuah.prayer;
  return mosque?.jamaat[id];
}

export function weeklyMosque(days: readonly number[], id: PrayerId, plan: MosquePlan) {
  const assigned = days.map(day => assignedMosque(day, id, plan));
  const mosque = assigned[0];
  const differentMosques = assigned.some(item => item?.id !== mosque?.id);
  const time = mosqueTime(mosque, id, days[0]);
  const differentTimes = !differentMosques && days.some(day => mosqueTime(mosque, id, day) !== time);
  return { mosque: differentMosques ? undefined : mosque, time: differentMosques || differentTimes ? undefined : time, differentMosques, differentTimes };
}

export function mapMosque(plan: MosquePlan, days: readonly number[], id: PrayerId, mosqueId: string) {
  if (mosqueId && !plan.mosques.some(mosque => mosque.id === mosqueId)) return plan;
  const mapping = { ...plan.mapping };
  for (const day of days) {
    const key = `${day}-${id}`;
    if (mosqueId) mapping[key] = mosqueId;
    else delete mapping[key];
  }
  return { ...plan, mapping };
}

export function timetableNotice(day: string, checked: string, refreshMonth?: number, season?: "ramadan" | "eid") {
  if (refreshMonth === Number(day.slice(5, 7)) && checked.slice(0, 7) < day.slice(0, 7)) return "seasonal";
  if (season && checked < addDays(day, -30)) return season;
  if (checked < addDays(day, -120)) return "older";
  return undefined;
}

export function jamaatForPrayer(prayer: Prayer, zone: string, plan: MosquePlan) {
  const mosque = mosqueForPrayer(prayer.date, prayer.id, plan);
  const scheduled = mosqueTime(mosque, prayer.id, mosqueWeekday(prayer.date));
  if (!mosque || !scheduled) return null;
  const time = scheduled === "adhan+5" ? Number.isFinite(prayer.starts.valueOf())
    ? formatTime(new Date(prayer.starts.valueOf() + 300_000), zone) : "5 min after adhan" : scheduled;
  return { time, mosque: mosque.name, id: mosque.id };
}
