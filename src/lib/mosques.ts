import { formatTime } from "./dates";
import { type Prayer, type PrayerId } from "@/types/Prayer";

export const mosqueRoles = ["home", "office", "jumuah", "eid", "hometown", "other"] as const;
export const mosqueSources = ["board photo", "imam", "friend", "visited"] as const;
export const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface Mosque {
  id: string;
  name: string;
  role: typeof mosqueRoles[number];
  jamaat: Partial<Record<PrayerId, string>>;
  jumuah?: { khutbah: string; prayer: string };
  occasional: Array<{ type: "eid_fitr" | "eid_adha" | "tarawih"; times: string[]; year: number }>;
  source: typeof mosqueSources[number];
  updatedAt: string;
  photo?: string;
  contact?: string;
  location?: { lat: number; lon: number };
}

export interface MosquePlan { mosques: Mosque[]; mapping: Record<string, string> }
export const mosqueDefaults: MosquePlan = { mosques: [], mapping: {} };

export function mosqueForPrayer(day: string, id: PrayerId, plan: MosquePlan) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return plan.mosques.find(mosque => mosque.id === plan.mapping[`${weekday}-${id}`]);
}

export function jamaatForPrayer(prayer: Prayer, zone: string, plan: MosquePlan) {
  const mosque = mosqueForPrayer(prayer.date, prayer.id, plan);
  const scheduled = mosque?.jamaat[prayer.id];
  if (!mosque || !scheduled) return null;
  const time = scheduled === "adhan+5" ? Number.isFinite(prayer.starts.valueOf())
    ? formatTime(new Date(prayer.starts.valueOf() + 300_000), zone) : "5 min after adhan" : scheduled;
  return { time, mosque: mosque.name, id: mosque.id };
}
