import { addDays, dateKey } from "./dates";
import { countKnownQuranWords } from "./quran";
import { reviewCard, type ReviewGrade, type Reviews } from "./reviews";
import { db, getRecord } from "./storageService";
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

async function writeReview(id: string, grade: ReviewGrade, now: Date, zone: string) {
  const reviews = await getRecord<Reviews>("reviews", {});
  const previous = reviews[id];
  const next = reviewCard(previous, grade, now);
  const today = dateKey(now, zone);
  const firstTries = Object.fromEntries(Object.entries(previous?.firstTries ?? {}).filter(([day]) => day >= addDays(today, -29)));
  next.firstTries = { [today]: grade === "got-it", ...firstTries };
  await db.records.put({ key: "reviews", value: { ...reviews, [id]: next } });
  await saveStudyDay(now, zone);
  return previous?.bucket !== "manzil" && next.bucket === "manzil";
}

export function saveSurahReview(id: number, grade: ReviewGrade, now: Date, zone: string) {
  return db.transaction("rw", db.records, () => writeReview(String(id), grade, now, zone));
}

export function saveWordReview(id: string, grade: ReviewGrade, now: Date, zone: string) {
  return db.transaction("rw", db.records, async () => {
    await writeReview(id, grade, now, zone);
    return grade === "got-it" ? await setFamiliar("word-bank-known", id, true) : undefined;
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
