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

type ReadingExample = { rule: string; lesson: string; tone: typeof tajweedTones[number]; joining?: true; ghunnah?: boolean };

export function tajweedReadingRuleKey(example: ReadingExample) {
  if (example.rule === "idgham" && example.ghunnah !== undefined) {
    return example.ghunnah ? "tajweedRule-idgham-ghunnah" : "tajweedRule-idgham-no-ghunnah";
  }
  return `tajweedRule-${example.rule}` as const;
}

function addReadingExample(words: ReadingExample[][], index: number, example: ReadingExample) {
  const notes = words[index] ??= [];
  const existing = notes.findIndex(note => note.rule === example.rule);
  if (existing === -1) notes.push(example);
  else if (example.joining) notes[existing] = example;
}

const ruleExamples = new Map(tajweedLessons.flatMap(lesson => Object.keys(lesson.rules).map((rule, index) =>
  [rule, { rule, lesson: lesson.id, tone: tajweedTones[index % tajweedTones.length] }] as const)));
ruleExamples.set("izhar-mutlaq", { rule: "izhar-mutlaq", lesson: "nun", tone: "neutral" });
const readingExamples = new Map<string, ReadingExample[][]>();
for (const lesson of tajweedLessons) {
  if (lesson.id === "waqf") continue;
  for (const sample of lesson.samples) {
    const ref = tajweedReference(sample);
    const words = readingExamples.get(ref) ?? [];
    for (let index = sample.first - 1; index < sample.last; index++) {
      const example = ruleExamples.get(sample.rule);
      if (example) addReadingExample(words, index, example);
    }
    readingExamples.set(ref, words);
  }
}

export const tajweedReadingExamples = (verse: string) => readingExamples.get(verse);

const pauseMarks: Record<string, string> = {
  "ۖ": "waqf-continue", "ۗ": "waqf-pause", "ۘ": "waqf-required",
  "ۙ": "waqf-avoid", "ۚ": "waqf-choice", "ۛ": "waqf-pair",
};
const readingPauseMarks = /[\u0615\u0617\u06d6-\u06db]/gu;
const sukun = /[ْۡ]/u;
const smallMim = /[ۭۢ]/u;
const nextNunRules = new Map(Object.entries(originalLesson.rules).flatMap(([rule, letters]) =>
  Array.from(letters.replace(/\s/gu, ""), letter => [letter, rule] as const)));

function followingConsonant(glyph: string) {
  const base = glyph[0];
  if (!base || base === "ٱ") return "";
  if (/[ءأإآؤئ]/u.test(base) || (base === "ا" && /[َُِٰ]/u.test(glyph))) return "ء";
  if (/[ىی]/u.test(base)) return "ي";
  return /^[بتثجحخدذرزسشصضطظعغفقكلمنهوي]$/u.test(base) ? base : "";
}

function adjacentSukunRule(glyph: string, next: string, joining: boolean) {
  if (!next) return;
  if (/^ن[ْۭۡۢ\u034f]*$/u.test(glyph)) {
    const rule = nextNunRules.get(next);
    // The editions can omit sukūn on a nūn that will be hidden or merged.
    if (rule === "ikhfa" || (rule === "idgham" && joining)) return rule;
    if (rule === "iqlab" && smallMim.test(glyph)) return rule;
    if (rule === "izhar" && sukun.test(glyph)) return rule;
    if (!joining && /[يو]/u.test(next) && sukun.test(glyph)) return "izhar-mutlaq";
  }
  if (/^م[ْۡ\u034f]*$/u.test(glyph)) {
    if (joining && next === "ب") return "mim-hide";
    if (joining && next === "م") return "mim-merge";
    if (sukun.test(glyph) && next !== "ب" && next !== "م") return "mim-clear";
  }
}

function markedWordRules(letters: string[]) {
  const rules = new Set<string>();
  letters.forEach((glyph, index) => {
    // A word-initial shaddah can come from joining to the previous word.
    if (index > 0 && glyph.includes("ّ")) {
      if (glyph.startsWith("ن")) rules.add("ghunnah-nun");
      if (glyph.startsWith("م")) rules.add("ghunnah-mim");
    }
    const next = letters[index + 1];
    if (!next) return;
    if (/^[قطبجد].*[ْۡ]/u.test(glyph)) rules.add("qalqalah-inside");
    const rule = adjacentSukunRule(glyph, followingConsonant(next), false);
    if (rule) rules.add(rule);
  });
  return rules;
}

function joinedWordRule(letters: string[], next: string) {
  const final = letters.at(-1) ?? "";
  const tanwin = /[ًٌٍ]/u.test(final) || (/^[اىی]/u.test(final) && /ً/u.test(letters.at(-2) ?? ""));
  if (tanwin || (next === "ب" && smallMim.test(final))) return nextNunRules.get(next);
  return adjacentSukunRule(final, next, true);
}

function readingWords(text: string) {
  const words: { letters: string[]; pauses: string[] }[] = [];
  for (const part of splitArabicPhrase(text)) {
    if (part.word) words.push({ letters: splitGraphemes(part.text), pauses: [] });
    const pauses = part.text.match(readingPauseMarks);
    if (pauses) words.at(-1)?.pauses.push(...pauses);
  }
  return words;
}

export function tajweedVerseExamples(verse: QuranVerse, script: "uthmani" | "indopak") {
  const curated = tajweedReadingExamples(verse.ref);
  if (Number(verse.ref.split(":")[0]) < 78) return curated;

  const examples = curated?.map(notes => notes.slice()) ?? [];
  const uthmani = readingWords(splitUthmaniOpening(verse.uthmani, verse.ref).text);
  const indopak = readingWords(verse.indopak);
  uthmani.forEach(({ letters, pauses }, index) => {
    if (script === "uthmani") {
      for (const mark of pauses) {
        const rule = pauseMarks[mark];
        if (rule) addReadingExample(examples, index, { rule, lesson: "waqf", tone: "accent" });
      }
    }
    if (uthmani.length !== indopak.length) return;
    const other = indopak[index];
    const localRules = markedWordRules(letters);
    const otherRules = markedWordRules(other.letters);
    for (const rule of localRules) {
      const example = ruleExamples.get(rule);
      if (example && otherRules.has(rule)) addReadingExample(examples, index, example);
    }
    if (pauses.length || other.pauses.length || index + 1 === uthmani.length) return;
    const next = followingConsonant(uthmani[index + 1].letters[0]);
    if (!next || next !== followingConsonant(indopak[index + 1].letters[0])) return;
    const rule = joinedWordRule(letters, next);
    if (!rule) return;
    const example = ruleExamples.get(rule);
    if (example && (!localRules.has(rule) || !otherRules.has(rule))
      && rule === joinedWordRule(other.letters, next)) {
      const ghunnah = rule === "idgham" ? /[ينمو]/u.test(next) : undefined;
      addReadingExample(examples, index, { ...example, joining: true, ghunnah });
    }
  });
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
