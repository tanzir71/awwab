import { speakCourses, speakLessonContent, speakVarieties } from "../src/lib/speakCurriculum.ts";
import { askRecordingIndex, pronunciationReview } from "./pronunciation-review.mjs";

const [output] = process.argv.slice(2);
if (process.argv.length !== 3) throw new Error("Usage: node scripts/export-speak-review.mjs <new-directory>");

const { manifest, index } = askRecordingIndex();
const review = pronunciationReview();
const contexts = {};

function recording(path, variety) {
  const shared = path.startsWith("packs/phrases/");
  if (shared && !index[path]) throw new Error(`The shared Ask recording at ${path} needs a published checksum.`);
  const label = variety === "msa" ? "Nabra INT8" : manifest.credits.female.name;
  return { label, ...review.recording(path, path.replace(/^packs\//, "audio/"), index[path]) };
}

function lessonRows(unit, variety, group) {
  const { lines, words, clips } = speakLessonContent(unit, path => path);
  const title = unit.title[0];
  const hasDialogue = "dialogue" in unit || unit.id === "sim";
  const partner = "partner" in unit ? unit.partner[0] : "Shop";
  function entry(key, label, role, expected) {
    return {
      id: `${unit.id}/${key}`,
      unit: unit.id,
      variety,
      group,
      label: `${title} · ${label}`,
      role,
      expected,
      recordings: [recording(clips[key], variety)],
    };
  }

  const dialogue = lines.map(({ ar, tr, meaning: [en, bn] }, i) => entry(
    `line-${i}`,
    `${hasDialogue ? "Dialogue line" : "Phrase"} ${i + 1}`,
    !hasDialogue || i % 2 === 0 ? "You" : partner,
    { ar, tr, en, bn },
  ));
  if (hasDialogue) contexts[unit.id] = dialogue.map(({ id, role, expected: { ar, en } }) => ({ id, role, ar, en }));

  const vocabulary = words.map(({ ar, tr, meaning: [en, bn] }, i) =>
    entry(`word-${i}`, `Word ${i + 1}`, "Vocabulary", { ar, tr, en, bn }));
  const [en, bn] = unit.meaning;
  const spoken = "signSpeech" in unit && unit.signSpeech !== unit.sign ? unit.signSpeech : undefined;
  const sign = entry("sign", "Sign", "", { ar: unit.sign, en, bn, ...(spoken ? { spoken } : {}) });
  return [...dialogue, ...vocabulary, sign];
}

const rows = speakVarieties.flatMap(variety => Object.entries(speakCourses[variety]).flatMap(([group, units]) =>
  units.flatMap(unit => lessonRows(unit, variety, group))));

review.write(output, {
  title: "Speak lesson pronunciation review",
  reviewFormat: "awwab-speak-pronunciation-review",
  filename: "awwab-speak-review.json",
  instructions: "Compare the generated recording with the Arabic and its meaning in the lesson. Open Full lesson dialogue for context. Record any language, pronunciation or translation corrections in Notes.",
  varieties: {
    "saudi-hijazi": { label: "Saudi Hijazi", assignment: "A native Saudi Hijazi speaker reviews these lessons." },
    gulf: { label: "Gulf Arabic", assignment: "A native Gulf Arabic speaker reviews the Emirati usage in these lessons." },
    msa: { label: "Modern Standard Arabic", assignment: "An Arabic teacher reviews the Modern Standard Arabic lessons." },
  },
  groupLabel: "Course",
  groups: { A1: "A1 · Survival", A2: "A2 · Everyday", B1: "B1 · Conversation", "umrah-hajj": "Umrah & Hajj", "gulf-work": "Working in the Gulf" },
  contexts,
}, rows);
