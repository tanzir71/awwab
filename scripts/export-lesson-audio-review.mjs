import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import alphabet from "../docs/content/arabic-letters.json" with { type: "json" };
import qaidaAudio from "../docs/content/qaida-audio.json" with { type: "json" };
import qaida from "../docs/content/qaida-lessons.json" with { type: "json" };
import umrahAudio from "../docs/content/umrah-guide-audio.json" with { type: "json" };
import umrah from "../docs/content/umrah-steps.json" with { type: "json" };
import french from "../handovers/H2-languages-paths-arabic-help/drafts/fr.json" with { type: "json" };
import urdu from "../handovers/H2-languages-paths-arabic-help/drafts/ur.json" with { type: "json" };
import { qaidaAudioRef, qaidaHarakatExercise, qaidaHarakatExerciseRef, qaidaRowCitation, qaidaRows } from "../src/lib/qaidaPractice.ts";
import { qaidaRecitationLessons, qaidaRecitations } from "../src/lib/qaidaRecitation.ts";
import { splitUthmaniOpening } from "../src/lib/quranOpening.ts";
import { umrahStepNote, umrahStepSummary, umrahStepTitle } from "../src/lib/umrah-step-messages.mjs";
import { pronunciationReview } from "./pronunciation-review.mjs";

const [output] = process.argv.slice(2);
if (process.argv.length !== 3) throw new Error("Usage: node scripts/export-lesson-audio-review.mjs <new-directory>");

const quran = JSON.parse(gunzipSync(readFileSync(new URL("../public/data/quran-study-v1.json.gz", import.meta.url))));
const review = pronunciationReview();
const letters = new Map(alphabet.letters.map(letter => [letter.letter, letter.name]));
const generatedRefs = new Set();

function clip(path, label) {
  return { label, ...review.recording(path, path.replace(/^packs\//u, "audio/")) };
}

function quranSource(reference) {
  return { title: `Quran ${reference}`, url: `https://quran.com/${reference.replace(":", "/")}` };
}

function generatedEntry(lesson, ref, label, rows, citation) {
  const path = qaidaAudio.items[ref];
  if (!path || generatedRefs.has(ref)) throw new Error(`Expected one generated Qaida recording for ${ref}.`);
  generatedRefs.add(ref);

  const names = lesson <= 3 ? rows.flatMap(row => Array.from(row).flatMap(letter => letters.get(letter) ?? [])) : [];
  return {
    id: ref,
    variety: "qaida-generated",
    group: `qaida-${lesson}`,
    label,
    role: names.length ? "Letter names in reading order" : "Generated pronunciation drill",
    expected: { ar: rows.join(" · "), ...(names.length ? { tr: names.join(" · ") } : {}) },
    recordings: [clip(path, qaidaAudio.voice)],
    sources: [{ title: qaidaAudio.voice, url: qaidaAudio.source }, ...(citation ? [quranSource(citation.verse)] : [])],
  };
}

function passage(recording) {
  const [chapter, ayah] = recording.ref.split(":");
  const surah = quran.surahs[chapter === "surah" ? ayah : chapter];
  const verses = chapter === "surah" ? surah : surah?.slice(Number(ayah) - 1, recording.throughAyah ?? Number(ayah));
  if (!verses?.length) throw new Error(`No Quran text is bundled for ${recording.ref}.`);
  const reference = verses.length === 1 ? verses[0].ref : `${verses[0].ref}–${verses.at(-1).ref.split(":")[1]}`;
  return { verses, reference, recording };
}

function recitationEntry(lesson, ref, label, clips, drill, citation) {
  const passages = clips.map(passage);
  const verses = passages.flatMap(item => item.verses);
  const sources = new Map();
  for (const item of passages) {
    for (const verse of item.verses) {
      const source = quranSource(verse.ref);
      sources.set(source.url, source);
    }
    const { recording } = item;
    sources.set(recording.source, { title: `Recitation source · ${recording.speaker}`, url: recording.source });
    sources.set(recording.licenseUrl, { title: recording.license, url: recording.licenseUrl });
  }
  return {
    id: ref,
    variety: "qaida-recitation",
    group: `qaida-${lesson}`,
    label,
    role: "Quran recitation",
    expected: {
      ar: verses.map(verse => splitUthmaniOpening(verse.uthmani, verse.ref).text).join(" · "),
      indopak: verses.map(verse => verse.indopak).join(" · "),
    },
    fields: [
      { label: "Recording order", value: passages.map(item => item.reference).join(" · ") },
      ...(drill ? [{ label: `Drill shown in the app · Quran ${citation.verse}, word ${citation.first}`, value: drill, lang: "ar" }] : []),
    ],
    recordings: passages.map(({ recording, reference }) => clip(recording.path, `${recording.speaker} · ${reference}`)),
    sources: [...sources.values()],
  };
}

function qaidaEntries(lesson) {
  const texts = qaidaRows(lesson).map(row => row.flat().join(" "));
  const fullRef = qaidaAudioRef(lesson);
  const fullClips = qaidaRecitationLessons[fullRef] ?? (qaidaRecitations[fullRef] ? [qaidaRecitations[fullRef]] : []);
  const entries = [
    fullClips.length ? recitationEntry(lesson, fullRef, "Full lesson recitation", fullClips) :
      generatedEntry(lesson, fullRef, "Full lesson drill", texts),
    ...texts.map((text, index) => {
      const ref = qaidaAudioRef(lesson, index);
      const recording = qaidaRecitations[ref];
      const citation = qaidaRowCitation(lesson, index);
      const label = `Row ${index + 1}`;
      return recording ? recitationEntry(lesson, ref, label, [recording], text, citation) :
        generatedEntry(lesson, ref, label, [text], citation);
    }),
  ];
  if (lesson === 4) {
    entries.push(generatedEntry(lesson, qaidaHarakatExerciseRef, "Harakat listening exercise", [qaidaHarakatExercise]));
  }
  return entries;
}

const ritualDrafts = {
  fr: { name: "French", messages: french.messages },
  ur: { name: "Urdu", messages: urdu.messages },
};

const ritualEntries = umrahAudio.packs.flatMap(pack => {
  if (pack.items.length !== umrah.steps.length) throw new Error(`Expected one recording per ritual in ${pack.id}.`);
  const draft = ritualDrafts[pack.language];
  return umrah.steps.map((step, index) => {
    const item = pack.items[index];
    if (item.ref !== `${pack.id}:${step.id}` || !step.narration[pack.language]) {
      throw new Error(`The ${step.id} narration must match its recording in ${pack.id}.`);
    }
    return {
      id: item.ref,
      variety: `umrah-${pack.language}`,
      group: "umrah",
      label: `${index + 1}. ${pack.language === "bn" ? step.titleBn : step.title}`,
      role: pack.attribution,
      expected: { [pack.language]: step.narration[pack.language] },
      fields: [
        { label: "English on-screen summary", value: step.summary, lang: "en" },
        { label: "Bangla on-screen summary", value: step.summaryBn, lang: "bn" },
        ...(step.notes ? [{ label: "English on-screen notes", value: step.notes.join("\n"), lang: "en" }] : []),
        ...(step.notesBn ? [{ label: "Bangla on-screen notes", value: step.notesBn.join("\n"), lang: "bn" }] : []),
        ...(draft ? [
          { label: `${draft.name} on-screen title`, value: draft.messages[umrahStepTitle(step.id)].text, lang: pack.language },
          { label: `${draft.name} on-screen summary`, value: draft.messages[umrahStepSummary(step.id)].text, lang: pack.language },
          ...(step.notes ?? []).map((_, noteIndex) => ({
            label: `${draft.name} on-screen note`,
            value: draft.messages[umrahStepNote(step.id, noteIndex)].text,
            lang: pack.language,
          })),
        ] : []),
      ],
      recordings: [clip(item.path, pack.speaker)],
      sources: [
        ...step.sources.map(source => ({ title: source.label, url: source.url })),
        { title: pack.speaker, url: pack.source },
        { title: "Recording source terms", url: pack.licenseUrl },
        ...(pack.dataset ? [{ title: pack.datasetName ?? "Training dataset", url: pack.dataset }] : []),
      ],
    };
  });
});

const qaidaReviewEntries = qaida.lessons.flatMap(lesson => qaidaEntries(lesson.n));
if (Object.keys(qaidaAudio.items).some(ref => !generatedRefs.has(ref))) throw new Error("The review is missing a published Qaida drill.");
const expectedClips = new Set([
  ...Object.values(qaidaAudio.items),
  ...Object.values(qaidaRecitations).map(recording => recording.path),
  ...umrahAudio.packs.flatMap(pack => pack.items.map(item => item.path)),
]);

review.write(output, {
  title: "Qaida and Umrah audio review",
  reviewFormat: "awwab-lesson-audio-review",
  filename: "awwab-lesson-audio-review.json",
  instructions: "Compare each recording with its text. The Quran entries show the numbered verses in the recording and the shorter drill where applicable. Record pronunciation, wording or source corrections in Notes.",
  editionNotice: quran.notice,
  varieties: {
    "qaida-generated": { label: "Qaida generated pronunciation", assignment: "An Arabic teacher checks the modelled letter names, individual sounds and practice words." },
    "qaida-recitation": { label: "Qaida Quran recitations", assignment: "A Quran teacher checks the recited verses, citation and whether the clip demonstrates the drill." },
    "umrah-en": { label: "Umrah English narration", assignment: "An English speaker checks pronunciation. A scholar checks the instructions against the cited sources." },
    "umrah-bn": { label: "Umrah Bangla narration", assignment: "A Bangla speaker checks wording and pronunciation. A scholar checks the instructions against the cited sources." },
    "umrah-ur": { label: "Umrah Urdu narration", assignment: "An Urdu speaker checks wording and pronunciation. A scholar checks the instructions against the cited sources." },
    "umrah-fr": { label: "Umrah French narration", assignment: "A French speaker checks wording and pronunciation. A scholar checks the instructions against the cited sources." },
  },
  varietyLabel: "Material",
  groupLabel: "Lesson or guide",
  groups: {
    ...Object.fromEntries(qaida.lessons.map(lesson => [`qaida-${lesson.n}`, `Lesson ${lesson.n} · ${lesson.title}`])),
    umrah: "Umrah ritual guide",
  },
}, [...qaidaReviewEntries, ...ritualEntries], expectedClips.size);
