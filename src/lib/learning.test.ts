import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { normalizeWord, splitGraphemes, wordAnatomy } from "./wordAnatomy";
import { isDue, reviewCard } from "./reviews";
import { coreWordCoverage, coreWordTotal, fatihaMorphology, knownCoreQuranWords, quranText } from "./quran";
import { splitArabicPhrase, splitArabicWords } from "./wordAnatomy";
import { coreVocabulary, parseCorpus } from "./morphology";
import snapshot from "../../docs/content/core-quran-words.json";
import salah from "../../docs/content/salah-words.json";
import surahStudy from "../../docs/content/surah-study-words.json";
import { ayahGlossKey, studyGlossMessages } from "./study-gloss-messages.mjs";
import { message } from "./copy";
import { studyNames, studySearchTerm } from "./study-copy";
import { parseQaidaReview, qaidaRows, resolveQaidaRow } from "./qaidaPractice";
import { compareTakhti, letterForms, lettersForFamily, tracingModel } from "./takhti";
import { fluencyPairs, fluencyRoots, fluencySentences, fluencySigns, matchingReadingWord, wordBankSearch, wordGlosses } from "./fluency";
import { fluencyFamilyKey, fluencyLessonMessages, fluencyPairKey, fluencyRootKey, fluencySentenceKey, fluencySignKey,
  wordGlossKey, wordGlossMessages } from "./fluency-messages.mjs";

describe("Qaida practice", () => {
  it("follows the vowel board order and keeps every alphabet letter with all three marks", () => {
    const rows = qaidaRows(4);
    expect(rows).toHaveLength(10);
    expect(rows[5][2]).toEqual(["رُ"]);
    expect(new Set(rows.slice(0, 8).flat(2))).toHaveLength(84);
    expect(new Set(qaidaRows(5).slice(0, 8).flat(2))).toHaveLength(84);
  });

  it("resolves a review link without discarding the saved position on invalid input", () => {
    expect(parseQaidaReview("qaida:4:5")).toEqual({ lesson: 4, row: 5 });
    expect(parseQaidaReview("qaida:4:10")).toBeUndefined();
    expect(resolveQaidaRow("6", 1, 10)).toBe(5);
    expect(resolveQaidaRow("99", 1, 10)).toBe(1);
  });
});

describe("Takhti practice", () => {
  it("only offers the two valid joining forms for Rāʾ", () => {
    const ra = lettersForFamily("dal").find(item => item.letter === "ر")!;
    expect(letterForms(ra).map(item => item.key)).toEqual(["isolated", "final"]);
  });

  it("compares a line, bowl, and dot independently", () => {
    const model = tracingModel(lettersForFamily("boat")[0], "isolated", true);
    expect(compareTakhti([], model)).toBe("empty");
    expect(compareTakhti([[[5, 5], [100, 100]]], model)).toBe("shape");
    expect(compareTakhti(model.paths, model)).toBe("dots");
    expect(compareTakhti([...model.paths, ...model.dots.map(point => [point])], model)).toBe("match");
  });
});

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

  it("keeps gate digits and punctuation outside tappable Arabic words", () => {
    const phrase = "فين باب رقم ٧٩؟";
    const parts = splitArabicPhrase(phrase);
    expect(parts.map(part => part.text).join("")).toBe(phrase);
    expect(parts.filter(part => part.word).map(part => part.text)).toEqual(["فين", "باب", "رقم"]);
  });
});

describe("Bundled Quran", () => {
  it("keeps contextual glosses aligned with both bundled scripts", () => {
    const glossesByVerse = {
      ...surahStudy.glosses,
      ...Object.fromEntries(Object.entries(salah.fatiha).map(([ref, { glosses }]) => [ref, glosses])),
    };
    for (const [reference, glosses] of Object.entries(glossesByVerse)) {
      const [chapter, ayah] = reference.split(":").map(Number);
      const verse = quranText[chapter][ayah - 1];
      expect(splitArabicWords(verse.uthmani), reference).toHaveLength(glosses.length);
      expect(splitArabicWords(verse.indopak), reference).toHaveLength(glosses.length);
      glosses.forEach((gloss, index) => {
        const key = ayahGlossKey(reference, index + 1);
        if (gloss === null) expect(studyGlossMessages[key]).toBeUndefined();
        else {
          expect(message({ mode: "adult", language: "en" }, key)).toBe(gloss);
          expect(message({ mode: "maktab", language: "ur" }, key)).toBe(gloss);
        }
      });
      expect(studyGlossMessages[ayahGlossKey(reference, glosses.length + 1)]).toBeUndefined();
    }
  });

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
  it("uses the shared locale catalogue for curated words, root families, comparisons, signs and sentences", () => {
    const expected = [
      ...Object.entries(wordGlosses).map(([word, gloss]) => [wordGlossKey(word), gloss] as const),
      ...Object.entries(fluencyRoots).flatMap(([root, item]) => [
        [fluencyRootKey(root), item] as const,
        ...item.family.map(word => [fluencyFamilyKey(root, word.tr), word] as const),
      ]),
      ...fluencyPairs.flatMap(pair => [
        [fluencyPairKey(pair.verse, "quran"), pair] as const,
        [fluencyPairKey(pair.verse, "modern"), { en: pair.modernEn, bn: pair.modernBn }] as const,
      ]),
      ...fluencySigns.map(sign => [fluencySignKey(sign.ar), sign] as const),
      ...fluencySentences.flatMap(sentence => [
        [fluencySentenceKey(sentence.id, "meaning"), sentence] as const,
        [fluencySentenceKey(sentence.id, "hint"), { en: sentence.hintEn, bn: sentence.hintBn }] as const,
      ]),
    ];
    expect(expected.map(([key]) => key).sort()).toEqual(Object.keys({ ...fluencyLessonMessages, ...wordGlossMessages }).sort());
    for (const [key, { en }] of expected) {
      expect(message({ mode: "adult", language: "en" }, key)).toBe(en);
      expect(message({ mode: "maktab", language: "id" }, key)).toBe(en);
    }
    expect(message({ mode: "maktab", language: "bn" }, fluencyRootKey("كتب"))).toBe("লেখা");
  });

  it("derives an identical 125-word list with measured occurrence coverage from the bundled corpus", () => {
    const bundled = new URL("../../public/data/qac-morphology-0.4.txt.gz", import.meta.url);
    const corpus = parseCorpus(gunzipSync(readFileSync(bundled)).toString("utf8"));
    const vocabulary = coreVocabulary(corpus.vocabulary);
    expect(new Set(snapshot.words).size).toBe(125);
    expect(coreWordTotal).toBe(125);
    expect(vocabulary.map(word => word.key)).toEqual(snapshot.words);
    const count = vocabulary.reduce((total, word) => total + word.count, 0);
    expect(coreWordCoverage).toBe(count / corpus.positions.size);

    const spelling = (word: string) => normalizeWord(word.replace(/ٰ/g, "ا"));
    for (const word of snapshot.words) expect(wordGlosses[word.slice(5)], word).toMatchObject({ en: expect.any(String), bn: expect.any(String) });
    for (const [root, entry] of Object.entries(fluencyRoots)) {
      for (const word of entry.family.filter(word => word.verse)) {
        const source = corpus.positions.get(`${word.verse}:${word.position}`);
        expect(source?.root, `${word.ar} · ${word.verse}`).toBe(root);
        expect([spelling(source!.word), spelling(source!.lemma ?? "")], word.verse).toContain(spelling(word.ar));
      }
    }
    for (const pair of fluencyPairs) {
      splitArabicWords(pair.quran).forEach((word, index) => {
        const source = corpus.positions.get(`${pair.verse}:${pair.position + index}`);
        expect(normalizeWord(source?.word ?? ""), pair.verse).toBe(normalizeWord(word));
      });
    }
  });

  it("searches vowelled Arabic, spaced roots, Latin diacritics and Bangla glosses", () => {
    expect(wordBankSearch("عَ لَ مَ")).toBe("علم");
    expect(wordBankSearch("كِتَاب")).toBe("كتاب");
    expect(wordBankSearch("ʿAlīm")).toBe("ʿalim");
    expect(wordBankSearch("  প্রভু  ")).toBe("প্রভু");
    expect(matchingReadingWord("الْمَسْجِدِ", new Set(["مسجد"]))).toBe(true);
    expect(matchingReadingWord("في", new Set([wordBankSearch("فى")]))).toBe(true);
    expect(matchingReadingWord("الكتاب", new Set(["كتب"]))).toBe(false);
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
