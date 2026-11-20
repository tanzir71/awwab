import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, formatDay, formatTime } from "./dates";
import { baselineMonthStart, calendarEventById, calendarEvents, hijriOn, monthStart, possibleMonthStarts } from "./hijri";
import { cities, currentPrayerSchedule, prayerDay, schedule } from "./prayerServices";
import { db, backup, defaults, exportUmrahTrip, getRecord, logPrayer, migrateLegacy, prayerStatistics, readUmrahTripFile, restoreBackup, updateSettings } from "./storageService";
import { initialTrip } from "./umrah";
import { initialZakat, type ZakatProfile } from "./zakat";
import { calendarFile, eventReminders, prayerReminders } from "./calendarFile";
import { estimateQada, finishQada, qadaDefaults } from "./qada";
import { mosqueDefaults, type Mosque } from "./mosques";
import { guideRakahIndex, guideReference, prayerGuide, prayerGuidePath } from "./prayerGuide";
import { applyGlossary, formatLocale, glossaryValue, isBuiltIn, languageMatches, languages, quranMeaningPreferences, suggestedLanguage } from "./languagePreferences";
import * as localePacks from "./localePacks";
import { planMonth } from "./plan-copy";
import { message } from "./copy";
import { updateWordChoice } from "./storageService";
import { reviewCard, type Reviews } from "./reviews";
import { countKnownQuranWords } from "./quran";
import { completeOnboarding, desktopPlacementPassed, placementLesson, prayerSetupSuggestion } from "./onboarding";
import { finishQaidaLesson, finishSpeakUnit, markReadingPortion, rememberFlowPlace, rememberQaidaPlace, saveFluencyPractice,
  saveJuzRecitalRating, saveQaidaRowReview, saveSurahReview, saveTakhtiPractice, saveWordReview, setAyahFamiliar, setTeacherCheck, wordMilestones } from "./studyMilestones";
import { defaultSpeakVariety, speakCourseVariety, speakGoalsKey, speakProgressKey, speakVarietyKey } from "./speakCurriculum";
import { completedReadingChapters, emptyReadingPractice, firstUnreadAyah, readingFlowPlaceKey, recitationChecks,
  resumeFlowReading, teacherChecklistComplete } from "./readingPractice";
import type { HifzPortion, JuzRecitals } from "./hifz";
import { isSurahStudyReview, reviewDestination, reviewQueue, studyPlanMinutes } from "./studyDesk";
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

  it("uses the earliest topic needing practice in the desktop placement", () => {
    expect(desktopPlacementPassed([])).toBe(0);
    expect(desktopPlacementPassed(["easy", "easy", "easy", "easy", "effort", "easy", "easy", "easy"])).toBe(1);
    expect(desktopPlacementPassed(Array(8).fill("easy"))).toBe(4);
  });

  it("looks up supported locale suggestions and keeps the saved schedule without an explicit choice", async () => {
    expect(prayerSetupSuggestion("bn")).toEqual({ method: "Karachi", school: "hanafi" });
    expect(prayerSetupSuggestion("ur")).toEqual({ method: "Karachi", school: "hanafi" });
    expect(prayerSetupSuggestion("tr")).toEqual({ method: "Turkey", school: "hanafi" });
    expect(prayerSetupSuggestion("fr")).toEqual({ method: "MuslimWorldLeague", school: "shafi" });
    for (const language of ["en", "id", "ms", "fa", "az", "ru"]) {
      expect(prayerSetupSuggestion(language)).toBeUndefined();
    }
    await updateSettings({ language: "bn", method: "Egyptian", school: "shafi" });
    await completeOnboarding("adult", "indopak", 0);
    expect(await getRecord("settings", defaults)).toMatchObject({ method: "Egyptian", school: "shafi" });
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

  it("keeps Speak completion, goals and variety through concurrent saves and a backup", async () => {
    await db.records.bulkPut([
      { key: speakProgressKey, value: ["sim", "greetings"] },
      { key: speakGoalsKey, value: ["speakWork"] },
      { key: speakVarietyKey, value: "gulf" },
    ]);
    await Promise.all([
      finishSpeakUnit("a2-family", times.asr, dhaka.timeZone),
      finishSpeakUnit("a2-family", times.asr, dhaka.timeZone),
      finishSpeakUnit("a2-office", times.asr, dhaka.timeZone),
      finishSpeakUnit("b1-story", times.asr, dhaka.timeZone),
      finishSpeakUnit("msa-a1-greetings", times.asr, dhaka.timeZone),
      finishSpeakUnit("gulf-a1-greetings", times.asr, dhaka.timeZone),
      finishSpeakUnit("umrah-hajj-haram", times.asr, dhaka.timeZone),
      finishSpeakUnit("gulf-work-first-day", times.asr, dhaka.timeZone),
    ]);
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    expect(await getRecord<string[]>(speakProgressKey, [])).toEqual([
      "sim", "greetings", "a2-family", "a2-office", "b1-story", "msa-a1-greetings", "gulf-a1-greetings", "umrah-hajj-haram", "gulf-work-first-day",
    ]);
    expect(await getRecord<string[]>(speakGoalsKey, [])).toEqual(["speakWork"]);
    const variety = await getRecord(speakVarietyKey, defaultSpeakVariety);
    expect(variety).toBe("gulf");
    expect(speakCourseVariety(variety, "A1")).toBe("gulf");
    expect(speakCourseVariety(variety, "A2")).toBe("saudi-hijazi");
    expect(speakCourseVariety(variety, "umrah-hajj")).toBe("saudi-hijazi");
    expect(speakCourseVariety("msa", "gulf-work")).toBe("gulf");
    expect(await getRecord<string[]>("study-days", [])).toEqual([day]);
  });

  it("merges reading progress and keeps the two paths and teacher checklist separate in a backup", async () => {
    await Promise.all([
      markReadingPortion("flow", 108, [2, 3], times.asr, dhaka.timeZone),
      markReadingPortion("flow", 108, [1, 2], times.asr, dhaka.timeZone),
      markReadingPortion("meaning", 108, [2], times.asr, dhaka.timeZone),
      ...recitationChecks.map(check => setTeacherCheck(1, check, true, times.asr, dhaka.timeZone)),
    ]);
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    const reading = await getRecord("reading-practice", emptyReadingPractice);
    expect(reading.flow[108]).toEqual([1, 2, 3]);
    expect(reading.meaning[108]).toEqual([2]);
    expect(completedReadingChapters("flow", reading)).toBe(1);
    expect(completedReadingChapters("meaning", reading)).toBe(0);
    expect(firstUnreadAyah(3, reading.meaning[108])).toBe(1);
    expect(teacherChecklistComplete(reading.teacher[1])).toBe(true);
    expect(await getRecord("word-bank-known", [])).toEqual([]);
    expect(await getRecord("study-days", [])).toEqual([day]);
    expect(() => markReadingPortion("flow", 108, [4], times.asr, dhaka.timeZone)).toThrow(RangeError);
  });

  it("round-trips a partial recital and ignores duplicate ratings across tabs", async () => {
    const portions: HifzPortion[] = [
      { id: "78:1-78:5", ref: "78:1–5", verses: [], words: 10 },
      { id: "78:6-78:10", ref: "78:6–10", verses: [], words: 12 },
    ];
    await saveJuzRecitalRating(30, portions, portions[0].id, "got-it", times.asr, dhaka.timeZone);
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    expect((await getRecord<JuzRecitals>("hifz-juz-recitals", {}))[30]).toMatchObject({ rated: { [portions[0].id]: "got-it" } });
    await Promise.all([
      saveJuzRecitalRating(30, portions, portions[1].id, "shaky", times.asr, dhaka.timeZone),
      saveJuzRecitalRating(30, portions, portions[1].id, "shaky", times.asr, dhaka.timeZone),
    ]);
    expect((await getRecord<JuzRecitals>("hifz-juz-recitals", {}))[30]).toEqual({ rated: {}, last: { day, remembered: 1, total: 2 } });
    expect(await getRecord("study-days", [])).toEqual([day]);
    expect(await getRecord("hifz-portions", {})).toEqual({});
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

  it("keeps surah study counts to surahs for salah, Quran words and Qaida", () => {
    const ids = ["103", "word:ٱلْعَصْرِ", "letter:ث", "qaida:4:5", "2", "phrase:sim:0", "grammar:particles"];
    expect(ids.filter(isSurahStudyReview)).toEqual(ids.slice(0, 4));
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

  it("opens the requested rakʿah only when it exists in the selected guide", () => {
    expect(guideRakahIndex("4", 4)).toBe(3);
    for (const query of ["3", "0", "02", "-1", "2.5", "Infinity", null]) expect(guideRakahIndex(query, 2)).toBe(0);
    expect(prayerGuidePath("asr", "3")).toBe("/today/guide/asr?rakah=3");
    expect(prayerGuidePath("jumuah", "invalid")).toBe("/today/guide/jumuah");
    expect(prayerGuide("jumuah", { school: "hanafi" }, {}).steps.map(step => step.sitting)).toEqual([undefined, "final"]);
  });
});

describe("language settings", () => {
  it("matches regional language preferences and keeps planned languages out of the selectable set", () => {
    expect(suggestedLanguage(["ja-JP", "bn-BD"])?.code).toBe("bn");
    expect(suggestedLanguage(["pa-Arab-PK"])?.code).toBe("pa-Arab");
    expect(languages.some(item => item.code === "ur" && languageMatches(item, "اردو") && !isBuiltIn(item.code))).toBe(true);
    expect(isBuiltIn("bn")).toBe(true);
  });

  it("keeps word choices scoped to the interface language and preserves the meaning fallback", () => {
    const words = { bn: { salah: "সালাত", qada: "কাযা" } };
    expect(glossaryValue("bn", "salah", words)).toBe("সালাত");
    expect(applyGlossary("কাজা নামাজের অগ্রগতি", "bn", words)).toBe("কাযা সালাতের অগ্রগতি");
    expect(applyGlossary("Make-up prayers", "en", words)).toBe("Make-up prayers");
    expect(new Intl.NumberFormat(formatLocale({ language: "bn" })).format(123)).toBe("১২৩");
    expect(new Intl.NumberFormat(formatLocale({ language: "bn", nativeDigits: false })).format(123)).toBe("123");
    expect(quranMeaningPreferences({ language: "bn" })).toEqual({ local: undefined, english: true });
    expect(quranMeaningPreferences({ language: "bn", englishMeaning: false }).english).toBe(false);
    expect(quranMeaningPreferences({ language: "en", quranMeanings: false, englishMeaning: true }).english).toBe(true);
    expect(quranMeaningPreferences({ language: "ur" }).english).toBe(true);
    expect(glossaryValue("ps", "salah")).toBe(glossaryValue("en", "salah"));
    expect(planMonth(9, "ur")).toMatch(/\p{Script=Arabic}/u);
  });

  it("uses an installed Quran edition with independent English and local controls", () => {
    const edition = { credit: "Test edition", source: "https://example.com/edition", license: "Test license",
      licenseUrl: "https://example.com/license", verses: { "1:1": "Fixture text" } };
    const installed = vi.spyOn(localePacks, "localeQuranEdition").mockImplementation(code => code === "ur" ? edition : undefined);
    try {
      expect(quranMeaningPreferences({ language: "ur" })).toEqual({ local: edition, english: false });
      expect(quranMeaningPreferences({ language: "ur", englishMeaning: true })).toEqual({ local: edition, english: true });
      expect(quranMeaningPreferences({ language: "ur", quranMeanings: false })).toEqual({ local: undefined, english: false });
      expect(quranMeaningPreferences({ language: "bn" })).toEqual({ local: undefined, english: true });
    } finally { installed.mockRestore(); }
  });

  it("formats glossary arguments with the active language's choices and keeps ICU numbers intact", () => {
    const wordChoices = { bn: { salah: "সালাত", ramadan: "রামাদান" }, id: { salah: "sholat", dhuhr: "Dzuhur" } };
    expect(message(defaults, "surahsForSalah")).toBe("Surahs for salah");
    expect(message({ ...defaults, language: "bn", wordChoices }, "surahsForSalah")).toBe("সালাতের সূরা");
    expect(message({ ...defaults, language: "bn", wordChoices }, "qadaRamadan", { count: 12 })).toBe("রামাদান আসতে ১২ দিন বাকি");
    expect(message({ ...defaults, language: "id", wordChoices }, "dhuhr")).toBe("Dzuhur");
    expect(message({ ...defaults, language: "id", wordChoices }, "surahsForSalah")).toBe("Surahs for sholat");
    expect(message({ ...defaults, language: "id" }, "dhuhr")).toBe("Zuhur");
  });

  it("uses the handover numbering systems for counts, dates and times", () => {
    for (const [language, sample] of [
      ["bn", "১২৩"], ["fa", "۱۲۳"], ["ps", "۱۲۳"], ["ckb", "١٢٣"], ["ur", "123"], ["sd", "123"], ["pa-Arab", "123"],
    ]) {
      expect(new Intl.NumberFormat(formatLocale({ language })).format(123)).toBe(sample);
      expect(new Intl.NumberFormat(formatLocale({ language, nativeDigits: false })).format(123)).toBe("123");
    }
    const native = formatLocale({ language: "fa" });
    const latin = formatLocale({ language: "fa", nativeDigits: false });
    const time = new Date("2026-11-20T12:34:00Z");
    expect(formatDay("2026-11-20", { day: "numeric" }, native)).toMatch(/۲۰/u);
    expect(formatDay("2026-11-20", { day: "numeric" }, latin)).toMatch(/20/u);
    expect(formatTime(time, "UTC", native)).toMatch(/۱۲:۳۴/u);
    expect(formatTime(time, "UTC", latin)).toMatch(/12:34/u);
    expect(message({ ...defaults, language: "fa" }, "qadaRamadan", { count: 12 })).toContain("۱۲");
    expect(message({ ...defaults, language: "fa", nativeDigits: false }, "qadaRamadan", { count: 12 })).toContain("12");
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

  it("restores Umrah choices and crossing history from a backup and keeps them out of the trip plan file", async () => {
    const trip = {
      ...initialTrip, gps: true, auto: true, walkOptions: { voice: true, remember: true },
      gateMemory: { entry: "gate-3210622327", exit: "gate-4755914231" },
      hotelPrayer: { date: "2026-11-20", id: "fajr" as const },
      step: 5, voluntaryTawaf: 4, saiPaused: true, sai: { count: 1, last: "marwah" as const, exited: false, detected: true },
    };
    await db.records.put({ key: "umrah", value: trip });
    const practice = { step: 2, tawaf: 5, sai: 3, completed: [0, 1] };
    await db.records.put({ key: "umrah-practice", value: practice });
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    expect(await getRecord("umrah", initialTrip)).toEqual(JSON.parse(JSON.stringify({ ...trip, gps: false, auto: false })));
    expect(await getRecord("umrah-practice", undefined)).toEqual(practice);
    const plan = readUmrahTripFile(exportUmrahTrip(trip));
    for (const key of ["gps", "auto", "walkOptions", "gateMemory", "hotelPrayer", "voluntaryTawaf", "saiPaused", "sai"]) {
      expect(plan).not.toHaveProperty(key);
    }
  });

  it("restores the reader bookmark and still resumes older progress without a bookmark", async () => {
    const progress = { ...emptyReadingPractice, flow: { 113: [1, 2] } };
    const legacy = resumeFlowReading(progress);
    expect([legacy.chapter.number, legacy.ayah]).toEqual([113, 3]);
    await rememberFlowPlace({ chapter: 114, ayah: 5 });
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    const place = await getRecord<{ chapter: number; ayah: number } | undefined>(readingFlowPlaceKey, undefined);
    const resumed = resumeFlowReading(progress, place);
    expect([resumed.chapter.number, resumed.ayah]).toEqual([114, 5]);
  });

  it("restores language preferences and suggestions together with a legacy-compatible settings record", async () => {
    await updateSettings({ language: "bn", nativeDigits: false, englishMeaning: false, textSize: "large", urduNastaliq: true, tajweedHighlights: true });
    await Promise.all([updateWordChoice("bn", "salah", "সালাত"), updateWordChoice("bn", "dhuhr", "জোহর")]);
    const note = { language: "bn", page: "/today", original: "এখন", proposed: "এই সময়" };
    await db.records.put({ key: "wording-suggestions", value: [note] });
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    expect((await db.records.get("settings")).value).toMatchObject({ language: "bn", nativeDigits: false, englishMeaning: false, textSize: "large", urduNastaliq: true,
      tajweedHighlights: true, wordChoices: { bn: { salah: "সালাত", dhuhr: "জোহর" } } });
    expect((await db.records.get("wording-suggestions")).value).toEqual([note]);
    await updateWordChoice("bn");
    expect((await db.records.get("settings")).value).toMatchObject({ wordChoices: {}, nativeDigits: false, urduNastaliq: true });
  });

  it("round trips a Zakat ledger, rates and payments alongside older entries", async () => {
    const profile: ZakatProfile = {
      ...initialZakat, cash: 87_000, hawlSet: true, hawlMonth: 7, hawlDay: 14, receivables: 5000,
      prices: { silver: 230, gold: 18_000 },
      assets: [
        { id: "bangle", name: "Bangle", kind: "metal", basis: "gold", weight: 2, unit: "bhori", purity: 91.67 },
        { id: "bank", name: "Bank", kind: "cash", amount: 200_000 },
      ],
      payments: [
        { day: "2025-01-09", currency: "BDT", amount: 1000 },
        { day: "2026-11-19", currency: "BDT", amount: 1300, name: "Recipient", hawlYear: 1448 },
      ],
    };
    await db.records.put({ key: "zakat", value: profile });
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    expect(await getRecord("zakat", initialZakat)).toEqual(profile);
  });

  it("round trips dated make-ups and Sayyid review, and accepts an older make-up plan", async () => {
    const plan = { ...qadaDefaults, withEachPrayer: true, fasts: 12, fastsMadeUp: 1,
      madeUp: { ...qadaDefaults.madeUp, fajr: 3 }, manualDays: { "2026-11-19": { fajr: 2 } } };
    await db.records.bulkPut([{ key: "qada", value: plan }, { key: "sayyid-reviewed", value: [0, 2, 6] }]);
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    expect(await getRecord("qada", qadaDefaults)).toEqual(plan);
    expect(await getRecord("sayyid-reviewed", [])).toEqual([0, 2, 6]);

    const legacy = JSON.parse(file);
    delete legacy.records.find(record => record.key === "qada").value.withEachPrayer;
    delete legacy.records.find(record => record.key === "qada").value.manualDays;
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

  it("restores new and older timetable photos as local blobs with the mappings intact", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const mosque: Mosque = { id: "home", name: "Home masjid", role: "home", jamaat: { maghrib: "adhan+5" },
      source: "board photo", updatedAt: times.dhuhr.toISOString(), occasional: [], refreshMonth: 11 };
    const mapping = { "4-maghrib": "home" };
    await db.records.put({ key: "mosques", value: { mapping, mosques: [
      { ...mosque, photo: new Blob([bytes], { type: "image/png" }), photoSavedAt: "2026-11-09T10:30:00.000Z" },
      { ...mosque, id: "office", refreshMonth: undefined, photo: "data:image/png;base64,iVBORw==" },
    ] } });
    const file = await backup();
    await db.records.clear();
    await restoreBackup(file);
    const plan = await getRecord("mosques", mosqueDefaults);
    expect(plan.mapping).toEqual(mapping);
    expect(plan.mosques[0].refreshMonth).toBe(11);
    expect(plan.mosques[0].photoSavedAt).toBe("2026-11-09T10:30:00.000Z");
    expect(plan.mosques[1].photoSavedAt).toBeUndefined();
    for (const item of plan.mosques) {
      expect(item.photo).toBeInstanceOf(Blob);
      const photo = item.photo as Blob;
      expect(photo.type).toBe("image/png");
      expect(new Uint8Array(await photo.arrayBuffer())).toEqual(bytes);
    }
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
  it("uses the Gregorian year in localized Gregorian dates", () => {
    expect(formatDay(day, { year: "numeric" }, "fa")).toBe("۲۰۲۶");
  });

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

  it("localizes calendar text while preserving reminder IDs, times and confirmation dates", () => {
    const settings = { ...defaults, language: "bn" as const };
    const id = "1448-10-6";
    const calendar = { anchors: [], overrides: { [id]: { date: "2027-03-11", source: "Family", adjust: 0 as const } },
      moonReminders: { "1448-7-2": true } };
    const prayers = prayerReminders(day, settings, 1, 5);
    const events = eventReminders(day, settings, calendar);
    expect(prayers[0]).toMatchObject({
      id: `prayer-${day}-fajr`, start: times.fajr, alarm: 5, title: "ফজর নামাজ",
    });
    expect(events.find(item => item.id === `event-${id}-0`)).toMatchObject({
      start: "2027-03-11", title: "ঈদুল ফিতর", description: "পরিবার",
    });
    expect(events.find(item => item.id === "moon-watch-1448-7")).toMatchObject({
      alarm: 0, title: "রজব মাসের চাঁদ দেখুন",
    });
    const file = calendarFile([...prayers, ...events]).replace(/\r\n /g, "");
    expect(file).toContain("DESCRIPTION:ঢাকা শহরের জন্য ডিভাইসে হিসাব করা হয়েছে।\r\n");
    expect(file).toContain("SUMMARY:সম্ভাব্য: রজব শুরু\r\n");
    expect(file).toContain("UID:event-1448-10-6-0@awwab\r\n");
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
