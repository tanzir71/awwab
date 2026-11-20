import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { essentialPassages, essentialStudyPassage } from "../src/lib/essentialPassages.ts";
import { hadithArchiveVersion, hadithCollections, hadithSource } from "../src/lib/hadith-catalogue.ts";
import { splitUthmaniOpening } from "../src/lib/quranOpening.ts";
import { tajweedMessages } from "../src/lib/tajweed-copy.ts";
import { tajweedClip, tajweedDepthLessons, tajweedExcerpt, tajweedIntroKey, tajweedLessons, tajweedLessonSources,
  tajweedReadingRuleKey, tajweedReference, tajweedSampleKey, tajweedTitleKey, tajweedVerseExamples } from "../src/lib/tajweed.ts";
import { splitArabicWords } from "../src/lib/wordAnatomy.ts";
import { pronunciationReview } from "./pronunciation-review.mjs";

const [output] = process.argv.slice(2);
if (process.argv.length !== 3) throw new Error("Usage: node scripts/export-scholar-review.mjs <new-directory>");

const dataRoot = new URL("../public/data/", import.meta.url);
const read = file => JSON.parse(gunzipSync(readFileSync(new URL(file, dataRoot))));
const quran = read("quran-study-v1.json.gz");
const review = pronunciationReview();
const groups = {};

function tajweedRows(lesson, advanced) {
  const group = lesson.id;
  const variety = advanced ? "advanced" : "essentials";
  const title = tajweedMessages[tajweedTitleKey(group)].en;
  const intro = tajweedMessages[tajweedIntroKey(group)];
  const sources = tajweedLessonSources(lesson, advanced);
  groups[group] = title;
  const articulation = Object.values(lesson.articulation ?? {}).flat().map(point => ({
    label: point.name.join(" · "), value: point.letters, lang: "ar",
  }));
  const overview = {
    id: `${group}/overview`, variety, group, label: `${title} · Lesson notes`,
    expected: { en: intro.en, bn: intro.bn }, fields: articulation, recordings: [], sources,
  };
  const samples = lesson.samples.map(sample => {
    const verse = quran.surahs[sample.chapter]?.[sample.ayah - 1];
    const ref = tajweedReference(sample);
    const clip = tajweedClip(sample);
    if (!verse || verse.ref !== ref || !clip) throw new Error(`Missing source text or recitation for ${group} ${ref}.`);
    const pauses = group === "waqf" || sample.rule === "script-pair";
    const rule = tajweedMessages[`tajweedRule-${sample.rule}`];
    const hint = tajweedMessages[`tajweedHint-${sample.rule}`];
    const fields = [{ label: "Word positions within the āyah", value: `${sample.first}–${sample.last}` }];
    if (group === "waqf") fields.push({ label: "Script in the app", value: "Uthmani" });
    if (sample.target) fields.push({ label: "Focus letter", value: sample.target, lang: "ar" });
    if (lesson.rules[sample.rule]) fields.push({ label: "Letters used by this rule", value: lesson.rules[sample.rule], lang: "ar" });
    const path = clip.path.replace(/^packs\//, "audio/");
    const clipRef = clip.throughAyah && clip.throughAyah !== sample.ayah ? `${ref}–${clip.throughAyah}` : ref;
    return {
      id: `${group}/${tajweedSampleKey(sample)}`, variety, group, label: `${ref} · ${rule.en}`,
      expected: {
        ar: tajweedExcerpt(splitUthmaniOpening(verse.uthmani, verse.ref).text, sample, pauses),
        ...(group !== "waqf" ? { indopak: tajweedExcerpt(verse.indopak, sample, pauses) } : {}),
        en: hint.en,
        bn: hint.bn,
      },
      fields,
      recordings: [{ label: `${clip.speaker} · ${clipRef}`, ...review.recording(clip.path, path) }],
      sources: [...sources, { title: `Quran ${ref}`, url: `https://quran.com/${sample.chapter}/${sample.ayah}` },
        { title: `Recitation source · ${clip.speaker}`, url: clip.source }, { title: clip.license, url: clip.licenseUrl }],
    };
  });
  return [overview, ...samples];
}

const collectionByName = new Map(Object.entries(hadithCollections).map(([id, item]) => [item.short, id]));
const archives = new Map();
function citationDetails(reference) {
  const match = /^(.+) ([1-9]\d*)$/u.exec(reference);
  const collection = match && collectionByName.get(match[1]);
  if (!collection) return { fields: [], sources: [] };
  if (!archives.has(collection)) archives.set(collection, read(`hadith-${collection}-v${hadithArchiveVersion}.json.gz`).items);
  const number = match[2];
  const matches = archives.get(collection).filter(item => item.number === number ||
    (item.number.length === number.length + 1 && item.number.startsWith(number) && /[a-z]$/u.test(item.number)));
  if (!matches.length) {
    return {
      fields: [{ label: reference, value: "Unavailable in the bundled Hadith edition." }],
      sources: [{ title: reference, url: hadithSource({ collection, number }) }],
    };
  }
  const fields = matches.flatMap(item => {
    const title = `${match[1]} ${item.number}`;
    const grade = [item.grade.label, item.grade.grader].filter(Boolean).join(" · ");
    return [
      { label: `${title} · ${grade}`, value: item.text, lang: "en" },
      ...(item.arabic ? [{ label: title, value: item.arabic, lang: "ar" }] : []),
    ];
  });
  return { fields, sources: matches.map(item => ({ title: `${match[1]} ${item.number}`, url: hadithSource(item) })) };
}

function passageRow(entry) {
  const passage = essentialStudyPassage(entry.id);
  const ranges = passage.ranges.map(({ chapter, from, to }) => `${chapter}:${from}${from === to ? "" : `–${to}`}`).join(" · ");
  const group = `memorise-${entry.level}`;
  groups[group] = entry.level === 3 ? "Essential passages" : "Friday and Eid";
  const sources = passage.ranges.map(({ chapter, from, to }) => ({
    title: `Quran ${chapter}:${from}–${to}`,
    url: `https://quran.com/${chapter}/${from}`,
  }));
  const fields = [
    { label: "Study ranges", value: ranges },
    { label: "Verse count in the app", value: String(passage.ayahs) },
    { label: "Virtue card in the app", value: passage.source ? "Shown" : "Hidden" },
    ...(entry.why && !passage.why ? [{ label: "Wording in the handover", value: entry.why }] : []),
    ...(entry.source ? [{ label: "Handover citations and grade", value: `${entry.source.ref} · ${entry.source.grade}` }] : []),
  ];
  for (const ref of entry.source?.ref.split(" · ") ?? []) {
    const match = citationDetails(ref);
    fields.push(...match.fields);
    sources.push(...match.sources);
  }
  return {
    id: `memorise/${entry.id}`, variety: "memorise", group, label: entry.title,
    expected: passage.why ? { en: passage.why } : {}, fields, recordings: [], sources,
  };
}

const juzAmma = Object.entries(quran.surahs).filter(([chapter]) => Number(chapter) >= 78).flatMap(([, verses]) => verses);
const readingCoverage = { uthmani: 0, indopak: 0 };
groups["juz-amma"] = "Juz ʿAmma reader";
const readingRows = juzAmma.flatMap(verse => {
  const text = { uthmani: splitUthmaniOpening(verse.uthmani, verse.ref).text, indopak: verse.indopak };
  const sources = new Map([["ayah", { title: `Quran ${verse.ref}`, url: `https://quran.com/${verse.ref.replace(":", "/")}` }]]);
  const fields = [];
  for (const [script, name] of [["uthmani", "Uthmani"], ["indopak", "IndoPak"]]) {
    const annotations = tajweedVerseExamples(verse, script);
    if (!annotations) continue;
    readingCoverage[script]++;
    const words = splitArabicWords(text[script]);
    annotations.forEach((notes, index) => {
      const labels = notes.map(note => {
        const lesson = tajweedLessons.find(item => item.id === note.lesson);
        for (const source of tajweedLessonSources(lesson, false)) sources.set(source.url, source);
        const rule = tajweedMessages[tajweedReadingRuleKey(note)].en;
        return `${tajweedMessages[tajweedTitleKey(note.lesson)].en} · ${rule}${note.joining ? " when joining" : ""}`;
      });
      fields.push({ label: `${name} word ${index + 1} · ${labels.join(" / ")}`, value: words[index], lang: "ar" });
    });
  }
  return fields.length ? [{
    id: `reader/${verse.ref}`, variety: "reading", group: "juz-amma", label: verse.ref,
    expected: { ar: text.uthmani, indopak: text.indopak }, fields, recordings: [], sources: [...sources.values()],
  }] : [];
});

const rows = [
  ...tajweedLessons.flatMap(lesson => tajweedRows(lesson, false)),
  ...tajweedDepthLessons.flatMap(lesson => tajweedRows(lesson, true)),
  ...essentialPassages.map(passageRow),
  ...readingRows,
];
review.write(output, {
  title: "Tajweed and memorisation scholar review",
  reviewFormat: "awwab-scholar-review",
  filename: "awwab-scholar-review.json",
  instructions: `Check the app’s lesson wording, Quran excerpts, recitation references, reading annotations and memorisation citations. Record corrections in Notes. The Juz ʿAmma reader currently shows examples in ${readingCoverage.uthmani} Uthmani āyāt and ${readingCoverage.indopak} IndoPak āyāt out of ${juzAmma.length}.`,
  editionNotice: quran.notice,
  varieties: {
    essentials: { label: "Tajweed Essentials", assignment: "Check the rule wording, example and audio together." },
    advanced: { label: "Tajweed in depth", assignment: "Check the lesson explanation, focus letters and differences between scripts." },
    memorise: { label: "Memorisation", assignment: "Compare each proposed virtue with its cited narration and check the study range." },
    reading: { label: "Reading annotations", assignment: "Check each marked word and its rule against the two scripts. Record any missing or misplaced marks." },
  },
  varietyLabel: "Material",
  groupLabel: "Lesson or collection",
  groups,
}, rows);
