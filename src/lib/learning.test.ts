import { describe, expect, it } from "vitest";
import { splitGraphemes, wordAnatomy } from "./wordAnatomy";
import { isDue, reviewCard } from "./reviews";

describe("Word anatomy", () => {
  it("keeps Quranic marks on their base letter", () => {
    expect(splitGraphemes("بِۡهَٰٱو۟")).toEqual(["بِۡ", "هَٰ", "ٱ", "و۟"]);
  });

  it("treats connected waṣl as silent and sounds it at the start", () => {
    expect(wordAnatomy("ٱلْعَصْرِ").letters[0].silent).toBe(false);
    expect(wordAnatomy("ٱلْعَصْرِ", true).letters[0].silent).toBe(true);
    expect(wordAnatomy("وَٱلۡعَصۡرِ").syllables.map(item => item.tr)).toEqual(["wal", "ʿaṣ", "ri"]);
  });

  it("assigns joining forms across non-joining letters and long vowels", () => {
    expect(wordAnatomy("وَٱلۡعَصۡرِ").joining.map(item => item.position)).toEqual(["isolated", "isolated", "initial", "medial", "medial", "final"]);
    expect(wordAnatomy("بَابٌ").syllables.map(item => item.tr)).toEqual(["bā", "bun"]);
  });
});

describe("FSRS", () => {
  it("schedules grades and restores dates from a JSON backup", () => {
    const now = new Date("2026-11-19T10:00:00Z");
    const again = reviewCard(undefined, "forgot", now);
    const good = reviewCard(undefined, "got-it", now);
    expect(new Date(again.card.due).valueOf()).toBeLessThan(new Date(good.card.due).valueOf());
    expect(isDue(good, now)).toBe(false);
    const resumed = reviewCard(JSON.parse(JSON.stringify(good)), "got-it", new Date(good.card.due));
    expect(new Date(resumed.card.due) > new Date(good.card.due)).toBe(true);
  });
});
