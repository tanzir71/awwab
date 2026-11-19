import { addDays, dateKey } from "./dates";
import { prayerIds, type PrayerId, type PrayerLog } from "@/types/Prayer";

export type QadaPlan = {
  estimated: Record<PrayerId, number>;
  madeUp: Record<PrayerId, number>;
  dailyGoal: number;
  withEachPrayer?: boolean;
  fasts: number;
  fastsMadeUp: number;
  manualDays?: Record<string, Partial<Record<PrayerId, number>>>;
};

export function estimateQada(years: number, alreadyPrayed: number): QadaPlan["estimated"] {
  const days = Math.round(Math.max(0, years) * 365.2425);
  const prayed = Math.max(0, Math.floor(alreadyPrayed));
  const missed = Math.max(0, days * prayerIds.length - prayed);
  const each = Math.floor(missed / prayerIds.length);
  const remainder = missed % prayerIds.length;
  return Object.fromEntries(prayerIds.map((id, i) => [id, each + Number(i < remainder)])) as QadaPlan["estimated"];
}

export function finishQada(today: string, remaining: number, perDay: number) {
  return remaining > 0 && perDay > 0 ? addDays(today, Math.ceil(remaining / perDay) - 1) : null;
}

const emptyBalances = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
export const qadaDefaults: QadaPlan = {
  estimated: { ...emptyBalances }, madeUp: { ...emptyBalances },
  dailyGoal: 3, withEachPrayer: false, fasts: 0, fastsMadeUp: 0,
};

export function qadaBalances(plan: QadaPlan, logs: PrayerLog[]) {
  const madeUp = { ...plan.madeUp };
  for (const log of logs) {
    if (log.status === "qada") madeUp[log.prayer] += 1;
  }
  const remaining = Object.fromEntries(prayerIds.map(id => [id, Math.max(0, plan.estimated[id] - madeUp[id])]));
  const totalLeft = Object.values(remaining).reduce((total, count) => total + count, 0);
  return { madeUp, remaining, totalLeft };
}

export function recordQada(plan: QadaPlan, prayer: PrayerId, day: string): QadaPlan {
  const dated = plan.manualDays?.[day] ?? {};
  return {
    ...plan,
    madeUp: { ...plan.madeUp, [prayer]: plan.madeUp[prayer] + 1 },
    manualDays: { ...plan.manualDays, [day]: { ...dated, [prayer]: (dated[prayer] ?? 0) + 1 } },
  };
}

export function adjustQadaTotals(plan: QadaPlan, estimated: QadaPlan["estimated"], madeUp: QadaPlan["madeUp"]): QadaPlan {
  if (!plan.manualDays) return { ...plan, estimated, madeUp };
  const manualDays = { ...plan.manualDays };
  const newestFirst = Object.keys(manualDays).sort().reverse();
  for (const prayer of prayerIds) {
    let excess = newestFirst.reduce((sum, day) => sum + (manualDays[day]?.[prayer] ?? 0), 0) - madeUp[prayer];
    for (const day of newestFirst) {
      if (excess <= 0) break;
      const dated = manualDays[day];
      const removed = Math.min(dated?.[prayer] ?? 0, excess);
      if (!removed) continue;
      const adjusted = { ...dated, [prayer]: dated[prayer] - removed };
      if (Object.values(adjusted).some(count => count > 0)) manualDays[day] = adjusted;
      else delete manualDays[day];
      excess -= removed;
    }
  }
  return { ...plan, estimated, madeUp, manualDays };
}

export function qadaCountBetween(plan: QadaPlan, logs: PrayerLog[], first: string, last: string, zone: string) {
  const recorded = Object.entries(plan.manualDays ?? {}).reduce((total, [day, counts]) =>
    day < first || day > last ? total : total + Object.values(counts).reduce((sum, count) => sum + count, 0), 0);
  return recorded + logs.filter(log => {
    if (log.status !== "qada") return false;
    const time = new Date(log.at);
    if (!Number.isFinite(time.valueOf())) return false;
    const day = dateKey(time, zone);
    return first <= day && day <= last;
  }).length;
}

export function qadaForecast(today: string, balances: ReturnType<typeof qadaBalances>, plan: { dailyGoal: number; withEachPrayer?: boolean }) {
  const days = plan.withEachPrayer
    ? Math.max(...Object.values(balances.remaining))
    : Math.ceil(balances.totalLeft / plan.dailyGoal);
  const maxDays = (Date.parse("9999-12-31") - Date.parse(today)) / 86400000 + 1;
  return { days, end: days <= maxDays ? finishQada(today, days, 1) : null };
}
