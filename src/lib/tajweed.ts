import originalLesson from "../../docs/content/tajweed-nun.json";
import essentials from "../../docs/content/tajweed-essentials.json";
import recitations from "../../public/packs/audio/index.json";
import { splitArabicPhrase, splitArabicWords } from "./wordAnatomy";
import type { Reviews } from "./reviews";

export type TajweedSample = { rule: string; chapter: number; ayah: number; first: number; last: number };
export type TajweedLesson = { id: string; rules: Record<string, string>; samples: TajweedSample[]; source?: string };
export const tajweedLessons: TajweedLesson[] = [{ id: "nun", ...originalLesson }, ...essentials];
export const tajweedRoute = "/learn/paths/read/3";
export const tajweedIndex = `${tajweedRoute}/lessons`;
export const tajweedReviewPrefix = "rule:";
export const tajweedLessonPath = (id: string) => id === "nun" ? tajweedRoute : `${tajweedRoute}/${id}`;
export const tajweedTitleKey = (id: string) => id === "nun" ? "tajweedNunTitle" : `tajweedTitle-${id}`;
export const tajweedIntroKey = (id: string) => id === "nun" ? "tajweedNunIntro" : `tajweedIntro-${id}`;
export const tajweedReference = (sample: TajweedSample) => `${sample.chapter}:${sample.ayah}`;
export const tajweedSampleKey = (sample: TajweedSample) => `${tajweedReference(sample)}:${sample.first}`;
export const tajweedReviewId = (lesson: TajweedLesson, sample: TajweedSample) => `${tajweedReviewPrefix}${lesson.id}:${tajweedSampleKey(sample)}`;

const recitationClips = new Map(recitations.packs.flatMap(pack => pack.items.map(item => [item.ref, { item, pack }] as const)));
export const tajweedClip = (sample: TajweedSample) => recitationClips.get(tajweedReference(sample));
export const tajweedPrecache = Array.from(new Set(tajweedLessons.flatMap(lesson => lesson.samples.flatMap(sample => tajweedClip(sample)?.item.path ?? []))));

export function tajweedReviewDestination(id: string) {
  const separator = id.indexOf(":", tajweedReviewPrefix.length);
  if (separator === -1) return tajweedIndex;
  const lesson = tajweedLessons.find(item => item.id === id.slice(tajweedReviewPrefix.length, separator));
  if (!lesson) return tajweedIndex;
  return `${tajweedLessonPath(lesson.id)}?review=${encodeURIComponent(id.slice(separator + 1))}`;
}

export function correctTajweedSamples(lesson: TajweedLesson, reviews: Reviews) {
  return lesson.samples.filter(sample => (reviews[tajweedReviewId(lesson, sample)]?.correct ?? 0) > 0).length;
}

export function tajweedProgress(reviews: Reviews) {
  let correct = 0;
  let total = 0;
  let completed = 0;
  for (const lesson of tajweedLessons) {
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
