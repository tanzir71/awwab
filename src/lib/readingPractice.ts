import { getHifzPassage, groupPortions, studyChapters, type StudyQuran } from "./hifz";
import { juzAmma } from "./learningPaths";
import { coreWordKey, type Morphology } from "./morphology";

export type ReadingMode = "flow" | "meaning";
export type PracticeMode = ReadingMode | "teacher";

export const readingPracticePaths = {
  flow: "/learn/paths/read/2",
  meaning: "/learn/paths/understand/4",
  teacher: "/learn/paths/read/5",
} as const;

export const recitationChecks = ["opening", "pauses", "letters", "length", "questions"] as const;
export type RecitationCheck = typeof recitationChecks[number];
export type ReadingPracticeProgress = Record<ReadingMode, Record<number, number[]>> & { teacher: Record<number, RecitationCheck[]> };
export const emptyReadingPractice: ReadingPracticeProgress = { flow: {}, meaning: {}, teacher: {} };
export const readingFlowPlaceKey = "reading-flow-place";
export type ReadingFlowPlace = { chapter: number; ayah: number };

export const practiceChapters = {
  flow: juzAmma,
  meaning: juzAmma,
  teacher: [studyChapters.get(1)!, ...juzAmma],
};

export function practicePage(mode: PracticeMode, chapter: number, ayah?: number) {
  return `${readingPracticePaths[mode]}/${chapter}${ayah ? `?ayah=${ayah}` : ""}`;
}

export function readingPortions(chapter: number, quran: StudyQuran, maktab: boolean) {
  const passage = getHifzPassage(`surah-${chapter}`);
  return passage ? groupPortions(passage, quran, maktab ? { ayahs: 3, words: 22 } : undefined) : [];
}

export function completedReadingChapters(mode: ReadingMode, progress: ReadingPracticeProgress) {
  return practiceChapters[mode].filter(chapter => {
    const read = new Set(progress[mode][chapter.number]);
    return Array.from({ length: chapter.ayahs }, (_, index) => index + 1).every(ayah => read.has(ayah));
  }).length;
}

export function firstUnreadAyah(total: number, read: readonly number[]) {
  const complete = new Set(read);
  for (let ayah = 1; ayah <= total; ayah++) if (!complete.has(ayah)) return ayah;
  return 1;
}

export function teacherChecklistComplete(checks: readonly RecitationCheck[] = []) {
  return recitationChecks.every(item => checks.includes(item));
}

export function resumeFlowReading(progress: ReadingPracticeProgress, place?: ReadingFlowPlace) {
  const chapters = practiceChapters.flow;
  const bookmarked = chapters.find(chapter => chapter.number === place?.chapter);
  if (bookmarked && place && Number.isInteger(place.ayah) && place.ayah > 0 && place.ayah <= bookmarked.ayahs) {
    return { chapter: bookmarked, ayah: place.ayah };
  }
  const partial = (chapter: typeof chapters[number]) => new Set(progress.flow[chapter.number]).size;
  const chapter = chapters.find(item => partial(item) > 0 && partial(item) < item.ayahs)
    ?? chapters.find(item => partial(item) < item.ayahs) ?? chapters[0];
  return { chapter, ayah: firstUnreadAyah(chapter.ayahs, progress.flow[chapter.number] ?? []) };
}

export function rootsFromKnownWords(vocabulary: readonly Morphology[], known: ReadonlySet<string>) {
  const roots = new Set<string>();
  for (const word of vocabulary) if (word.root && known.has(coreWordKey(word))) roots.add(word.root);
  return roots;
}
