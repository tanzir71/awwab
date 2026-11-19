import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { baselineMonthStart, calendarEvents, hijriOn, monthStart } from "./hijri";
import { cities, currentPrayerSchedule, prayerDay, schedule } from "./prayerServices";
import { db, backup, logPrayer, migrateLegacy, prayerStatistics, restoreBackup, updateSettings } from "./storageService";
import { calendarFile } from "./calendarFile";
import { estimateQada, finishQada } from "./qada";

const dhaka = cities[0];
const day = "2026-11-19";
const times = schedule(day, dhaka, "Karachi", "hanafi");

describe("daily prayer times", () => {
  it("distinguishes passed prayers, current prayer and future prayers", () => {
    const now = new Date(times.dhuhr.valueOf() + 20 * 60_000);
    const { day: dated, current, next, prayers } = currentPrayerSchedule(dhaka, "Karachi", "hanafi", now);
    expect(dated).toBe(day);
    expect(current.id).toBe("dhuhr");
    expect(next.id).toBe("asr");
    expect(prayers.map(item => item.status)).toEqual(["missed", "now", "upcoming", "upcoming", "upcoming"]);
  });

  it("keeps Isha open before the next Fajr and Fajr closed after sunrise", () => {
    const midnight = new Date("2026-11-18T18:30:00Z");
    const afterSunrise = new Date(times.sunrise.valueOf() + 60000);
    const early = currentPrayerSchedule(dhaka, "Karachi", "hanafi", midnight);
    expect(early.current.id).toBe("isha");
    expect(early.current.date).toBe("2026-11-18");
    expect(currentPrayerSchedule(dhaka, "Karachi", "hanafi", afterSunrise).current).toBeUndefined();
  });

  it("uses the corrected Dhuhr and Isha order", () => {
    const prayers = prayerDay(day, dhaka, "Karachi", "hanafi", times.fajr);
    expect(prayers[1].rakats.map(item => [item.count, item.type])).toEqual([[4, "sunnah"], [4, "fard"], [2, "sunnah"], [2, "nafl"]]);
    expect(prayers[4].rakats[2]).toMatchObject({ count: 2, type: "sunnah", emphasis: "muakkadah" });
  });
});

describe("device prayer records", () => {
  beforeEach(async () => {
    await db.prayers.clear();
    await db.records.clear();
    await db.audio.clear();
  });

  it("preserves legacy history and exports and restores a backup", async () => {
    const data = new Map([["completedPrayers", JSON.stringify([{ date: day, prayerName: "Dhuhr", completedAt: times.dhuhr.toISOString() }])]]);
    await migrateLegacy({
      getItem: key => data.get(key) ?? null,
      removeItem: key => { data.delete(key); },
    });
    expect(data.size).toBe(0);
    await updateSettings({ mode: "maktab" });
    const json = await backup();
    await db.prayers.clear();
    await db.records.clear();
    await restoreBackup(json);
    expect(await db.prayers.get([day, "dhuhr"])).toMatchObject({ status: "done" });
    expect((await db.records.get("settings")).value).toMatchObject({ mode: "maktab" });
    await expect(restoreBackup("{}")).rejects.toThrow();
    expect(await db.prayers.count()).toBe(1);
  });

  it("ignores a future event and records a make-up without double-counting", async () => {
    const prayers = prayerDay(day, dhaka, "Karachi", "hanafi", times.dhuhr);
    await logPrayer(prayers[2], times.dhuhr);
    expect(await db.prayers.count()).toBe(0);
    await Promise.all([logPrayer(prayers[0], times.dhuhr), logPrayer(prayers[0], times.dhuhr)]);
    expect(await db.prayers.get([day, "fajr"])).toMatchObject({ status: "qada" });
    expect(await db.prayers.count()).toBe(1);
  });

  it("round trips local audio and rejects a backup with unsupported record values", async () => {
    await db.audio.put({ ref: "103:1", title: "Reference", blob: new Blob([new Uint8Array([73, 68, 51])], { type: "audio/mpeg" }) });
    const saved = await backup();
    const invalid = JSON.parse(saved);
    invalid.records.push({ key: "qaida-current", value: -1 });
    await expect(restoreBackup(JSON.stringify(invalid))).rejects.toThrow();
    expect(await db.audio.count()).toBe(1);
    await db.audio.clear();
    await restoreBackup(saved);
    const clip = await db.audio.get("103:1");
    expect(clip.blob.type).toBe("audio/mpeg");
    expect(new Uint8Array(await clip.blob.arrayBuffer())).toEqual(new Uint8Array([73, 68, 51]));
  });

  it("counts returning after a gap and keeps the active day total", () => {
    const logs = [
      { date: "2026-11-13", prayer: "fajr", status: "done", at: times.fajr.toISOString() },
      { date: "2026-11-16", prayer: "fajr", status: "done", at: times.fajr.toISOString() },
    ] as const;
    expect(prayerStatistics([...logs], day)).toMatchObject({ activeDays: 2, returns: 1, consistency: 1 });
  });
});

describe("Hijri confirmation", () => {
  it("re-anchors the current month and shifts later expected events", () => {
    const original = baselineMonthStart(1448, 9);
    expect(hijriOn(original)).toEqual({ year: 1448, month: 9, day: 1 });
    const confirmed = addDays(original, 1);
    const anchors = [{ year: 1448, month: 9, date: confirmed, source: "My mosque" }];
    expect(monthStart(1448, 9, 0, anchors)).toEqual({ date: confirmed, source: "My mosque", confirmed: true });
    expect(hijriOn(confirmed, 0, anchors).day).toBe(1);
    const next = baselineMonthStart(1448, 10);
    const updated = calendarEvents(original, addDays(next, 5), 0, { anchors, overrides: {} });
    expect(updated.find(item => item.title === "Eid al-Fitr").dates).toEqual([addDays(next, 1), addDays(next, 2)]);
    expect(updated.find(item => item.title.startsWith("Last ten")).dates).toEqual([addDays(confirmed, 20)]);
  });

  it("writes standard date-only and timestamp calendar entries", () => {
    const file = calendarFile([{ id: "new", title: "A, B", start: day }, { id: "fajr", title: "Fajr", start: times.fajr, alarm: 5 }]);
    expect(file).toContain("DTSTART;VALUE=DATE:20261119\r\n");
    expect(file).toContain("SUMMARY:A\\, B\r\n");
    expect(file).toContain("TRIGGER:-PT5M\r\n");
  });
});

describe("Qaḍāʾ", () => {
  it("allocates the estimated balance across five prayers", () => {
    expect(Object.values(estimateQada(1, 2)).reduce((total, count) => total + count, 0)).toBe(1823);
    expect(Object.values(estimateQada(0.5, 2000))).toEqual([0, 0, 0, 0, 0]);
    expect(finishQada(day, 7, 3)).toBe("2026-11-21");
  });
});
