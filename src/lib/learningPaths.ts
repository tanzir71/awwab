import curriculum from "../../handovers/H2-languages-paths-arabic-help/data/learning-paths.json";
import salah from "../../docs/content/surahs-for-salah.json";
import { chapters, type HifzReviews } from "./hifz";
import { type Reviews } from "./reviews";

export const tracks = ["read", "memorise", "understand", "speak"] as const;
export type Track = typeof tracks[number];
export type PathPlacement = Partial<Record<Track, { level: number; score: number; total: number; day: string }>>;
export type PathLevel = { id: string; title: string; units: string | string[]; tag?: string };
export const levels: Record<Track, PathLevel[]> = {
  read: curriculum.tracks.read.levels.map(item => ({ ...item, id: String(item.n) })),
  memorise: curriculum.tracks.memorise.levels.map(item => ({ ...item, id: String(item.n) })),
  understand: curriculum.tracks.understand.levels.map(item => ({ ...item, id: String(item.n) })),
  speak: [
    ...curriculum.tracks.speak.levels.map((item, i) => ({ ...item, id: String(i + 1), tag: item.n })),
    ...curriculum.tracks.speak.packs.map((item, i) => ({ id: String(i + 4), title: item.title, units: item.note, tag: "PACK" })),
  ],
};
export const trackStatus = {
  read: ["17 lessons", "Juz ʿAmma, speed and flow", "Nūn and mīm sākin, madd, qalqalah, stops", "Makhārij, ṣifāt, mushaf marks", "Record, compare, prepare for feedback"],
  memorise: ["Al-Fātiḥa, short surahs and prayer recitations", "37 surahs, shortest first", "Āyat al-Kursī, Al-Mulk, Yā-Sīn, Al-Kahf and more", "Al-Kahf and surahs for Friday and Eid", "A juz at a time · sabaq, sabqi, manzil"],
  understand: ["125 core words", "Nouns, verbs, particles and pronouns", "Verb forms and word families", "Juz ʿAmma, āyah by āyah", "Case endings and word order"],
  speak: ["Greetings, numbers, directions, SIM cards", "Work, family, health, hotel", "Opinions, stories, problems", "Shared with Ask in Arabic", "Jobs, contracts, colleagues"],
};
export const salahChapters = salah.surahs.slice(0, 11).map(item => item.number);

export function learnedSurahs(hifz: HifzReviews, earlier: Reviews) {
  const learned = new Set(chapters.filter(chapter => earlier[chapter.number]?.bucket === "manzil").map(chapter => chapter.number));
  const covered = new Map<number, Set<number>>();
  for (const [portion, review] of Object.entries(hifz)) {
    if (!review.learnedOn) continue;
    const match = portion.match(/^(\d+):(\d+)-(\d+):(\d+)$/);
    if (!match || match[1] !== match[3]) continue;
    const [, number, first, , last] = match.map(Number);
    const verses = covered.get(number) ?? new Set<number>();
    for (let ayah = first; ayah <= last; ayah++) verses.add(ayah);
    covered.set(number, verses);
  }
  for (const chapter of chapters) {
    const verses = covered.get(chapter.number);
    if (verses?.size === chapter.ayahs && verses.has(1) && verses.has(chapter.ayahs)) learned.add(chapter.number);
  }
  return learned;
}

export const juzAmma = chapters.slice(77).sort((a, b) => a.words - b.words || b.number - a.number);
export const pathUrl = (track: Track, level?: number) => `/learn/paths/${track}${level ? `/${level}` : ""}`;
export const patternReviewPrefix = "pattern:ktb:";
export const patternPracticePath = pathUrl("understand", 3) + "?practice";
export const grammarReviewPrefix = "grammar:";
export const grammarPath = pathUrl("understand", 2);
export const phraseReviewPrefix = "phrase:";
