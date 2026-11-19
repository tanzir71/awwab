import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { baselineMonthStart, calendarEventById, calendarEvents, hijriOn, monthStart, possibleMonthStarts } from "./hijri";
import { cities, currentPrayerSchedule, prayerDay, schedule } from "./prayerServices";
import { db, backup, defaults, getRecord, logPrayer, migrateLegacy, prayerStatistics, restoreBackup, updateSettings } from "./storageService";
import { calendarFile, eventReminders } from "./calendarFile";
import { estimateQada, finishQada, qadaDefaults } from "./qada";
import { guideReference, prayerGuide } from "./prayerGuide";
import { reviewCard, type Reviews } from "./reviews";
import { countKnownQuranWords } from "./quran";
import { completeOnboarding, placementLesson } from "./onboarding";
import { finishQaidaLesson, rememberQaidaPlace, saveFluencyPractice, saveQaidaRowReview, saveSurahReview, saveTakhtiPractice, saveWordReview, setAyahFamiliar, wordMilestones } from "./studyMilestones";
import { reviewDestination, reviewQueue, studyPlanMinutes } from "./studyDesk";
import coreWords from "../../docs/content/core-quran-words.json";
import qaida from "../../docs/content/qaida-lessons.json";

const dhaka = cities[0];
const day = "2026-11-19";
const times = schedule(day, dhaka, "Karachi", "hanafi");

describe("onboarding", () => {
  beforeEach(async () => {
    await db.records.clear();
  });

  it("recommends the first lesson beyond each confident placement answer", () => {
    expect([0, 1, 2, 3, 4].map(placementLesson)).toEqual([1, 2, 5, 6, 7]);
  });

  it("saves mode, script and placement together and keeps them after a second completion", async () => {
    await updateSettings({ language: "bn" });
    await completeOnboarding("maktab", "uthmani", 2);
    await completeOnboarding("adult", "indopak", 0);
    expect(await getRecord("settings", defaults)).toMatchObject({
      onboarded: true, mode: "maktab", script: "uthmani", spellStyle: "ampara-bn", language: "bn",
    });
    expect(await getRecord("qaida-current", 1)).toBe(5);
  });

  it("restores a pre-onboarding backup and its lesson without resetting the placement", async () => {
    const file = JSON.stringify({
      app: "awwab", version: 1, records: [{ key: "settings", value: { ...defaults, language: "bn" } }, { key: "qaida-current", value: 6 }], prayers: [],
    });
    await expect(restoreBackup("{}", { completeOnboarding: true })).rejects.toThrow();
    expect((await getRecord("settings", defaults)).onboarded).toBe(false);
    await restoreBackup(file, { completeOnboarding: true });
    expect(await getRecord("settings", defaults)).toMatchObject({ onboarded: true, language: "bn" });
    expect(await getRecord("qaida-current", 1)).toBe(6);
  });
});

describe("saved study milestones", () => {
  beforeEach(async () => {
    await db.records.clear();
  });

  it("schedules Qaida grades and preserves each due route and practice day", async () => {
    await Promise.all([
      saveQaidaRowReview(4, 5, "hard", times.asr, dhaka.timeZone),
      saveQaidaRowReview(4, 6, "okay", times.asr, dhaka.timeZone),
      saveQaidaRowReview(4, 7, "easy", times.asr, dhaka.timeZone),
    ]);
    const reviews = await getRecord<Reviews>("reviews", {});
    const { due } = reviewQueue(reviews, new Date("2027-01-19T06:00Z"), dhaka.timeZone);
    expect(due.map(([id]) => reviewDestination(id)).sort()).toEqual(["/learn/qaida/4?row=6", "/learn/qaida/4?row=7", "/learn/qaida/4?row=8"]);
    expect(reviews["qaida:4:5"].firstTries?.[day]).toBe(false);
    expect(reviews["qaida:4:7"].firstTries?.[day]).toBe(true);
    expect(reviews["qaida:4:7"].card.due.valueOf()).toBeGreaterThan(reviews["qaida:4:6"].card.due.valueOf());
    expect(await getRecord("study-days", [])).toEqual([day]);
  });

  it("records a family once even when two traces are checked together", async () => {
    await Promise.all([
      saveTakhtiPractice("boat", times.asr, dhaka.timeZone),
      saveTakhtiPractice("boat", times.asr, dhaka.timeZone),
    ]);
    expect(await getRecord("takhti-practised", [])).toEqual(["boat"]);
    expect(await getRecord("study-days", [])).toEqual([day]);
  });

  it("backs up modern reading and recognised signs without changing Quran word familiarity", async () => {
    await Promise.all([
      saveFluencyPractice("fluency-read", "teacher-mosque", true, times.asr, dhaka.timeZone),
      saveFluencyPractice("fluency-words", "مسجد", true, times.asr, dhaka.timeZone),
    ]);
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    expect(await getRecord("fluency-read", [])).toEqual(["teacher-mosque"]);
    expect(await getRecord("fluency-words", [])).toEqual(["مسجد"]);
    expect(await getRecord("word-bank-known", [])).toEqual([]);
    expect(await getRecord("study-days", [])).toEqual([day]);
    await saveFluencyPractice("fluency-words", "مسجد", false, times.asr, dhaka.timeZone);
    expect(await getRecord("fluency-words", [])).toEqual([]);
  });

  it.each(wordMilestones)("celebrates %i core words once and preserves the record in a backup", async count => {
    const key = coreWords.words[count - 1];
    await db.records.put({ key: "word-bank-known", value: coreWords.words.slice(0, count - 1) });
    const results = await Promise.all([
      saveWordReview(key, "got-it", times.asr, dhaka.timeZone),
      saveWordReview(key, "got-it", times.asr, dhaka.timeZone),
    ]);
    expect(results).toEqual([count, undefined]);
    expect(await getRecord("study-days", [])).toEqual([day]);
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    expect(await getRecord("word-milestones", [])).toEqual(wordMilestones.filter(threshold => threshold <= count));
  });

  it("shares the count with ayah study and retains an achievement when a verse is unmarked", async () => {
    const verse = "1:2";
    const words = coreWords.words.filter(key => countKnownQuranWords([verse], [key]) > countKnownQuranWords([verse], [])).slice(0, 24);
    expect(words).toHaveLength(24);
    await db.records.put({ key: "word-bank-known", value: words });
    expect(await setAyahFamiliar(verse, true)).toBe(25);
    expect(await setAyahFamiliar(verse, false)).toBeUndefined();
    expect(await setAyahFamiliar(verse, true)).toBeUndefined();
    expect(await getRecord("word-milestones", [])).toEqual([25]);
  });

  it("reports when a surah moves to Manzil and schedules its next review", async () => {
    const first = reviewCard(undefined, "got-it", times.asr);
    const second = reviewCard(first, "got-it", first.card.due);
    expect(second.bucket).toBe("sabqi");
    await db.records.put({ key: "reviews", value: { 103: second } });
    expect(await saveSurahReview(103, "got-it", second.card.due, dhaka.timeZone)).toBe(true);
    const reviews = await getRecord<Reviews>("reviews", {});
    expect(reviews[103].bucket).toBe("manzil");
    expect(await saveSurahReview(103, "got-it", reviews[103].card.due, dhaka.timeZone)).toBe(false);
  });

  it("completes the Qaida book only after every lesson is saved", async () => {
    expect(await finishQaidaLesson(17, times.asr, dhaka.timeZone)).toEqual({ bookComplete: false });
    expect(await finishQaidaLesson(17, times.asr, dhaka.timeZone)).toBeUndefined();
    const otherLessons = qaida.lessons.map(item => item.n).filter(number => number !== 1);
    await db.records.put({ key: "qaida-complete", value: otherLessons });
    expect(await finishQaidaLesson(1, times.asr, dhaka.timeZone)).toEqual({ bookComplete: true });
    expect(await finishQaidaLesson(1, times.asr, dhaka.timeZone)).toBeUndefined();
  });

  it("resumes the saved Qaida lesson and row after opening a completed lesson", async () => {
    await db.records.put({ key: "qaida-complete", value: [1, 2, 3] });
    await rememberQaidaPlace(4, 5);
    await rememberQaidaPlace(2, 1);
    expect(await getRecord("qaida-current", 1)).toBe(4);
    expect(await getRecord("qaida-row-4", 0)).toBe(5);
    await finishQaidaLesson(4, times.asr, dhaka.timeZone);
    expect(await getRecord("qaida-current", 1)).toBe(5);
  });

  it("keeps the first recall result of the day across retries and backup restore", async () => {
    await saveSurahReview(103, "forgot", times.asr, dhaka.timeZone);
    await saveSurahReview(103, "got-it", times.asr, dhaka.timeZone);
    await saveWordReview(coreWords.words[0], "got-it", times.asr, dhaka.timeZone);
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    const reviews = await getRecord<Reviews>("reviews", {});
    expect(reviewQueue(reviews, times.asr, dhaka.timeZone)).toMatchObject({ attempts: 2, correct: 1 });
    expect(reviewQueue(reviews, new Date("2026-12-22T12:00:00Z"), dhaka.timeZone)).toMatchObject({ attempts: 0, correct: 0 });
  });

  it("puts overdue reviews on today's bar and keeps customised plan minutes in sync", () => {
    const previous = reviewCard(undefined, "shaky", times.asr);
    const config: Reviews = {
      103: { ...previous, card: { ...previous.card, due: new Date("2026-11-16T10:00:00Z") } },
      112: { ...previous, card: { ...previous.card, due: new Date("2026-11-21T10:00:00Z") } },
    };
    const queue = reviewQueue(config, times.asr, dhaka.timeZone);
    expect(queue.due.map(([id]) => id)).toEqual(["103"]);
    expect(queue.forecast.map(point => point.count)).toEqual([1, 0, 1, 0, 0, 0, 0]);
    expect(studyPlanMinutes(["fluency"])).toBe(studyPlanMinutes([]) - 3);
  });
});

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

describe("prayer guide", () => {
  it("builds the right first and final sittings for two-, three- and four-rakʿah prayers", () => {
    const settings = { school: "hanafi" } as const;
    const result = (["fajr", "dhuhr", "asr", "maghrib", "isha"] as const).map(prayer => prayerGuide(prayer, settings, {}));
    expect(result.map(guide => guide.total)).toEqual([4, 12, 8, 7, 17]);
    expect(result.map(guide => guide.fardCount)).toEqual([2, 4, 4, 3, 4]);
    expect(result[0].steps.map(step => step.sitting)).toEqual([undefined, "final"]);
    expect(result[3].steps.map(step => step.sitting)).toEqual([undefined, "first", "final"]);
    expect(result[4].steps.map(step => step.sitting)).toEqual([undefined, "first", undefined, "final"]);
    expect(result[2].steps.map(step => step.suggestion?.number)).toEqual([108, 103, undefined, undefined]);
  });

  it("prefers solid surahs and keeps the guide preference independent from calculation", () => {
    const solid = { ...reviewCard(undefined, "got-it", times.fajr), bucket: "manzil" } as const;
    const guide = prayerGuide("asr", { school: "hanafi", prayerGuide: "fard" }, { 1: solid, 112: solid, 106: solid });
    expect(guide.groups).toEqual([{ type: "fard", count: 4, recitation: "silent" }]);
    expect(guide.steps.map(step => step.suggestion?.number)).toEqual([112, 106, undefined, undefined]);
    expect(guideReference({ school: "shafi" })).toBe("fard");
    expect(guideReference({ school: "shafi", prayerGuide: "hanafi" })).toBe("hanafi");
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

  it("preserves a saved guide preference separately from Asr calculation in backups", async () => {
    await updateSettings({ school: "shafi", prayerGuide: "hanafi" });
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    expect((await db.records.get("settings")).value).toMatchObject({ school: "shafi", prayerGuide: "hanafi" });
  });

  it("round trips a make-up plan with one per prayer and accepts an older plan without the field", async () => {
    const plan = { ...qadaDefaults, withEachPrayer: true, fasts: 12, fastsMadeUp: 1 };
    await db.records.put({ key: "qada", value: plan });
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    expect(await getRecord("qada", qadaDefaults)).toEqual(plan);

    const legacy = JSON.parse(file);
    delete legacy.records.find(record => record.key === "qada").value.withEachPrayer;
    await restoreBackup(JSON.stringify(legacy));
    expect(await getRecord("qada", qadaDefaults)).toMatchObject({ dailyGoal: 3, fasts: 12, fastsMadeUp: 1 });
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

  it("shows both local sighting dates even after a baseline 30-day month", () => {
    const year = 1448;
    const month = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find(month => {
      return addDays(baselineMonthStart(year, month - 1), 30) === baselineMonthStart(year, month);
    })!;
    const previous = baselineMonthStart(year, month - 1);
    expect(possibleMonthStarts(year, month, 0, [])).toEqual([addDays(previous, 29), addDays(previous, 30)]);
  });

  it("keeps a confirmed event and source when moving it one day, and exports the chosen date", () => {
    const id = "1448-10-6";
    const calendar = { anchors: [], overrides: { [id]: { date: "2027-03-10", source: "Family", adjust: 1 as const } } };
    expect(calendarEventById(id, 0, calendar)).toMatchObject({ confirmed: true, dates: ["2027-03-11"], source: "Family" });
    expect(calendarEventById("1448-9-6", 0, calendar)).toBeUndefined();
    expect(calendarEventById("9999-10-6", 0, calendar)).toBeUndefined();
    expect(eventReminders(day, defaults, calendar).filter(item => item.id.startsWith("event-" + id)))
      .toEqual([{ id: "event-" + id + "-0", start: "2027-03-11", title: "Eid al-Fitr", description: "Family" }]);
  });

  it("includes an optional moon-watch reminder at local Maghrib in the exported file", () => {
    const id = "1448-10-6";
    const calendar = { anchors: [], overrides: {} };
    const watch = eventReminders(day, defaults, calendar).find(item => item.id === "moon-watch-1448-10");
    expect(watch).toMatchObject({ start: schedule("2027-03-08", defaults.city, defaults.method, defaults.school).maghrib, alarm: 0 });
    expect(eventReminders(day, defaults, { ...calendar, moonReminders: { [id]: false } }).some(item => item.id === "moon-watch-1448-10")).toBe(false);
  });
});

describe("Qaḍāʾ", () => {
  it("allocates the estimated balance across five prayers", () => {
    expect(Object.values(estimateQada(1, 2)).reduce((total, count) => total + count, 0)).toBe(1823);
    expect(Object.values(estimateQada(0.5, 2000))).toEqual([0, 0, 0, 0, 0]);
    expect(finishQada(day, 7, 3)).toBe("2026-11-21");
  });
});
