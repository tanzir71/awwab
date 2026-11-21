import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";
import { addDays } from "./dates";

export type Bucket = "sabaq" | "sabqi" | "manzil";
export type ReviewGrade = "forgot" | "shaky" | "got-it";
export interface Review {
  card: Card;
  bucket: Bucket;
  attempts?: number;
  correct?: number;
  firstTries?: Record<string, boolean>;
}
export type Reviews = Record<string, Review>;
export const grades = { forgot: Rating.Again, shaky: Rating.Hard, "got-it": Rating.Good } satisfies Record<ReviewGrade, Grade>;
export const qaidaGrades = { hard: Rating.Hard, okay: Rating.Good, easy: Rating.Easy } as const;
export type QaidaGrade = keyof typeof qaidaGrades;
const scheduler = fsrs({ enable_fuzz: false });
const recallWindowDays = 30;

export function newReview(now: Date): Review {
  return { card: createEmptyCard(now), bucket: "sabaq" };
}

export function reviewWithRating(previous: Review | undefined, grade: Grade, now: Date, today?: string): Review {
  const saved = previous?.card;
  const card = saved ? { ...saved, due: new Date(saved.due), last_review: saved.last_review ? new Date(saved.last_review) : undefined } : createEmptyCard(now);
  const reviewed = scheduler.next(card, now, grade).card;
  const correct = grade >= Rating.Good;
  const earliest = today && addDays(today, 1 - recallWindowDays);
  const firstTries = earliest ? { [today]: correct,
    ...Object.fromEntries(Object.entries(previous?.firstTries ?? {}).filter(([day]) => day >= earliest)),
  } : previous?.firstTries;
  return {
    card: reviewed,
    bucket: reviewed.scheduled_days >= 7 ? "manzil" : "sabqi",
    attempts: (previous?.attempts ?? 0) + 1,
    correct: (previous?.correct ?? 0) + Number(correct),
    ...(firstTries && { firstTries }),
  };
}

export function reviewCard(previous: Review | undefined, grade: ReviewGrade, now: Date, today?: string): Review {
  return reviewWithRating(previous, grades[grade], now, today);
}

export function firstTryTotals(reviews: Review[], today: string) {
  const earliest = addDays(today, 1 - recallWindowDays);
  let attempts = 0;
  let correct = 0;
  for (const review of reviews) {
    for (const [day, remembered] of Object.entries(review.firstTries ?? {})) {
      if (day < earliest || day > today) continue;
      attempts++;
      if (remembered) correct++;
    }
  }
  return { attempts, correct };
}

export function isDue(review: Review | undefined, now: Date) {
  return !review || new Date(review.card.due) <= now;
}

export const bucketNames: Record<Bucket, string> = { sabaq: "Sabaq · new", sabqi: "Sabqi · recent", manzil: "Manzil · stable" };
