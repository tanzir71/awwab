import { describe, expect, it } from "vitest";
import { splitGraphemes, wordAnatomy } from "./wordAnatomy";
import { isDue, reviewCard } from "./reviews";
import { quranText } from "./quran";
import { splitArabicWords } from "./wordAnatomy";
import { parseCorpus } from "./morphology";
import { message } from "./copy";

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

describe("Bundled Quran", () => {
  it("keeps the numbered Fātiḥa basmala and aligns opening verse positions across scripts", () => {
    expect(quranText[1][0].ref).toBe("1:1");
    expect(splitArabicWords(quranText[1][0].uthmani)).toHaveLength(4);
    expect(quranText[103][0].ref).toBe("103:1");
    expect(splitArabicWords(quranText[103][0].uthmani)).toEqual(["وَٱلْعَصْرِ"]);
    expect(splitArabicWords(quranText[103][0].indopak)).toHaveLength(1);
    expect(Object.keys(quranText)).toHaveLength(12);
  });

  it("reads signed CRLF morphology rows and assembles prefixed words", () => {
    const corpus = parseCorpus("# Illustrative header\r\n(1:1:1:1)\tbi\tP\tPREFIX|bi+\r\n(1:1:1:2)\tsomi\tN\tSTEM|POS:N|LEM:{som|ROOT:smw|M|GEN\r\n");
    expect(corpus.positions.get("1:1:1")).toMatchObject({ word: "بِسْمِ", root: "سمو", type: "Noun" });
    expect(corpus.vocabulary[0]).toMatchObject({ count: 1 });
  });
});

describe("Learning copy", () => {
  it("formats mode-specific study messages and Bangla numerals", () => {
    expect(message({ language: "en", mode: "adult" }, "studyDays", { count: 1 })).toBe("1 day");
    expect(message({ language: "bn", mode: "adult" }, "studyDays", { count: 2 })).toBe("২ দিন");
    expect(message({ language: "bn", mode: "maktab" }, "studyResume", { duration: 3 })).toBe("পাঠ শুরু করি · ৩ মিনিট");
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
