export const prayerIds = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerId = typeof prayerIds[number];

export const prayerNames: Record<PrayerId, string> = {
  fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha",
};

export type PrayerStatus = "upcoming" | "now" | "done" | "late" | "missed" | "qada";

export const prayerStatusNames: Record<PrayerStatus, string> = {
  upcoming: "Upcoming", now: "Now", done: "Prayed on time", late: "Prayed late", missed: "Make up now", qada: "Made up",
};

export interface PrayerLog {
  date: string;
  prayer: PrayerId;
  status: "done" | "late" | "qada";
  at: string;
  mosqueId?: string;
}

export interface RakatGroup {
  type: string;
  count: number;
  emphasis?: string;
  recitation?: string;
  note?: string;
}

export interface Prayer {
  id: PrayerId;
  name: string;
  date: string;
  starts: Date;
  ends: Date;
  status: PrayerStatus;
  rakats: RakatGroup[];
}
