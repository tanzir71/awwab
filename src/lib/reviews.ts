import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";

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

export function reviewWithRating(previous: Review | undefined, grade: Grade, now: Date): Review {
  const saved = previous?.card;
  const card = saved ? { ...saved, due: new Date(saved.due), last_review: saved.last_review ? new Date(saved.last_review) : undefined } : createEmptyCard(now);
  const reviewed = scheduler.next(card, now, grade).card;
  return {
    card: reviewed,
    bucket: reviewed.scheduled_days >= 7 ? "manzil" : "sabqi",
    attempts: (previous?.attempts ?? 0) + 1,
    correct: (previous?.correct ?? 0) + Number(grade >= Rating.Good),
  };
}

export function reviewCard(previous: Review | undefined, grade: ReviewGrade, now: Date): Review {
  return reviewWithRating(previous, grades[grade], now);
}

export function isDue(review: Review | undefined, now: Date) {
  return !review || new Date(review.card.due) <= now;
}

export const bucketNames: Record<Bucket, string> = { sabaq: "Sabaq · new", sabqi: "Sabqi · recent", manzil: "Manzil · stable" };
