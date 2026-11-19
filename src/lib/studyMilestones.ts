import { addDays, dateKey } from "./dates";
import { countKnownQuranWords } from "./quran";
import { grades, qaidaGrades, reviewWithRating, type QaidaGrade, type ReviewGrade, type Reviews } from "./reviews";
import type { Grade } from "ts-fsrs";
import { db, getRecord } from "./storageService";
import { qaidaReviewId, qaidaRows } from "./qaidaPractice";
import { juzs, ratePortion, rateRecitalPortion, type HifzPlans, type HifzPortion, type HifzReviews, type JuzRecitals } from "./hifz";
import { emptyReadingPractice, practiceChapters, recitationChecks, teacherChecklistComplete, type ReadingMode, type RecitationCheck } from "./readingPractice";
import { speakProgressKey, speakUnit } from "./speakCurriculum";
import qaida from "../../docs/content/qaida-lessons.json";

export const wordMilestones = [25, 50, 100, 125] as const;
export type WordMilestone = typeof wordMilestones[number];
export type MomentTemplate = "surah" | "words" | "qaida" | "maktab";

export function momentPath(template: MomentTemplate, value: number, fromSalah = false) {
  return `/share/milestone/${template}/${value}${fromSalah ? "?from=salah" : ""}`;
}

async function setFamiliar(record: "words-known" | "word-bank-known", key: string, value: boolean) {
  const [verses, words, earned] = await Promise.all([
    getRecord<string[]>("words-known", []),
    getRecord<string[]>("word-bank-known", []),
    getRecord<WordMilestone[]>("word-milestones", []),
  ]);
  const current = record === "words-known" ? verses : words;
  const next = value ? [...new Set([...current, key])] : current.filter(item => item !== key);
  const before = countKnownQuranWords(verses, words);
  const after = record === "words-known" ? countKnownQuranWords(next, words) : countKnownQuranWords(verses, next);
  const newlyEarned = wordMilestones.filter(count => count > before && count <= after && !earned.includes(count));
  // Older records may already have passed a threshold. Preserve that achievement if familiarity is later cleared.
  const history = wordMilestones.filter(count => earned.includes(count) || count <= Math.max(before, after));
  await db.records.bulkPut([{ key: record, value: next }, { key: "word-milestones", value: history }]);
  return newlyEarned.at(-1);
}

export function setAyahFamiliar(ref: string, value: boolean) {
  return db.transaction("rw", db.records, () => setFamiliar("words-known", ref, value));
}

async function saveStudyDay(now: Date, zone: string) {
  const days = await getRecord<string[]>("study-days", []);
  const today = dateKey(now, zone);
  if (!days.includes(today)) await db.records.put({ key: "study-days", value: [...days, today] });
}

export function finishSpeakUnit(id: string, now: Date, zone: string) {
  if (!speakUnit(id)) throw new RangeError("Unknown Speak unit.");
  return db.transaction("rw", db.records, async () => {
    const complete = await getRecord<string[]>(speakProgressKey, []);
    if (complete.includes(id)) return;
    await db.records.put({ key: speakProgressKey, value: [...complete, id] });
    await saveStudyDay(now, zone);
  });
}

export function saveHifzPlan(id: string, minutes: number, today: string) {
  return db.transaction("rw", db.records, async () => {
    const plans = await getRecord<HifzPlans>("hifz-plans", {});
    await db.records.bulkPut([{ key: "hifz-plans", value: { ...plans, [id]: { minutes, start: plans[id]?.start ?? today } } },
      { key: "hifz-current", value: id }]);
  });
}

export function savePortionReview(id: string, portion: string, grade: ReviewGrade, now: Date, zone: string, minutes: number) {
  return db.transaction("rw", db.records, async () => {
    const [reviews, plans] = await Promise.all([getRecord<HifzReviews>("hifz-portions", {}), getRecord<HifzPlans>("hifz-plans", {})]);
    const today = dateKey(now, zone);
    const review = ratePortion(reviews[portion], grade, now, today);
    if (!plans[id]) await db.records.put({ key: "hifz-plans", value: { ...plans, [id]: { minutes, start: today } } });
    await db.records.bulkPut([{ key: "hifz-portions", value: { ...reviews, [portion]: review } }, { key: "hifz-current", value: id }]);
    await saveStudyDay(now, zone);
    return review;
  });
}

export function saveJuzRecitalRating(juz: number, portions: HifzPortion[], portion: string, grade: ReviewGrade, now: Date, zone: string) {
  if (!juzs.some(entry => entry.number === juz)) throw new RangeError("Unknown juz.");
  return db.transaction("rw", db.records, async () => {
    const recitals = await getRecord<JuzRecitals>("hifz-juz-recitals", {});
    const next = rateRecitalPortion(portions, recitals[juz], portion, grade, dateKey(now, zone));
    if (!next) return;
    await db.records.put({ key: "hifz-juz-recitals", value: { ...recitals, [juz]: next } });
    await saveStudyDay(now, zone);
  });
}

export function markReadingPortion(mode: ReadingMode, chapter: number, ayahs: number[], now: Date, zone: string) {
  const selected = practiceChapters[mode].find(item => item.number === chapter);
  if (!selected || !ayahs.length || ayahs.some(ayah => !Number.isInteger(ayah) || ayah < 1 || ayah > selected.ayahs)) {
    throw new RangeError("Unknown reading portion.");
  }
  return db.transaction("rw", db.records, async () => {
    const progress = await getRecord("reading-practice", emptyReadingPractice);
    const previous = progress[mode][chapter] ?? [];
    const done = [...new Set([...previous, ...ayahs])].sort((a, b) => a - b);
    if (done.length === previous.length) return;
    await db.records.put({ key: "reading-practice", value: { ...progress, [mode]: { ...progress[mode], [chapter]: done } } });
    await saveStudyDay(now, zone);
  });
}

export function setTeacherCheck(chapter: number, item: RecitationCheck, checked: boolean, now: Date, zone: string) {
  if (!practiceChapters.teacher.some(entry => entry.number === chapter) || !recitationChecks.includes(item)) throw new RangeError("Unknown recitation check.");
  return db.transaction("rw", db.records, async () => {
    const progress = await getRecord("reading-practice", emptyReadingPractice);
    const previous = progress.teacher[chapter] ?? [];
    const next = checked ? [...new Set([...previous, item])] : previous.filter(check => check !== item);
    await db.records.put({ key: "reading-practice", value: { ...progress, teacher: { ...progress.teacher, [chapter]: next } } });
    if (teacherChecklistComplete(next)) await saveStudyDay(now, zone);
  });
}

async function writeReview(id: string, grade: Grade, recalled: boolean, now: Date, zone: string) {
  const reviews = await getRecord<Reviews>("reviews", {});
  const previous = reviews[id];
  const next = reviewWithRating(previous, grade, now);
  const today = dateKey(now, zone);
  const firstTries = Object.fromEntries(Object.entries(previous?.firstTries ?? {}).filter(([day]) => day >= addDays(today, -29)));
  next.firstTries = { [today]: recalled, ...firstTries };
  await db.records.put({ key: "reviews", value: { ...reviews, [id]: next } });
  await saveStudyDay(now, zone);
  return previous?.bucket !== "manzil" && next.bucket === "manzil";
}

export function saveSurahReview(id: number, grade: ReviewGrade, now: Date, zone: string) {
  return db.transaction("rw", db.records, () => writeReview(String(id), grades[grade], grade === "got-it", now, zone));
}

export function saveWordReview(id: string, grade: ReviewGrade, now: Date, zone: string) {
  return db.transaction("rw", db.records, async () => {
    await writeReview(id, grades[grade], grade === "got-it", now, zone);
    return grade === "got-it" ? await setFamiliar("word-bank-known", id, true) : undefined;
  });
}

export function saveLearningReview(id: string, grade: ReviewGrade, now: Date, zone: string) {
  return db.transaction("rw", db.records, () => writeReview(id, grades[grade], grade === "got-it", now, zone));
}

export function saveQaidaRowReview(lesson: number, row: number, grade: QaidaGrade, now: Date, zone: string) {
  if (!Number.isInteger(row) || !qaidaRows(lesson)[row]) throw new RangeError("Unknown Qaida row.");
  return db.transaction("rw", db.records, () => writeReview(qaidaReviewId(lesson, row), qaidaGrades[grade], grade !== "hard", now, zone));
}

export function saveTakhtiPractice(family: string, now: Date, zone: string) {
  return db.transaction("rw", db.records, async () => {
    const practised = await getRecord<string[]>("takhti-practised", []);
    if (!practised.includes(family)) await db.records.put({ key: "takhti-practised", value: [...practised, family] });
    await saveStudyDay(now, zone);
  });
}

export function saveFluencyPractice(record: "fluency-read" | "fluency-words", id: string, known: boolean, now: Date, zone: string) {
  return db.transaction("rw", db.records, async () => {
    const progress = await getRecord<string[]>(record, []);
    const next = known ? [...new Set([...progress, id])] : progress.filter(entry => entry !== id);
    await db.records.put({ key: record, value: next });
    if (known) await saveStudyDay(now, zone);
  });
}

export function rememberQaidaPlace(lesson: number, row?: number) {
  return db.transaction("rw", db.records, async () => {
    const completed = await getRecord<number[]>("qaida-complete", []);
    if (!completed.includes(lesson)) await db.records.put({ key: "qaida-current", value: lesson });
    if (row !== undefined) await db.records.put({ key: "qaida-row-" + lesson, value: row });
  });
}

export function finishQaidaLesson(lesson: number, now: Date, zone: string) {
  return db.transaction("rw", db.records, async () => {
    const completed = await getRecord<number[]>("qaida-complete", []);
    if (completed.includes(lesson)) return undefined;
    const all = [...completed, lesson];
    const remaining = qaida.lessons.filter(item => !all.includes(item.n));
    const next = remaining.find(item => item.n > lesson) ?? remaining[0];
    await db.records.bulkPut([
      { key: "qaida-complete", value: all },
      { key: "qaida-current", value: next?.n ?? qaida.lessons.length },
    ]);
    await saveStudyDay(now, zone);
    return { bookComplete: remaining.length === 0 };
  });
}
