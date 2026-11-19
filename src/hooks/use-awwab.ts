import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, defaults, getRecord } from "@/lib/storageService";

export function useSettings() {
  return useLiveQuery(() => getRecord("settings", defaults));
}

export function useRecord<T>(key: string, fallback: T) {
  return useLiveQuery(() => getRecord(key, fallback), [key], fallback);
}

export function usePrayerLogs() {
  return useLiveQuery(() => db.prayers.toArray(), [], []);
}

export function useQaidaPlace() {
  return useLiveQuery(() => db.transaction("r", db.records, async () => {
    const lesson = await getRecord("qaida-current", 1);
    const row = await getRecord("qaida-row-" + lesson, 0);
    return { lesson, row };
  }), [], { lesson: 1, row: 0 });
}

export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return now;
}

export function useDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const change = () => setDesktop(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return desktop;
}
