import originalLesson from "../../docs/content/tajweed-nun.json" with { type: "json" };
import essentials from "../../docs/content/tajweed-essentials.json" with { type: "json" };
import depth from "../../docs/content/tajweed-in-depth.json" with { type: "json" };
import { splitUthmaniOpening } from "./quranOpening.ts";
import { splitArabicPhrase, splitArabicWords, splitGraphemes } from "./wordAnatomy.ts";
import type { QuranVerse } from "./quran";
import type { Reviews } from "./reviews";
import { studyRecitation } from "./studyRecitations.ts";

export type TajweedSample = { rule: string; chapter: number; ayah: number; first: number; last: number; target?: string };
export type TajweedLesson = {
  id: string;
  rules: Record<string, string>;
  samples: TajweedSample[];
  source?: string;
  sources?: { title: string; url: string }[];
  articulation?: Record<string, { name: string[]; letters: string }[]>;
};
export const tajweedLessons: TajweedLesson[] = [{ id: "nun", ...originalLesson }, ...essentials];
export const tajweedDepthLessons: TajweedLesson[] = depth;
export const tajweedRoute = "/learn/paths/read/3";
export const tajweedIndex = `${tajweedRoute}/lessons`;
export const tajweedDepthIndex = "/learn/paths/read/4";
export const tajweedReviewPrefix = "rule:";
export const tajweedLessonPath = (id: string) => id === "nun" ? tajweedRoute :
  `${tajweedDepthLessons.some(lesson => lesson.id === id) ? tajweedDepthIndex : tajweedRoute}/${id}`;
export const tajweedTitleKey = (id: string) => id === "nun" ? "tajweedNunTitle" : `tajweedTitle-${id}`;
export const tajweedTones = ["neutral", "tint", "soft", "accent"] as const;
export const tajweedIntroKey = (id: string) => id === "nun" ? "tajweedNunIntro" : `tajweedIntro-${id}`;
export function tajweedLessonSources(lesson: TajweedLesson, advanced: boolean) {
  return lesson.sources ?? [advanced
    ? { title: "Ibn al-Jazarī · Al-Muqaddimah al-Jazariyyah", url: "https://mutun.al-asl.com/jazariyyah.html" }
    : {
      url: lesson.source ?? "https://qul.tarteel.ai/tajweed_words/85:13:3",
      title: lesson.id === "waqf" ? "Quranic Arabic Corpus · Pause marks" : "Quranic Universal Library · Tajweed",
    }];
}
export const tajweedReference = (sample: TajweedSample) => `${sample.chapter}:${sample.ayah}`;
export const tajweedSampleKey = (sample: TajweedSample) => `${tajweedReference(sample)}:${sample.first}`;
export const tajweedReviewId = (lesson: TajweedLesson, sample: TajweedSample) => `${tajweedReviewPrefix}${lesson.id}:${tajweedSampleKey(sample)}`;

type ReadingExample = { rule: string; lesson: string; tone: typeof tajweedTones[number] };

function addReadingExample(words: ReadingExample[][], index: number, example: ReadingExample) {
  const notes = words[index] ??= [];
  if (!notes.some(note => note.rule === example.rule)) notes.push(example);
}

const readingExamples = new Map<string, ReadingExample[][]>();
for (const lesson of tajweedLessons) {
  if (lesson.id === "waqf") continue;
  const rules = Object.keys(lesson.rules);
  for (const sample of lesson.samples) {
    const ref = tajweedReference(sample);
    const words = readingExamples.get(ref) ?? [];
    const tone = tajweedTones[rules.indexOf(sample.rule) % tajweedTones.length];
    for (let index = sample.first - 1; index < sample.last; index++) {
      addReadingExample(words, index, { rule: sample.rule, lesson: lesson.id, tone });
    }
    readingExamples.set(ref, words);
  }
}

export const tajweedReadingExamples = (verse: string) => readingExamples.get(verse);

const pauseMarks: Record<string, string> = {
  "ۖ": "waqf-continue", "ۗ": "waqf-pause", "ۘ": "waqf-required",
  "ۙ": "waqf-avoid", "ۚ": "waqf-choice", "ۛ": "waqf-pair",
};

function markedWordRules(text: string) {
  const letters = splitGraphemes(text);
  const rules = new Set<string>();
  letters.forEach((glyph, index) => {
    // A word-initial shaddah can come from joining to the previous word.
    if (index > 0 && glyph.includes("ّ")) {
      if (glyph.startsWith("ن")) rules.add("ghunnah-nun");
      if (glyph.startsWith("م")) rules.add("ghunnah-mim");
    }
    if (index < letters.length - 1 && /^[قطبجد].*[ْۡ]/u.test(glyph)) rules.add("qalqalah-inside");
  });
  return rules;
}

export function tajweedVerseExamples(verse: QuranVerse, script: "uthmani" | "indopak") {
  const curated = tajweedReadingExamples(verse.ref);
  if (Number(verse.ref.split(":")[0]) < 78) return curated;

  const examples = curated?.map(notes => notes.slice()) ?? [];
  const parts = splitArabicPhrase(splitUthmaniOpening(verse.uthmani, verse.ref).text);
  const indopakWords = splitArabicPhrase(verse.indopak).filter(part => part.word);
  const sameWordCount = parts.filter(part => part.word).length === indopakWords.length;
  let word = -1;
  for (const part of parts) {
    if (part.word) word++;
    if (part.word && sameWordCount) {
      const otherRules = markedWordRules(indopakWords[word].text);
      for (const rule of markedWordRules(part.text)) {
        // IndoPak and Uthmani sometimes mark joining or sukūn differently.
        if (!otherRules.has(rule)) continue;
        const lesson = rule === "qalqalah-inside" ? "qalqalah" : "ghunnah";
        addReadingExample(examples, word, { rule, lesson, tone: rule === "ghunnah-mim" ? "tint" : "neutral" });
      }
    }
    if (word < 0 || script !== "uthmani") continue;
    for (const mark of part.text.match(/[\u06d6-\u06db]/gu) ?? []) {
      addReadingExample(examples, word, { rule: pauseMarks[mark], lesson: "waqf", tone: "accent" });
    }
  }
  return examples.length ? examples : undefined;
}

export const tajweedClip = (sample: TajweedSample) => studyRecitation(tajweedReference(sample));
const completeCatalogue = [...tajweedLessons, ...tajweedDepthLessons];
export const tajweedPrecache = Array.from(new Set(completeCatalogue.flatMap(lesson => lesson.samples.flatMap(sample => tajweedClip(sample)?.path ?? []))));

export function tajweedReviewDestination(id: string) {
  const separator = id.indexOf(":", tajweedReviewPrefix.length);
  if (separator === -1) return tajweedIndex;
  const lesson = completeCatalogue.find(item => item.id === id.slice(tajweedReviewPrefix.length, separator));
  if (!lesson) return tajweedIndex;
  return `${tajweedLessonPath(lesson.id)}?review=${encodeURIComponent(id.slice(separator + 1))}`;
}

export function correctTajweedSamples(lesson: TajweedLesson, reviews: Reviews) {
  return lesson.samples.filter(sample => (reviews[tajweedReviewId(lesson, sample)]?.correct ?? 0) > 0).length;
}

export function tajweedProgress(reviews: Reviews, lessons = tajweedLessons) {
  let correct = 0;
  let total = 0;
  let completed = 0;
  for (const lesson of lessons) {
    const count = correctTajweedSamples(lesson, reviews);
    correct += count;
    total += lesson.samples.length;
    if (count === lesson.samples.length) completed++;
  }
  return { completed, stars: Math.floor(correct * 5 / total) };
}

export function tajweedPracticeSamples(lesson: TajweedLesson, reviews: Reviews, short: boolean) {
  if (!short) return lesson.samples;
  const remaining = lesson.samples.filter(sample => !reviews[tajweedReviewId(lesson, sample)]?.correct);
  return (remaining.length ? remaining : lesson.samples).slice(0, 4);
}

export function tajweedExcerpt(text: string, sample: TajweedSample, preservePauses: boolean) {
  if (!preservePauses) return splitArabicWords(text).slice(sample.first - 1, sample.last).join(" ");
  const words: string[] = [];
  for (const part of splitArabicPhrase(text)) {
    if (part.word) words.push(part.text);
    else if (words.length) words[words.length - 1] += part.text.match(/[\u06d6-\u06db]/gu)?.join("") ?? "";
  }
  return words.slice(sample.first - 1, sample.last).join(" ");
}
