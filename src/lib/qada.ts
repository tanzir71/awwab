import { addDays } from "./dates";
import { prayerIds } from "@/types/Prayer";

export function estimateQada(years: number, alreadyPrayed: number) {
  const days = Math.round(Math.max(0, years) * 365.2425);
  const prayed = Math.max(0, Math.floor(alreadyPrayed));
  const missed = Math.max(0, days * prayerIds.length - prayed);
  const each = Math.floor(missed / prayerIds.length);
  const remainder = missed % prayerIds.length;
  return Object.fromEntries(prayerIds.map((id, i) => [id, each + Number(i < remainder)]));
}

export function finishQada(today: string, remaining: number, perDay: number) {
  return remaining > 0 && perDay > 0 ? addDays(today, Math.ceil(remaining / perDay) - 1) : null;
}

export const qadaDefaults = {
  estimated: Object.fromEntries(prayerIds.map(id => [id, 0])),
  madeUp: Object.fromEntries(prayerIds.map(id => [id, 0])),
  dailyGoal: 3, fasts: 0, fastsMadeUp: 0,
};
