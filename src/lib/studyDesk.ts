import { addDays, dateKey } from "./dates";
import { patternPracticePath, patternReviewPrefix } from "./learningPaths";
import { isDue, type Reviews } from "./reviews";
import { parseQaidaReview } from "./qaidaPractice";

export const deskActivities = ["recall", "qaida", "salah", "manzil", "takhti", "fluency"] as const;
export type DeskActivity = typeof deskActivities[number];
export const deskMinutes: Record<DeskActivity, number> = { recall: 2, qaida: 6, salah: 1, manzil: 1, takhti: 4, fluency: 3 };

export function studyPlanMinutes(hidden: DeskActivity[]) {
  return deskActivities.reduce((minutes, activity) => minutes + (hidden.includes(activity) ? 0 : deskMinutes[activity]), 0);
}

export function reviewQueue(reviews: Reviews, now: Date, zone: string) {
  const today = dateKey(now, zone);
  const recallWindowStart = addDays(today, -29);
  const due = Object.entries(reviews).filter(([, review]) => isDue(review, now));
  const history = new Map<string, number>();
  let correct = 0;
  let attempts = 0;
  for (const review of Object.values(reviews)) {
    if (!isDue(review, now)) {
      const day = dateKey(new Date(review.card.due), zone);
      history.set(day, (history.get(day) ?? 0) + 1);
    }
    for (const [day, remembered] of Object.entries(review.firstTries ?? {})) {
      if (day < recallWindowStart || day > today) continue;
      attempts++;
      if (remembered) correct++;
    }
  }
  const forecast = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index);
    return { day, count: (history.get(day) ?? 0) + (index === 0 ? due.length : 0) };
  });
  return { due, forecast, attempts, correct };
}

export function reviewDestination(id?: string) {
  if (!id) return "/learn/surahs";
  if (/^\d+$/.test(id)) return `/learn/surahs/${id}?mode=recall`;
  if (id.startsWith(patternReviewPrefix)) return patternPracticePath;
  const qaida = parseQaidaReview(id);
  if (qaida) return `/learn/qaida/${qaida.lesson}?row=${qaida.row + 1}`;
  if (id.startsWith("letter:")) return "/learn/qaida";
  return "/learn/words?status=due";
}
