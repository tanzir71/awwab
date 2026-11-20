import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { message } from "./copy";
import { hifzVirtueKey, hifzVirtueMessages } from "./essentialPassages";
import { chapters, essentialPassages, getHifzPassage, groupPortions, juzs, maxPortionAyahs, maxPortionWords, nextPortion,
  passageLabel, portionBucket, portionPlan, ratePortion, rateRecitalPortion, recitalProgress, studyPhrases, verseText, type JuzRecital, type StudyQuran } from "./hifz";
import { juzAmma, learnedSurahs, levels, patternPracticePath, patternReviewPrefix, placementStartingLevel, qaidaIslandProgress, tracks } from "./learningPaths";
import { essentialPassageTitle } from "./paths-copy";
import { parseCorpus } from "./morphology";
import { reviewDestination } from "./studyDesk";
import { normalizeWord, splitArabicPhrase, splitArabicWords, splitGraphemes } from "./wordAnatomy";
import content from "../../docs/content/roots-and-patterns.json";
import grammar from "../../docs/content/grammar-foundations.json";
import sentence from "../../docs/content/sentence-structure.json";
import roots from "../../docs/content/roots-curriculum.json";
import curriculum from "../../handovers/H2-languages-paths-arabic-help/data/learning-paths.json";
import { speakCourses, speakLessonContent } from "./speakCurriculum";
import { speakLessonMessages, speakUnitKey } from "./speak-lesson-messages.mjs";
import { grammarLessonMessages, grammarLessonKey, grammarWordField, grammarExampleField } from "./grammar-lesson-messages.mjs";
import { applyGlossary } from "./languagePreferences";
import { askPhraseKey } from "./umrah-phrase-messages.mjs";
import { correctTajweedSamples, tajweedClip, tajweedDepthLessons, tajweedExcerpt, tajweedLessons, tajweedPracticeSamples, tajweedPrecache,
  tajweedProgress, tajweedReadingExamples, tajweedReference, tajweedReviewId, tajweedSampleKey, tajweedVerseExamples } from "./tajweed";
import { newReview } from "./reviews";
import { practiceChapters, readingPortions } from "./readingPractice";
import { formatQuranReference } from "./quran";
import { checkQuranWordEdition } from "../../scripts/quran-word-edition.mjs";
import { parseNumberedQuranMeanings } from "../../scripts/quran-meaning-edition.mjs";

const quran = JSON.parse(gunzipSync(readFileSync(new URL("../../public/data/quran-study-v1.json.gz", import.meta.url))).toString()) as StudyQuran;

describe("Offline Quran study edition", () => {
  it("suggests the second level only after all placement answers are recalled", () => {
    expect(placementStartingLevel(0, 0)).toBe(1);
    expect(placementStartingLevel(3, 4)).toBe(1);
    expect(placementStartingLevel(4, 4)).toBe(2);
  });

  it("exports all localizable grammar fields with their source and required verse arguments", () => {
    const keys = new Set<string>();
    for (const [course, curriculum] of Object.entries({ foundations: grammar, roots, sentence })) {
      for (const unit of curriculum.lessons) {
        const translations: [string, string[]][] = [["title", unit.title], ["rule", unit.rule], ["prompt", unit.prompt]];
        unit.words.forEach(([, label, en, bn, alternate], index) => {
          translations.push([grammarWordField(index, "meaning"), [en, bn]]);
          if (alternate) translations.push([grammarWordField(index, "label"), [label, alternate]]);
        });
        if ("examples" in unit) unit.examples.forEach((example, index) => {
          translations.push([grammarExampleField(index, "label"), example.label], [grammarExampleField(index, "note"), example.note]);
        });
        if ("commentary" in unit && unit.commentary) translations.push(["commentary", unit.commentary.text]);
        for (const [field, [en, bn]] of translations) {
          const key = grammarLessonKey(course, unit.id, field);
          expect(keys.has(key), key).toBe(false);
          keys.add(key);
          expect(grammarLessonMessages[key]).toMatchObject({ en, bn, definition: { file: expect.stringMatching(/^docs\/content\//) } });
          const values = {
            arabic: "rule sample",
            reference: field === "prompt" && "promptReference" in unit ? unit.promptReference :
              field === "rule" && "ruleReference" in unit ? unit.ruleReference : undefined,
          };
          expect(message({ mode: "adult", language: "en" }, key, values))
            .toBe(en.replace("{arabic}", values.arabic).replace("{reference}", values.reference ?? ""));
        }
      }
    }
    expect(keys).toEqual(new Set(Object.keys(grammarLessonMessages)));
  });

  it("exports every Speak lesson meaning with its original text and reuses shared phrase translations", () => {
    const units = Object.values(speakCourses).flatMap(courses => Object.values(courses).flat());
    const keys = new Set<string>();
    for (const unit of units) {
      const fields = [[speakUnitKey(unit.id, "title"), unit.title], [speakUnitKey(unit.id, "sign"), unit.meaning]] as [string, string[]][];
      if ("dialogue" in unit) fields.push([speakUnitKey(unit.id, "partner"), unit.partner]);
      const { lines, words } = speakLessonContent(unit);
      for (const piece of [...lines, ...words]) {
        if (piece.askId) expect(piece.meaningKey).toBe(askPhraseKey(piece.askId));
        else fields.push([piece.meaningKey, piece.meaning]);
      }
      for (const [key, [en, bn]] of fields) {
        expect(keys.has(key), key).toBe(false);
        keys.add(key);
        expect(speakLessonMessages[key]).toMatchObject({ en, bn, definition: { file: expect.stringMatching(/^docs\/content\/spoken-/) } });
        expect(message({ mode: "adult", language: "en" }, key)).toBe(en);
        expect(message({ mode: "maktab", language: "bn" }, key)).toBe(applyGlossary(bn, "bn"));
      }
    }
    expect(keys).toEqual(new Set(Object.keys(speakLessonMessages)));
  });
  it("formats chapter and āyah numbers without changing reference separators", () => {
    expect(formatQuranReference("67:1–5 · 103:2", "bn")).toBe("৬৭:১–৫ · ১০৩:২");
    expect(formatQuranReference("67:1–5", "bn-u-nu-latn")).toBe("67:1–5");
    expect(formatQuranReference("103:2", "ar-u-nu-arab")).toBe("١٠٣:٢");
  });

  it("includes every referenced āyah in both scripts and partitions all verses into 30 juzs", () => {
    expect(quran.notice).toContain("Tanzil Quran Text");
    expect(chapters).toHaveLength(114);
    expect(juzs).toHaveLength(30);
    const references = chapters.flatMap(chapter => {
      const verses = quran.surahs[chapter.number];
      expect(verses).toHaveLength(chapter.ayahs);
      expect(verses.every((verse, i) => verse.uthmani && verse.indopak && verse.english && verse.ref === `${chapter.number}:${i + 1}`)).toBe(true);
      return verses.map(verse => verse.ref);
    });
    const grouped = juzs.flatMap(juz => groupPortions(getHifzPassage(`juz-${juz.number}`), quran).flatMap(portion => portion.verses.map(verse => verse.ref)));
    expect(references).toHaveLength(6236);
    expect(grouped).toEqual(references);
    expect(passageLabel(getHifzPassage("juz-2"))).toBe("2:142–2:252");
  });

  it("uses all required passages, preserves whole āyāt and only uses the supplied categorical virtue grades", () => {
    expect(essentialPassages).toHaveLength(15);
    for (const entry of essentialPassages) {
      const passage = getHifzPassage(entry.id);
      const virtue = hifzVirtueMessages[hifzVirtueKey(entry.id)];
      expect(virtue?.en).toBe(passage.why);
      if (virtue) expect(message({ mode: "adult", language: "en" }, hifzVirtueKey(entry.id))).toBe(passage.why);
      const portions = groupPortions(passage, quran);
      expect(portions.flatMap(portion => portion.verses)).toHaveLength(passage.ayahs);
      for (const portion of portions) {
        expect(portion.verses.length).toBeLessThanOrEqual(maxPortionAyahs);
        if (portion.verses.length > 1) expect(portion.words).toBeLessThanOrEqual(maxPortionWords);
      }
    }
    expect(getHifzPassage("al-mulk").source?.grade).toBe("hasan");
    expect(Object.keys(hifzVirtueMessages)).toHaveLength(8);
    for (const id of ["ya-sin", "al-waqiah", "witr", "al-kahf"]) expect(getHifzPassage(id).source).toBeUndefined();
  });

  it("preserves the source basmala while counting only numbered words", () => {
    const fatiha = quran.surahs[1][0];
    expect(verseText(fatiha, "uthmani")).toEqual({ text: fatiha.uthmani, opening: undefined });
    for (const [chapter, firstWord, count] of [[95, "وَٱلتِّينِ", 2], [97, "إِنَّآ", 5]] as const) {
      const verse = quran.surahs[chapter][0];
      const { text, opening } = verseText(verse, "uthmani");
      expect(opening).toMatch(/^بِّسْمِ/u);
      expect(opening + " " + text).toBe(verse.uthmani);
      expect(splitArabicWords(text)[0]).toBe(firstWord);
      expect(splitArabicWords(text)).toHaveLength(count);
      expect(splitArabicWords(verseText(verse, "indopak").text)).toHaveLength(count);
      const portions = groupPortions(getHifzPassage(`surah-${chapter}`), quran);
      expect(portions.reduce((total, portion) => total + portion.words, 0))
        .toBe(chapters.find(item => item.number === chapter)?.words);
    }
  });

  it("checks word edition locations against the correct script and requires attribution", () => {
    const edition = {
      credit: "Test edition", source: "https://example.com/edition", license: "Test terms", licenseUrl: "https://example.com/terms",
      words: { "1:1:4": "Fixture", "95:1:2": "Fixture", "97:1:5": "Fixture", "37:130:4": "Fixture" },
      indopak: { "37:130:3": "Fixture", "72:16:8": "Fixture" },
    };
    expect(checkQuranWordEdition(edition)).toEqual(edition);
    expect(() => checkQuranWordEdition({ ...edition, source: "" })).toThrow(/translator credit/);
    expect(() => checkQuranWordEdition({ ...edition, words: { "95:1:3": "Fixture" } })).toThrow(/95:1:3/);
    expect(() => checkQuranWordEdition({ ...edition, words: { "72:16:8": "Fixture" } })).toThrow(/72:16:8/);
    expect(() => checkQuranWordEdition({ ...edition, indopak: { "37:130:4": "Fixture" } })).toThrow(/37:130:4/);
    expect(() => checkQuranWordEdition({ ...edition, indopak: { "95:1:2": "Fixture" } })).toThrow(/95:1:2/);
  });

  it("preserves numbered candidate meanings and rejects ambiguous verse coverage", () => {
    const text = Object.values(quran.surahs).flat().map(({ ref }) =>
      ref.replace(":", "|") + "|  Example | wording  ").join("\r\n");
    const result = parseNumberedQuranMeanings(text + "\r\n\r\n# Edition notice\r\n");
    expect(Object.keys(result.verses)).toHaveLength(6236);
    expect(result.verses["1:1"]).toBe("  Example | wording  ");
    expect(result.sourceNotice).toBe("# Edition notice");
    expect(() => parseNumberedQuranMeanings(text + "\n1|1|Duplicate")).toThrow(/Duplicate Quran meaning at 1:1/);
    expect(() => parseNumberedQuranMeanings(text.replace("114|6|", "114|7|"))).toThrow(/every canonical ayah/);
  });

  it("breaks āyat al-Kursī on waqf for practice while keeping its review as one āyah", () => {
    const portions = groupPortions(getHifzPassage("ayat-al-kursi"), quran);
    expect(portions).toHaveLength(1);
    expect(portions[0].ref).toBe("2:255");
    expect(portions[0].words).toBeGreaterThan(40);
    const verse = portions[0].verses[0];
    for (const script of ["uthmani", "indopak"] as const) {
      const lines = studyPhrases(verse, script).split("\n");
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.join(" ")).toBe(verseText(verse, script).text);
    }
  });

  it("uses the same portions and advances the end date when daily minutes increase", () => {
    const portions = groupPortions(getHifzPassage("al-mulk"), quran);
    const slow = portionPlan(portions, 5, "2026-11-20");
    const fast = portionPlan(portions, 15, "2026-11-20");
    expect(fast.words).toBe(slow.words);
    expect(fast.end < slow.end).toBe(true);
    expect(slow.dates[0].from).toBe("2026-11-20");
    expect(slow.dates.at(-1).to).toBe(slow.end);
  });
});

describe("Learning path progress", () => {
  it("preserves every āyah in short, shortest-first reading portions and keeps pause marks", () => {
    expect(practiceChapters.flow).toEqual(juzAmma);
    expect(practiceChapters.meaning).toHaveLength(37);
    expect(practiceChapters.teacher.map(chapter => chapter.number)).toEqual([1, ...juzAmma.map(chapter => chapter.number)]);
    for (const chapter of practiceChapters.flow) {
      const portions = readingPortions(chapter.number, quran, true);
      expect(portions.flatMap(part => part.verses.map(verse => verse.ref))).toEqual(quran.surahs[chapter.number].map(verse => verse.ref));
      expect(portions.every(part => part.verses.length <= 3 && (part.words <= 22 || part.verses.length === 1))).toBe(true);
    }
    const verse = quran.surahs[2][1];
    const phrases = studyPhrases(verse, "uthmani", true).split("\n");
    expect(phrases).toHaveLength(3);
    expect(phrases.join(" ")).toBe(verseText(verse, "uthmani").text);
  });
  it("keeps Tajweed and grammar excerpts inside the cited ayah in each script", () => {
    const excerpt = (chapter: number, ayah: number, first: number, last: number, script: "indopak" | "uthmani") =>
      splitArabicWords(verseText(quran.surahs[chapter][ayah - 1], script).text).slice(first - 1, last);
    for (const script of ["indopak", "uthmani"] as const) {
      for (const { chapter, ayah, first, last } of tajweedLessons.flatMap(lesson => lesson.samples)) {
        expect(excerpt(chapter, ayah, first, last, script)).toHaveLength(last - first + 1);
      }
      for (const { ayah: [chapter, ayah, first, last], words, answer } of grammar.lessons) {
        expect(excerpt(chapter, ayah, first, last, script)).toHaveLength(last - first + 1);
        expect(words[answer]).toBeDefined();
      }
      for (const { id, examples, words, answer } of sentence.lessons) {
        for (const { ayah: [chapter, ayah, first, last] } of examples) {
          expect(excerpt(chapter, ayah, first, last, script)).toHaveLength(last - first + 1);
        }
        expect(words[answer]).toBeDefined();
        expect(reviewDestination(`sentence:${id}`)).toBe(`/learn/paths/understand/5/${id}`);
      }
      expect(normalizeWord(excerpt(104, 4, 2, 2, script)[0])).toContain("ينبذ");
    }
    expect(reviewDestination("rule:nun:1:7:3")).toBe("/learn/paths/read/3?review=1%3A7%3A3");
    expect(reviewDestination("rule:mim:106:4:2")).toBe("/learn/paths/read/3/mim?review=106%3A4%3A2");
    expect(reviewDestination("phrase:sim:0")).toBe("/learn/speak/sim?review=0");
  });

  it("keeps the exact Uthmani pause marks attached to their preceding words", () => {
    const marks: Record<string, string> = { "waqf-choice": "ۚ", "waqf-continue": "ۖ", "waqf-pause": "ۗ", "waqf-pair": "ۛۛ", "waqf-required": "ۘ", "waqf-avoid": "ۙ" };
    const lesson = tajweedLessons.find(item => item.id === "waqf")!;
    for (const sample of lesson.samples) {
      const verse = quran.surahs[sample.chapter][sample.ayah - 1];
      const result = tajweedExcerpt(verse.uthmani, sample, true);
      expect(result.match(/[\u06d6-\u06db]/gu)?.join(""), verse.ref).toBe(marks[sample.rule]);
    }
  });

  it("marks only the lesson's word ranges in the reading display and keeps overlapping rules", () => {
    for (const lesson of tajweedLessons.filter(item => item.id !== "waqf")) {
      for (const sample of lesson.samples) {
        const verse = quran.surahs[sample.chapter][sample.ayah - 1];
        const notes = tajweedReadingExamples(tajweedReference(sample))!;
        for (const script of ["indopak", "uthmani"] as const) {
          const rendered = splitArabicPhrase(studyPhrases(verse, script, true)).filter(part => part.word).map(part => part.text);
          expect(rendered, verse.ref).toEqual(splitArabicWords(verseText(verse, script).text));
        }
        for (let index = 0; index < notes.length; index++) {
          const matches = lesson.samples.some(item => tajweedReference(item) === verse.ref &&
            item.rule === sample.rule && index + 1 >= item.first && index + 1 <= item.last);
          expect(Boolean(notes[index]?.some(note => note.lesson === lesson.id && note.rule === sample.rule))).toBe(matches);
        }
      }
    }
    const overlap = tajweedReadingExamples("106:4")?.[2];
    expect(overlap?.map(note => note.rule)).toEqual(expect.arrayContaining(["ikhfa", "mim-merge"]));
    expect(tajweedReadingExamples("2:255")).toBeUndefined();
  });

  it("links explicit Juz Amma signs to the correct words without inferring cross-word recitation", () => {
    const notes = (chapter: number, ayah: number, position: number, script: "uthmani" | "indopak") =>
      tajweedVerseExamples(quran.surahs[chapter][ayah - 1], script)?.[position - 1]?.map(note => note.rule) ?? [];

    for (const script of ["uthmani", "indopak"] as const) {
      expect(notes(78, 1, 1, script)).toEqual(["ghunnah-mim"]);
      expect(notes(78, 2, 2, script)).toEqual(["lam-sun", "ghunnah-nun"]);
      expect(notes(78, 6, 2, script)).toEqual(["qalqalah-inside"]);
      expect(notes(97, 4, 7, script)).toEqual(["ikhfa"]);
      expect(notes(109, 4, 5, script)).not.toContain("qalqalah-inside");
      expect(notes(109, 4, 4, script)).toContain("ghunnah-mim");
    }
    expect(notes(78, 38, 5, "uthmani")).toEqual(["waqf-continue"]);
    expect(notes(78, 38, 5, "indopak")).toEqual([]);
    expect(notes(98, 8, 12, "uthmani")).toEqual(["waqf-continue"]);
    expect(notes(98, 8, 17, "uthmani")).toEqual(["waqf-choice", "izhar"]);
    expect(tajweedVerseExamples(quran.surahs[2][254], "uthmani")).toBeUndefined();
  });

  it("distinguishes joining rules from rules inside a word in Juz Amma", () => {
    const annotations = (ref: string, position: number, script: "uthmani" | "indopak") => {
      const [chapter, ayah] = ref.split(":").map(Number);
      return tajweedVerseExamples(quran.surahs[chapter][ayah - 1], script)?.[position - 1] ?? [];
    };
    for (const script of ["uthmani", "indopak"] as const) {
      const joined = (ref: string, position: number, rule: string) =>
        expect(annotations(ref, position, script)).toContainEqual(expect.objectContaining({ rule, condition: "joining" }));
      joined("78:3", 2, "mim-clear");
      expect(annotations("78:13", 2, script)).toContainEqual(expect.objectContaining({ rule: "idgham", condition: "joining", ghunnah: true }));
      expect(annotations("78:36", 2, script)).toContainEqual(expect.objectContaining({ rule: "idgham", condition: "joining", ghunnah: false }));
      joined("78:16", 1, "izhar");
      joined("78:14", 4, "ikhfa");
      joined("79:14", 2, "mim-hide");
      joined("80:16", 1, "iqlab");
      joined("83:4", 4, "mim-merge");
      joined("88:5", 3, "izhar");
      joined("96:15", 5, "iqlab");
      expect(annotations("79:38", 3, script)).toContainEqual({ rule: "izhar-mutlaq", lesson: "nun", tone: "neutral" });
      expect(annotations("80:27", 1, script)).toContainEqual({ rule: "iqlab", lesson: "nun", tone: "soft" });
      expect(annotations("78:18", 2, script)).toContainEqual({ rule: "ikhfa", lesson: "nun", tone: "accent" });
      expect(annotations("97:4", 6, script)).not.toContainEqual(expect.objectContaining({ rule: "mim-merge" }));
      expect(annotations("83:26", 2, script)).not.toContainEqual(expect.objectContaining({ rule: "idgham" }));
      expect(annotations("80:14", 2, script)).not.toContainEqual(expect.objectContaining({ condition: "joining" }));
      expect(annotations("78:2", 1, script)).not.toContainEqual(expect.objectContaining({ condition: "joining" }));
    }
  });

  it("matches every Juz Amma definite article against the bundled Quranic Arabic Corpus", () => {
    const morphology = gunzipSync(readFileSync(new URL("../../public/data/qac-morphology-0.4.txt.gz", import.meta.url))).toString();
    const expected = new Set([...morphology.matchAll(/^\((\d+:\d+:\d+):\d+\)\t[^\t]+\tDET\t/gm)]
      .map(([, location]) => location).filter(location => Number(location.split(":")[0]) >= 78));
    expect(expected.size).toBe(351);
    const verses = Object.entries(quran.surahs).filter(([chapter]) => Number(chapter) >= 78).flatMap(([, ayahs]) => ayahs);
    for (const script of ["uthmani", "indopak"] as const) {
      const article = (chapter: number, ayah: number, position: number) =>
        tajweedVerseExamples(quran.surahs[chapter][ayah - 1], script)?.[position - 1]?.find(note => note.lesson === "lam")?.rule;
      expect(article(78, 2, 2)).toBe("lam-sun");
      expect(article(78, 2, 3)).toBe("lam-moon");
      expect(article(92, 1, 1)).toBe("lam-sun");
      expect(article(93, 4, 1)).toBe("lam-moon");
      expect(article(112, 1, 3)).toBeUndefined();
      const marked = new Set(verses.flatMap(verse => tajweedVerseExamples(verse, script)?.flatMap((notes, index) =>
        notes.some(note => note.lesson === "lam") ? [`${verse.ref}:${index + 1}`] : []) ?? []));
      expect(marked).toEqual(expected);
    }
  });

  it("distinguishes printed rāʾ vowels in continuing reading from stopping examples", () => {
    for (const script of ["uthmani", "indopak"] as const) {
      const notes = (chapter: number, ayah: number) => tajweedVerseExamples(quran.surahs[chapter][ayah - 1], script);
      expect(notes(94, 1)?.at(-1)).toContainEqual(expect.objectContaining({ rule: "ra-heavy" }));
      expect(notes(103, 1)?.[0]).toContainEqual(expect.objectContaining({ rule: "ra-light", condition: "continuing" }));
      expect(notes(112, 1)?.[3]).toContainEqual(expect.objectContaining({ rule: "qalqalah-stop" }));
      expect(notes(78, 39)?.[2]).toContainEqual(expect.objectContaining({ rule: "qalqalah-stop" }));
      expect(notes(109, 4)?.[4] ?? []).not.toContainEqual(expect.objectContaining({ rule: "qalqalah-stop" }));
    }
  });

  it("marks each written rāʾ with sukūn in Juz Amma and handles the stopping exception in Al-Fajr", () => {
    const verses = Object.entries(quran.surahs).filter(([chapter]) => Number(chapter) >= 78).flatMap(([, entries]) => entries);
    for (const script of ["uthmani", "indopak"] as const) {
      const notes = (chapter: number, ayah: number, position: number) =>
        tajweedVerseExamples(quran.surahs[chapter][ayah - 1], script)?.[position - 1] ?? [];
      expect(notes(78, 21, 4)).toContainEqual(expect.objectContaining({ rule: "ra-sukun-heavy" }));
      expect(notes(79, 17, 3)).toContainEqual(expect.objectContaining({ rule: "ra-sukun-light" }));
      expect(notes(89, 28, 1)).toContainEqual(expect.objectContaining({ rule: "ra-sukun-heavy" }));
      expect(notes(94, 8, 3)).toContainEqual(expect.objectContaining({ rule: "ra-sukun-heavy" }));
      expect(notes(89, 4, 3)).toContainEqual(expect.objectContaining({ rule: "ra-light", condition: "continuing" }));
      expect(notes(89, 4, 3)).toContainEqual(expect.objectContaining({ rule: "ra-sukun-either", condition: "stopping" }));
      expect(notes(89, 5, 6)).toContainEqual(expect.objectContaining({ rule: "ra-sukun-light", condition: "stopping" }));
      expect(notes(85, 11, 14)).toContainEqual(expect.objectContaining({ rule: "ra-sukun-light", condition: "stopping" }));
      expect(notes(97, 1, 5)).toContainEqual(expect.objectContaining({ rule: "ra-sukun-heavy", condition: "stopping" }));
      expect(notes(93, 9, 4).filter(note => note.rule.startsWith("ra-sukun")))
        .toEqual([{ rule: "ra-sukun-heavy", lesson: "ra", tone: "neutral" }]);
      let written = 0;
      for (const verse of verses) {
        const words = splitArabicWords(verseText(verse, "uthmani").text);
        const examples = tajweedVerseExamples(verse, script);
        words.forEach((word, index) => {
          const hasWrittenSukun = splitGraphemes(word).some(glyph => /^ر.*[ْۡ]/u.test(glyph));
          const marked = examples?.[index]?.filter(note => note.rule.startsWith("ra-sukun") && !note.condition) ?? [];
          expect(marked.length > 0, `${verse.ref}:${index + 1}`).toBe(hasWrittenSukun);
          if (hasWrittenSukun) written++;
        });
      }
      expect(written).toBe(58);
    }
  });

  it("assigns all five taught madd rules to the right words and reading conditions", () => {
    for (const script of ["uthmani", "indopak"] as const) {
      const notes = (chapter: number, ayah: number, position: number) =>
        tajweedVerseExamples(quran.surahs[chapter][ayah - 1], script)?.[position - 1]?.filter(note => note.lesson === "madd") ?? [];
      expect(notes(78, 4, 1)).toContainEqual(expect.objectContaining({ rule: "madd-natural" }));
      expect(notes(78, 4, 2)).toContainEqual(expect.objectContaining({ rule: "madd-natural", condition: "continuing" }));
      expect(notes(78, 4, 2)).toContainEqual(expect.objectContaining({ rule: "madd-stop" }));
      expect(notes(78, 23, 2)).toContainEqual(expect.objectContaining({ rule: "madd-separated", condition: "joining" }));
      expect(notes(78, 32, 1).map(note => note.rule)).toEqual(["madd-connected"]);
      expect(notes(79, 46, 5).map(note => note.rule)).toEqual(["madd-separated"]);
      expect(notes(80, 1, 2)).toContainEqual(expect.objectContaining({ rule: "madd-natural", condition: "stopping" }));
      expect(notes(80, 33, 3).map(note => note.rule)).toEqual(["madd-necessary"]);
      expect(notes(82, 6, 1).map(note => note.rule)).toEqual(["madd-separated"]);
      expect(notes(83, 32, 5).map(note => note.rule)).toEqual(["madd-separated", "madd-connected"]);
      expect(notes(106, 4, 7).map(note => note.rule)).toEqual(["madd-stop"]);
      expect(notes(78, 38, 5)).toEqual([]);
    }
  });

  it("renders a Tajweed example in every Juz Amma āyah and keeps its word positions within both scripts", () => {
    const juzAmma = Object.entries(quran.surahs).filter(([chapter]) => Number(chapter) >= 78).flatMap(([, verses]) => verses);
    expect(juzAmma).toHaveLength(564);
    for (const script of ["uthmani", "indopak"] as const) {
      const annotated = juzAmma.filter(verse => {
        const examples = tajweedVerseExamples(verse, script);
        if (!examples) return false;
        const rendered = splitArabicPhrase(studyPhrases(verse, script, true)).filter(part => part.word);
        expect(examples.length, verse.ref).toBeLessThanOrEqual(rendered.length);
        return true;
      });
      expect(annotated).toHaveLength(564);
    }
  });

  it("resumes unfinished examples in short sessions and derives stars from distinct correct answers", () => {
    const [lesson] = tajweedLessons;
    const seed = { ...newReview(new Date("2026-11-20")), attempts: 2, correct: 1 };
    const key = tajweedReviewId(lesson, lesson.samples[0]);
    const reviews = { [key]: seed, [tajweedReviewId(lesson, lesson.samples[1])]: { ...seed, correct: 0 } };
    expect(tajweedPracticeSamples(lesson, reviews, true)).toEqual(lesson.samples.slice(1, 5));
    expect(tajweedPracticeSamples(lesson, reviews, false)).toEqual(lesson.samples);
    expect(correctTajweedSamples(lesson, reviews)).toBe(1);
    const all = Object.fromEntries(tajweedLessons.flatMap(item => item.samples.map(sample => [tajweedReviewId(item, sample), seed])));
    expect(Object.keys(all)).toHaveLength(64);
    expect(tajweedProgress(all)).toEqual({ completed: 8, stars: 5 });
  });

  it("reads the advanced examples and their target letters in both editions, separately from Essentials", () => {
    const all = {};
    const seed = { ...newReview(new Date("2026-11-20")), attempts: 1, correct: 1 };
    for (const lesson of tajweedDepthLessons) {
      expect(lesson.samples).toHaveLength(8);
      expect(new Set(lesson.samples.map(tajweedSampleKey)).size).toBe(lesson.samples.length);
      for (const sample of lesson.samples) {
        expect(Object.prototype.hasOwnProperty.call(lesson.rules, sample.rule)).toBe(true);
        const verse = quran.surahs[sample.chapter][sample.ayah - 1];
        for (const script of ["indopak", "uthmani"] as const) {
          const rendered = tajweedExcerpt(verseText(verse, script).text, sample, sample.rule === "script-pair");
          expect(splitArabicWords(rendered)).toHaveLength(sample.last - sample.first + 1);
          if (sample.target) expect(normalizeWord(rendered)).toContain(normalizeWord(sample.target));
          if (sample.rule === "script-pair") expect(rendered.match(/ۛ/gu)).toHaveLength(2);
          if (sample.rule === "script-iqlab") expect(rendered).toContain("ۢ");
          if (sample.rule === "script-maddah") expect(rendered).toContain(script === "uthmani" ? "\u0653" : "\u089c");
          if (sample.rule === "script-wasl") expect(rendered.includes("ٱ")).toBe(script === "uthmani");
        }
        const clip = tajweedClip(sample);
        if (clip) expect(tajweedPrecache).toContain(clip.path);
        const reviewId = tajweedReviewId(lesson, sample);
        all[reviewId] = seed;
        expect(reviewDestination(reviewId)).toBe(`/learn/paths/read/4/${lesson.id}?review=${encodeURIComponent(tajweedSampleKey(sample))}`);
      }
    }
    const [makharij] = tajweedDepthLessons;
    expect(Object.values(makharij.articulation).flat()).toHaveLength(17);
    expect(tajweedProgress(all)).toEqual({ completed: 0, stars: 0 });
    expect(tajweedProgress(all, tajweedDepthLessons)).toEqual({ completed: 5, stars: 5 });
  });

  it("uses the sourced 2:2 morphology for the word family and routes pattern cards back to the drill", () => {
    const morphology = gunzipSync(readFileSync(new URL("../../public/data/qac-morphology-0.4.txt.gz", import.meta.url))).toString();
    const corpus = parseCorpus(morphology);
    const { chapter, ayah, last } = content.spot;
    const location = `${chapter}:${ayah}:${last}`;
    const analysis = corpus.positions.get(location);
    const verse = quran.surahs[chapter][ayah - 1];
    expect(analysis.root).toBe(content.root.replace(/\s+/g, ""));
    expect(normalizeWord(splitArabicWords(verse.uthmani)[last - 1])).toBe(normalizeWord(analysis.word));
    expect(content.patterns).toHaveLength(6);
    expect(reviewDestination(patternReviewPrefix + content.patterns[0].id)).toBe(patternPracticePath);
    for (const unit of [...speakCourses["saudi-hijazi"].A2, ...speakCourses["saudi-hijazi"].B1, ...speakCourses["saudi-hijazi"]["umrah-hajj"],
      ...speakCourses.gulf.A1, ...speakCourses.gulf["gulf-work"], ...speakCourses.msa.A1]) {
      const bridge = speakLessonContent(unit).words.find(word => word.bridge);
      expect(bridge, unit.id).toBeDefined();
      const row = corpus.positions.get(bridge.bridge);
      expect(row?.root, unit.id).toBe(bridge.root.replace(/\s+/g, "").replace(/^أ/u, "ا"));
      const [chapter, ayah, position] = bridge.bridge.split(":").map(Number);
      for (const script of ["indopak", "uthmani"] as const) {
        expect(splitArabicWords(verseText(quran.surahs[chapter][ayah - 1], script).text)[position - 1], unit.id).toBeDefined();
      }
      expect(reviewDestination(`phrase:${unit.id}:0`)).toBe(`/learn/speak/${unit.id}?review=0`);
    }
  });

  it("matches the roots lessons to the Quranic Arabic Corpus tags and the two bundled scripts", () => {
    const morphology = gunzipSync(readFileSync(new URL("../../public/data/qac-morphology-0.4.txt.gz", import.meta.url))).toString();
    const stems = new Map([...morphology.matchAll(/^\((\d+:\d+:\d+):\d+\)\t[^\t]+\t[^\t]+\t(STEM[^\r\n]*)$/gm)]
      .map(([, ref, tags]) => [ref, tags.split("|")]));
    for (const lesson of roots.lessons) {
      expect(lesson.words[lesson.answer]).toBeDefined();
      expect(reviewDestination(`roots:${lesson.id}`)).toBe(`/learn/paths/understand/3/${lesson.id}`);
      for (const example of lesson.examples) {
        const [chapter, ayah, first, last] = example.ayah;
        const ref = `${chapter}:${ayah}:${"focus" in example ? example.focus : first}`;
        expect(stems.get(ref), ref).toEqual(expect.arrayContaining(example.features));
        for (const script of ["indopak", "uthmani"] as const) {
          const verse = quran.surahs[chapter][ayah - 1];
          const excerpt = splitArabicWords(verseText(verse, script).text).slice(first - 1, last);
          expect(excerpt).toHaveLength(last - first + 1);
        }
      }
    }
    expect(roots.lessons.filter(lesson => lesson.id.startsWith("forms-")).flatMap(lesson => lesson.words.map(word => word[1])))
      .toEqual(["Form I", "Form II", "Form III", "Form IV", "Form V", "Form VI", "Form VII", "Form VIII", "Form IX", "Form X"]);
  });

  it("leaves all five levels per path accessible and orders all 37 Juz ʿAmma surahs by length", () => {
    expect(tracks.map(track => levels[track].length)).toEqual([5, 5, 5, 5]);
    expect(juzAmma).toHaveLength(37);
    expect(juzAmma.map(chapter => chapter.words)).toEqual(juzAmma.map(chapter => chapter.words).sort((a, b) => a - b));
  });

  it("translates every level and essential passage name while preserving the English curriculum labels", () => {
    const english = (key: string) => message({ language: "en", mode: "adult" }, key);
    const bangla = (key: string) => message({ language: "bn", mode: "maktab" }, key);
    for (const track of tracks) {
      const { levels: planned } = curriculum.tracks[track];
      const titles = track === "speak" ? [...planned, ...curriculum.tracks.speak.packs] : planned;
      expect(levels[track].map(item => english(item.titleKey))).toEqual(titles.map(item => item.title));
      for (const item of levels[track]) expect(bangla(item.titleKey)).toMatch(/\p{Script=Bengali}/u);
    }
    for (const passage of essentialPassages) {
      expect(essentialPassageTitle(passage, english)).toBe(passage.title);
      expect(essentialPassageTitle(passage, bangla)).toMatch(/\p{Script=Bengali}/u);
    }
  });

  it("resumes a Qaida island at the first unfinished lesson and awards stars for distinct lessons", () => {
    expect(qaidaIslandProgress([1, 4, 4, 6, 7], 4, 6)).toEqual({ stars: 3, to: "/learn/qaida/5" });
    expect(qaidaIslandProgress([4, 5, 6], 4, 6)).toEqual({ stars: 5, to: "/learn/qaida/4" });
    expect(qaidaIslandProgress([1, 2, 3], 4, 6)).toEqual({ stars: 0, to: "/learn/qaida/4" });
  });

  it("requires success on three different days and keeps a separate long-term schedule", () => {
    const time = (day: string) => new Date(day + "T09:00:00Z");
    let review = ratePortion(undefined, "got-it", time("2026-11-19"), "2026-11-19");
    review = ratePortion(review, "got-it", time("2026-11-19"), "2026-11-19");
    expect(review.correctDays).toEqual(["2026-11-19"]);
    expect(portionBucket(review, "2026-11-20")).toBe("sabaq");
    review = ratePortion(review, "got-it", time("2026-11-20"), "2026-11-20");
    review = ratePortion(review, "got-it", time("2026-11-21"), "2026-11-21");
    expect(portionBucket(review, "2026-11-28")).toBe("sabqi");
    expect(portionBucket(review, "2026-11-29")).toBe("manzil");
    const [portion] = groupPortions(getHifzPassage("surah-103"), quran);
    expect(learnedSurahs({ [portion.id]: review }, {}).has(103)).toBe(true);
    const known = { ...review, review: { ...review.review, card: { ...review.review.card, due: time("2026-12-10") } } };
    expect(nextPortion([portion], { [portion.id]: known }, time("2026-11-29"), "2026-11-29")).toBeUndefined();
    expect(nextPortion([portion], { [portion.id]: known }, time("2026-12-10"), "2026-12-10")).toBe(portion);
  });

  it("resumes a full-juz recital in order and reopens seven days after completion", () => {
    const portions = groupPortions(getHifzPassage("juz-2"), quran);
    const start = "2026-11-19";
    const finish = "2026-11-20";
    let recital: JuzRecital | undefined;
    expect(rateRecitalPortion(portions, recital, portions[1].id, "got-it", start)).toBeUndefined();
    for (const [index, item] of portions.entries()) {
      expect(recitalProgress(portions, recital, start)).toMatchObject({ count: index, next: item });
      recital = rateRecitalPortion(portions, recital, item.id, index === 1 ? "shaky" : "got-it", index === portions.length - 1 ? finish : start);
      expect(rateRecitalPortion(portions, recital, item.id, "got-it", finish)).toBeUndefined();
    }
    expect(recital).toEqual({ rated: {}, last: { day: finish, remembered: portions.length - 1, total: portions.length } });
    expect(recitalProgress(portions, recital, "2026-11-26")).toEqual({ count: portions.length, next: undefined, availableOn: "2026-11-27" });
    expect(recitalProgress(portions, recital, "2026-11-27")).toEqual({ count: 0, next: portions[0], availableOn: undefined });
  });
});
