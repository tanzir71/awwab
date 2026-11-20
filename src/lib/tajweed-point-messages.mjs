import lessons from "../../docs/content/tajweed-in-depth.json" with { type: "json" };

export const tajweedPointKey = (region, index) => `tajweedPoint-${region}-${index + 1}`;

export const tajweedPointMessages = Object.fromEntries(lessons.flatMap(lesson =>
  Object.entries(lesson.articulation ?? {}).flatMap(([region, points]) =>
    points.map(({ name: [en, bn] }, index) => [tajweedPointKey(region, index), {
      en, bn, definition: { file: "docs/content/tajweed-in-depth.json" },
    }]))));
