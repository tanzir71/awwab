import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { chapters, essentialPassages, getHifzPassage, groupPortions, juzs, maxPortionAyahs, maxPortionWords, nextPortion,
  passageLabel, portionBucket, portionPlan, ratePortion, rateRecitalPortion, recitalProgress, studyPhrases, verseText, type JuzRecital, type StudyQuran } from "./hifz";
import { juzAmma, learnedSurahs, levels, patternPracticePath, patternReviewPrefix, tracks } from "./learningPaths";
import { parseCorpus } from "./morphology";
import { reviewDestination } from "./studyDesk";
import { normalizeWord, splitArabicWords } from "./wordAnatomy";
import content from "../../docs/content/roots-and-patterns.json";
import grammar from "../../docs/content/grammar-foundations.json";
import { correctTajweedSamples, tajweedExcerpt, tajweedLessons, tajweedPracticeSamples, tajweedProgress, tajweedReviewId } from "./tajweed";
import { newReview } from "./reviews";
import { practiceChapters, readingPortions } from "./readingPractice";

const quran = JSON.parse(gunzipSync(readFileSync(new URL("../../public/data/quran-study-v1.json.gz", import.meta.url))).toString()) as StudyQuran;

describe("Offline Quran study edition", () => {
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
      const portions = groupPortions(passage, quran);
      expect(portions.flatMap(portion => portion.verses)).toHaveLength(passage.ayahs);
      for (const portion of portions) {
        expect(portion.verses.length).toBeLessThanOrEqual(maxPortionAyahs);
        if (portion.verses.length > 1) expect(portion.words).toBeLessThanOrEqual(maxPortionWords);
      }
    }
    expect(getHifzPassage("al-mulk").source?.grade).toBe("hasan");
    for (const id of ["ya-sin", "al-waqiah", "witr", "al-kahf"]) expect(getHifzPassage(id).source).toBeUndefined();
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

  it("uses the sourced 2:2 morphology for the word family and routes pattern cards back to the drill", () => {
    const morphology = gunzipSync(readFileSync(new URL("../../public/data/qac-morphology-0.4.txt.gz", import.meta.url))).toString();
    const { chapter, ayah, last } = content.spot;
    const location = `${chapter}:${ayah}:${last}`;
    const analysis = parseCorpus(morphology).positions.get(location);
    const verse = quran.surahs[chapter][ayah - 1];
    expect(analysis.root).toBe(content.root.replace(/\s+/g, ""));
    expect(normalizeWord(splitArabicWords(verse.uthmani)[last - 1])).toBe(normalizeWord(analysis.word));
    expect(content.patterns).toHaveLength(6);
    expect(reviewDestination(patternReviewPrefix + content.patterns[0].id)).toBe(patternPracticePath);
  });

  it("leaves all five levels per path accessible and orders all 37 Juz ʿAmma surahs by length", () => {
    expect(tracks.map(track => levels[track].length)).toEqual([5, 5, 5, 5]);
    expect(juzAmma).toHaveLength(37);
    expect(juzAmma.map(chapter => chapter.words)).toEqual(juzAmma.map(chapter => chapter.words).sort((a, b) => a - b));
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
