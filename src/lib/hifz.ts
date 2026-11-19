import index from "../../public/data/quran-study-index-v1.json";
import catalogue from "../../handovers/H2-languages-paths-arabic-help/data/essential-passages.json";
import { asset } from "./config";
import { addDays } from "./dates";
import { dayDifference } from "./hijri";
import type { QuranVerse } from "./quran";
import { isDue, reviewCard, type Bucket, type Review, type ReviewGrade } from "./reviews";
import { splitArabicWords } from "./wordAnatomy";

export const chapters = index.chapters;
export const studyChapters = new Map(chapters.map(chapter => [chapter.number, chapter]));
export const juzs = index.juzs;
export const kursiOpening = index.kursi;
export const essentialPassages = catalogue.passages;

export const maxPortionAyahs = 5;
export const maxPortionWords = 40;
const wordsPerMinute = 2.4;
const basmala = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
type Script = "uthmani" | "indopak";
type VerseRange = { chapter: number; from: number; to: number };
export type HifzPassage = { id: string; title: string; ranges: VerseRange[]; ayahs: number; source?: { ref: string; grade: string }; why?: string };
export type HifzPortion = { id: string; ref: string; verses: QuranVerse[]; words: number };
export type PortionReview = { review: Review; correctDays: string[]; lastDay: string; learnedOn?: string };
export type HifzReviews = Record<string, PortionReview>;
export type HifzPlans = Record<string, { minutes: number; start: string }>;
export type StudyQuran = { version: number; notice: string; surahs: Record<number, QuranVerse[]> };
export type JuzRecital = { rated: Partial<Record<string, ReviewGrade>>; last?: { day: string; remembered: number; total: number } };
export type JuzRecitals = Record<number, JuzRecital>;

let edition: Promise<StudyQuran> | undefined;
export function studyQuran() {
  edition ??= fetch(asset("data/quran-study-v1.json.gz")).then(async response => {
    if (!response.ok) throw new Error("The offline study edition is unavailable.");
    const bytes = await response.arrayBuffer();
    const signature = new Uint8Array(bytes, 0, 2);
    const payload = signature[0] === 31 && signature[1] === 139
      ? new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))) : new Response(bytes);
    return await payload.json() as StudyQuran;
  }).catch(error => { edition = undefined; throw error; });
  return edition;
}

export function verseText(verse: QuranVerse, script: Script) {
  return script === "uthmani" && verse.ref !== "1:1" && verse.uthmani.startsWith(`${basmala} `)
    ? { text: verse.uthmani.slice(basmala.length + 1), opening: basmala }
    : { text: verse[script], opening: undefined };
}

function chapterRanges(from: number, to: number) {
  return chapters.flatMap(chapter => {
    const first = Math.max(from, chapter.start);
    const last = Math.min(to, chapter.start + chapter.ayahs);
    return first < last ? [{ chapter: chapter.number, from: first - chapter.start + 1, to: last - chapter.start }] : [];
  });
}

export function getHifzPassage(id: string): HifzPassage | undefined {
  const custom = essentialPassages.find(item => item.id === id);
  if (custom) {
    const ranges = custom.ref.split(" · ").map(part => {
      const [number, ayahs] = part.split(":");
      const chapter = studyChapters.get(Number(number));
      const [first, last] = (ayahs ?? `1-${chapter.ayahs}`).split("-");
      return { chapter: chapter.number, from: Number(first), to: Number(last ?? first) };
    });
    // Show the handover's categorical grades with their references. Uncertain and missing gradings have no virtue card.
    const source = custom.source && ["sahih", "hasan"].includes(custom.source.grade) ? custom.source : undefined;
    return { id, title: custom.title, ranges, ayahs: ranges.reduce((sum, range) => sum + range.to - range.from + 1, 0), source, why: source ? custom.why : undefined };
  }
  const match = id?.match(/^(surah|juz)-(\d{1,3})$/);
  if (!match) return undefined;
  const number = Number(match[2]);
  if (match[1] === "surah") {
    const chapter = studyChapters.get(number);
    if (!chapter) return undefined;
    return { id, title: chapter.title, ranges: [{ chapter: number, from: 1, to: chapter.ayahs }], ayahs: chapter.ayahs };
  }
  const juz = juzs[number - 1];
  if (!juz) return undefined;
  const end = juzs[number]?.offset ?? 6236;
  return { id, title: `Juz ${number}`, ranges: chapterRanges(juz.offset, end), ayahs: end - juz.offset };
}

export function rangeLabel(chapter: number, first: number, last: number) {
  return `${chapter}:${first}${last !== first ? `–${last}` : ""}`;
}

export function passageLabel(passage: HifzPassage) {
  const { ranges } = passage;
  const last = ranges.at(-1);
  const first = ranges[0];
  return passage.id.startsWith("juz-") ? `${first.chapter}:${first.from}–${last.chapter}:${last.to}`
    : ranges.map(range => rangeLabel(range.chapter, range.from, range.to)).join(" · ");
}

export function groupPortions(passage: HifzPassage, quran: StudyQuran, limits = { ayahs: maxPortionAyahs, words: maxPortionWords }) {
  return passage.ranges.flatMap(({ chapter, from, to }) => {
    const groups: HifzPortion[] = [];
    let pending: QuranVerse[] = [];
    let words = 0;
    function push() {
      if (!pending.length) return;
      const [first, last] = [pending[0].ref, pending.at(-1).ref];
      groups.push({ id: `${first}-${last}`, ref: rangeLabel(chapter, Number(first.split(":")[1]), Number(last.split(":")[1])), verses: pending, words });
      pending = [];
      words = 0;
    }
    for (const verse of quran.surahs[chapter].slice(from - 1, to)) {
      const count = splitArabicWords(verseText(verse, "uthmani").text).length;
      if (pending.length === limits.ayahs || words + count > limits.words) push();
      pending.push(verse);
      words += count;
      if (words >= limits.words) push();
    }
    push();
    return groups;
  });
}

export function studyPhrases(verse: QuranVerse, script: Script, includeShortVerses = false) {
  const rendered = verseText(verse, script).text;
  if (!includeShortVerses && splitArabicWords(verseText(verse, "uthmani").text).length <= maxPortionWords) return rendered;
  // Keep the waqf signs and split the reading display, not the review item.
  return rendered.replace(/([ۖۗۘۚۛؕؗ])\s+/g, "$1\n");
}

export function portionPlan(portions: HifzPortion[], minutes: number, start: string) {
  const capacity = Math.max(1, minutes * wordsPerMinute);
  let words = 0;
  const dates = portions.map(portion => {
    const begins = Math.floor(words / capacity);
    words += portion.words;
    const ends = Math.max(begins, Math.ceil(words / capacity) - 1);
    return { from: addDays(start, begins), to: addDays(start, ends) };
  });
  const days = Math.max(1, Math.ceil(words / capacity));
  return { dates, days, words, end: addDays(start, days - 1) };
}

export function ratePortion(previous: PortionReview | undefined, grade: ReviewGrade, now: Date, day: string): PortionReview {
  const correctDays = previous?.correctDays ?? [];
  const next = grade === "got-it" && correctDays.length < 3 && !correctDays.includes(day) ? [...correctDays, day] : correctDays;
  return { review: reviewCard(previous?.review, grade, now), correctDays: next, lastDay: day,
    learnedOn: previous?.learnedOn ?? (next.length === 3 ? day : undefined) };
}

export function portionBucket(record: PortionReview | undefined, today: string): Bucket {
  if (!record?.learnedOn) return "sabaq";
  return dayDifference(today, record.learnedOn) <= 7 ? "sabqi" : "manzil";
}

export function nextPortion(portions: HifzPortion[], reviews: HifzReviews, now: Date, today: string) {
  return portions.find(portion => {
    const record = reviews[portion.id];
    const bucket = portionBucket(record, today);
    return bucket === "manzil" ? isDue(record.review, now) : bucket === "sabqi" && record.lastDay < today;
  }) ?? portions.find(portion => !reviews[portion.id]?.learnedOn);
}

export function recitalProgress(portions: HifzPortion[], recital: JuzRecital | undefined, today: string) {
  const nextDay = recital?.last ? addDays(recital.last.day, 7) : undefined;
  const waiting = nextDay && today < nextDay;
  if (waiting) return { count: portions.length, next: undefined, availableOn: nextDay };
  return {
    count: portions.filter(portion => recital?.rated[portion.id]).length,
    next: portions.find(portion => !recital?.rated[portion.id]),
    availableOn: undefined,
  };
}

export function rateRecitalPortion(portions: HifzPortion[], recital: JuzRecital | undefined, id: string, grade: ReviewGrade, today: string): JuzRecital | undefined {
  const progress = recitalProgress(portions, recital, today);
  if (progress.next?.id !== id) return;
  const rated = { ...recital?.rated, [id]: grade };
  if (progress.count + 1 < portions.length) return { rated, last: recital?.last };
  const remembered = portions.filter(portion => rated[portion.id] === "got-it").length;
  return { rated: {}, last: { day: today, remembered, total: portions.length } };
}
