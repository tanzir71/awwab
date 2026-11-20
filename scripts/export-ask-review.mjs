import { askClipPath, askRecordingScenarios, askVarieties, renderAsk } from "../src/lib/umrahAsk.ts";
import { askRecordingIndex, pronunciationReview } from "./pronunciation-review.mjs";

const [output] = process.argv.slice(2);
if (process.argv.length !== 3) throw new Error("Usage: node scripts/export-ask-review.mjs <new-directory>");

const { manifest, index } = askRecordingIndex();
const review = pronunciationReview();

function reviewClip(variety, voice, id) {
  const path = askClipPath(variety, voice, id);
  if (!index[path]) throw new Error(`The recording at ${path} needs a published checksum.`);
  return { id, ...review.recording(path, path.replace("packs/phrases/", "audio/"), index[path]) };
}

const rows = askVarieties.flatMap(variety => {
  const scenarios = askRecordingScenarios(variety);
  return manifest.voices.flatMap(voice => scenarios.map(({ id, phrase, options, clips }) => ({
    id: `${variety}/${voice}/${id}`,
    variety,
    voice,
    label: options.gate ? `Gate ${options.gate}` : id,
    expected: renderAsk(phrase, variety, options),
    recordings: clips.map(clip => reviewClip(variety, voice, clip)),
  })));
});
review.write(output, {
  title: "Ask in Arabic pronunciation review",
  reviewFormat: "awwab-ask-pronunciation-review",
  filename: "awwab-ask-review.json",
  instructions: "Listen to the generated speech and compare it with the Arabic shown in the app. For gate entries, listen to the prefix and the number in order. Record pronunciation, dialect or text corrections in Notes.",
  varieties: {
    saudi: { label: "Saudi Hijazi", assignment: "Two native Saudi Hijazi reviewers are needed, including one living in Makkah." },
    msa: { label: "Modern Standard Arabic", assignment: "An Arabic teacher reviews the Modern Standard Arabic entries." },
  },
  groupLabel: "Voice",
  groups: Object.fromEntries(Object.entries(manifest.credits).map(([id, credit]) =>
    [id, `${id === "female" ? "Female" : "Male"} · ${credit.name}`])),
  version: manifest.version,
  checksumsSha256: manifest.checksumsSha256,
  voices: manifest.credits,
}, rows, Object.keys(index).length);
