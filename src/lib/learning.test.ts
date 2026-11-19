import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { splitGraphemes, wordAnatomy } from "./wordAnatomy";
import { isDue, reviewCard } from "./reviews";
import { coreWordCoverage, coreWordTotal, fatihaMorphology, knownCoreQuranWords, quranText } from "./quran";
import { splitArabicWords } from "./wordAnatomy";
import { coreVocabulary, parseCorpus } from "./morphology";
import snapshot from "../../docs/content/core-quran-words.json";
import salah from "../../docs/content/salah-words.json";
import { message } from "./copy";
import { studyNames, studySearchTerm } from "./study-copy";

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

  it("keeps joining strokes in display words and excludes them from letter counting", () => {
    expect(splitArabicWords("ـب ـبـ بـ ب ـ")).toEqual(["ـب", "ـبـ", "بـ", "ب"]);
    expect(splitGraphemes("ـبـ")).toEqual(["ب"]);
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

describe("Core Quran words", () => {
  it("derives an identical 125-word list with measured occurrence coverage from the bundled corpus", () => {
    const bundled = new URL("../../public/data/qac-morphology-0.4.txt.gz", import.meta.url);
    const corpus = parseCorpus(gunzipSync(readFileSync(bundled)).toString("utf8"));
    const vocabulary = coreVocabulary(corpus.vocabulary);
    expect(new Set(snapshot.words).size).toBe(125);
    expect(coreWordTotal).toBe(125);
    expect(vocabulary.map(word => word.key)).toEqual(snapshot.words);
    const count = vocabulary.reduce((total, word) => total + word.count, 0);
    expect(coreWordCoverage).toBe(count / corpus.positions.size);
  });

  it("counts only enrolled lemmas and merges Fātiḥa familiarity without double-counting", () => {
    const corpusKey = fatihaMorphology["1:2:2"].key;
    const fromAyah = knownCoreQuranWords(["1:2"], []);
    expect(fromAyah.has(corpusKey)).toBe(true);
    expect(knownCoreQuranWords(["1:2", "1:2"], [corpusKey, "word:outside-enrolled-list"])).toEqual(fromAyah);
    expect(knownCoreQuranWords([], [corpusKey, corpusKey])).toEqual(new Set([corpusKey]));
  });

  it("aligns all seven Fātiḥa glosses and morphology positions with the displayed text", () => {
    for (const verse of quranText[1]) {
      const words = splitArabicWords(verse.uthmani);
      expect(salah.fatiha[verse.ref].glosses).toHaveLength(words.length);
      for (const [index] of words.entries()) expect(fatihaMorphology[`${verse.ref}:${index + 1}`]).toBeDefined();
    }
  });
});

describe("Learning copy", () => {
  it("formats mode-specific study messages and Bangla numerals", () => {
    expect(message({ language: "en", mode: "adult" }, "studyDays", { count: 1 })).toBe("1 day");
    expect(message({ language: "bn", mode: "adult" }, "studyDays", { count: 2 })).toBe("২ দিন");
    expect(message({ language: "bn", mode: "maktab" }, "studyResume", { duration: 3 })).toBe("পাঠ শুরু করি · ৩ মিনিট");
  });

  it("keeps reference numbers searchable and presents native labels and decimal sizes", () => {
    expect(studySearchTerm("  তিরমিযী ২৬৭৬ ")).toBe("তিরমিযী 2676");
    expect(studyNames.surah("bn", 103, "Al-ʿAsr")).toBe("আল-আসর");
    expect(studyNames.surah("en", 103, "Al-ʿAsr")).toBe("Al-ʿAsr");
    expect(message({ language: "bn", mode: "adult" }, "fileSizeMB", { size: 1.25 })).toBe("১.৩ মেগাবাইট");
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
