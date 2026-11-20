import salah from "../../docs/content/surahs-for-salah.json";
import { chapters, type HifzReviews } from "./hifz";
import { type Reviews } from "./reviews";

export const tracks = ["read", "memorise", "understand", "speak"] as const;
export type Track = typeof tracks[number];
export type PathPlacement = Partial<Record<Track, { level: number; score: number; total: number; day: string }>>;
type PathLevel = { titleKey: string; tag?: string };
export const levels: Record<Track, PathLevel[]> = {
  read: [
    { titleKey: "qaida" },
    { titleKey: "readingFlow" },
    { titleKey: "pathsTajweedEssentials" },
    { titleKey: "tajweedDepthIndex" },
    { titleKey: "readingTeacher" },
  ],
  memorise: [
    { titleKey: "pathsSalahEssentials" },
    { titleKey: "pathsIslandJuz" },
    { titleKey: "pathsEssentialPassages" },
    { titleKey: "pathsFridayEid" },
    { titleKey: "pathsHifz" },
  ],
  understand: [
    { titleKey: "pathsCoreWords" },
    { titleKey: "grammarTitle" },
    { titleKey: "rootsTitle" },
    { titleKey: "readingMeaning" },
    { titleKey: "sentenceTitle" },
  ],
  speak: [
    { titleKey: "speakSurvival", tag: "A1" },
    { titleKey: "speakEverydayLevel", tag: "A2" },
    { titleKey: "speakConversation", tag: "B1" },
    { titleKey: "speakUmrah", tag: "pathsPack" },
    { titleKey: "speakWork", tag: "pathsPack" },
  ],
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
export const rootsPath = pathUrl("understand", 3);
export const patternPracticePath = rootsPath + "?practice";
export const rootsReviewPrefix = "roots:";
export const grammarReviewPrefix = "grammar:";
export const grammarPath = pathUrl("understand", 2);
export const sentenceStructurePath = pathUrl("understand", 5);
export const sentenceReviewPrefix = "sentence:";
export const phraseReviewPrefix = "phrase:";
