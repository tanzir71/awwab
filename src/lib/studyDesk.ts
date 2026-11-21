import { addDays, dateKey } from "./dates";
import { dailyPortions, getHifzPassage, groupPortions, portionBucket,
  type HifzPassage, type HifzPlans, type HifzPortion, type HifzReviews, type StudyQuran } from "./hifz";
import { grammarPath, grammarReviewPrefix, patternPracticePath, patternReviewPrefix, phraseReviewPrefix,
  rootsPath, rootsReviewPrefix, sentenceReviewPrefix, sentenceStructurePath } from "./learningPaths";
import { tajweedReviewDestination, tajweedReviewPrefix } from "./tajweed";
import { firstTryTotals, isDue, type Bucket, type Reviews } from "./reviews";
import { parseQaidaReview } from "./qaidaPractice";
import surahs from "../../docs/content/surahs-for-salah.json";

export const deskActivities = ["recall", "qaida", "memorise", "salah", "manzil", "takhti", "fluency"] as const;
export type DeskActivity = typeof deskActivities[number];
export const deskMinutes: Record<DeskActivity, number> = { recall: 2, qaida: 6, memorise: 7, salah: 1, manzil: 1, takhti: 4, fluency: 3 };
const salahReviewIds = new Set(surahs.surahs.slice(0, 12).map(chapter => String(chapter.number)));

export function studyPlanMinutes(hidden: DeskActivity[], memoriseMinutes = 0) {
  return deskActivities.reduce((minutes, activity) =>
    minutes + (hidden.includes(activity) ? 0 : activity === "memorise" ? memoriseMinutes : deskMinutes[activity]), 0);
}

type MemorisePlan = { passage: HifzPassage; portions: HifzPortion[]; minutes: number; start?: string };
type MemoriseItem = { passage: HifzPassage; portion: HifzPortion; position: number; minutes: number; bucket: Bucket; to: string };
export type MemoriseDesk = { due: MemoriseItem[]; forecast: Map<string, number>; attempts: number; correct: number };

export function memorisePlans(plans: HifzPlans, current: string, quran: StudyQuran): MemorisePlan[] {
  return [...new Set([current, ...Object.keys(plans)])].flatMap(id => {
    const passage = getHifzPassage(id);
    return passage ? [{ passage, portions: groupPortions(passage, quran), minutes: plans[id]?.minutes ?? deskMinutes.memorise,
      start: plans[id]?.start }] : [];
  });
}

export function memoriseDesk(plans: MemorisePlan[], reviews: HifzReviews, now: Date, zone: string): MemoriseDesk {
  const today = dateKey(now, zone);
  const due = new Map<string, MemoriseItem>();
  const upcoming = new Map<string, string>();
  for (const { passage, portions, minutes, start } of plans) {
    if (start && start > today) continue;
    const daily = dailyPortions(portions, reviews, now, today);
    for (const portion of daily.due) {
      if (due.has(portion.id)) continue;
      const position = portions.indexOf(portion) + 1;
      const bucket = portionBucket(reviews[portion.id], today);
      const estimate = bucket === "sabaq" ? minutes : Math.min(minutes, deskMinutes[bucket === "sabqi" ? "recall" : "manzil"]);
      due.set(portion.id, { passage, portion, position, minutes: estimate, bucket,
        to: `/learn/hifz/${passage.id}/${position}` });
    }
    for (const { id } of portions) {
      const record = reviews[id];
      if (id !== daily.sabaq?.id && !record?.learnedOn) continue;
      const bucket = portionBucket(record, today);
      const nextDay = addDays(record?.lastDay && record.lastDay > today ? record.lastDay : today, 1);
      const scheduled = bucket === "manzil" || portionBucket(record, nextDay) === "manzil"
        ? dateKey(new Date(record.review.card.due), zone) : undefined;
      const next = bucket === "manzil" ? scheduled : scheduled && scheduled > nextDay ? scheduled : nextDay;
      if (!upcoming.has(id)) upcoming.set(id, next);
    }
  }

  const forecast = new Map<string, number>();
  for (const [id, day] of upcoming) {
    const next = due.has(id) ? today : day;
    forecast.set(next, (forecast.get(next) ?? 0) + 1);
  }
  const order: Bucket[] = ["sabaq", "sabqi", "manzil"];
  return { due: [...due.values()].sort((a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket)), forecast,
    ...firstTryTotals(Object.values(reviews).map(({ review }) => review), today) };
}

export function isPathReview(id: string) {
  return [patternReviewPrefix, tajweedReviewPrefix, grammarReviewPrefix, rootsReviewPrefix, sentenceReviewPrefix, phraseReviewPrefix].some(prefix => id.startsWith(prefix));
}

export function isSurahStudyReview(id: string) {
  return salahReviewIds.has(id) || id.startsWith("letter:") || id.startsWith("word:") || Boolean(parseQaidaReview(id));
}

export function reviewQueue(reviews: Reviews, now: Date, zone: string) {
  const today = dateKey(now, zone);
  const due = Object.entries(reviews).filter(([, review]) => isDue(review, now));
  const history = new Map<string, number>();
  for (const review of Object.values(reviews)) {
    if (!isDue(review, now)) {
      const day = dateKey(new Date(review.card.due), zone);
      history.set(day, (history.get(day) ?? 0) + 1);
    }
  }
  const forecast = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index);
    return { day, count: (history.get(day) ?? 0) + (index === 0 ? due.length : 0) };
  });
  return { due, forecast, ...firstTryTotals(Object.values(reviews), today) };
}

export function reviewDestination(id?: string) {
  if (!id) return "/learn/surahs";
  if (/^\d+$/.test(id)) return `/learn/surahs/${id}?mode=recall`;
  if (id.startsWith(patternReviewPrefix)) return patternPracticePath;
  if (id.startsWith(tajweedReviewPrefix)) return tajweedReviewDestination(id);
  if (id.startsWith(grammarReviewPrefix)) return `${grammarPath}/${encodeURIComponent(id.slice(grammarReviewPrefix.length))}`;
  if (id.startsWith(rootsReviewPrefix)) return `${rootsPath}/${encodeURIComponent(id.slice(rootsReviewPrefix.length))}`;
  if (id.startsWith(sentenceReviewPrefix)) return `${sentenceStructurePath}/${encodeURIComponent(id.slice(sentenceReviewPrefix.length))}`;
  if (id.startsWith(phraseReviewPrefix)) {
    const [unit, word] = id.slice(phraseReviewPrefix.length).split(":");
    return `/learn/speak/${encodeURIComponent(unit)}?review=${encodeURIComponent(word ?? "")}`;
  }
  const qaida = parseQaidaReview(id);
  if (qaida) return `/learn/qaida/${qaida.lesson}?row=${qaida.row + 1}`;
  if (id.startsWith("letter:")) return "/learn/qaida";
  return "/learn/words?status=due";
}
