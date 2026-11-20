import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { askClipPath, askRecordingScenarios, askVarieties, renderAsk } from "../src/lib/umrahAsk.ts";

const [output] = process.argv.slice(2);
if (process.argv.length !== 3) throw new Error("Usage: node scripts/export-ask-review.mjs <new-directory>");

const publicRoot = new URL("../public/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("../docs/content/umrah-phrase-audio.json", import.meta.url), "utf8"));
const indexBytes = readFileSync(new URL("packs/phrases/checksums.json", publicRoot));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
if (digest(indexBytes) !== manifest.checksumsSha256) {
  throw new Error("The recording index must match the current Ask audio manifest.");
}
const index = JSON.parse(indexBytes.toString("utf8"));
const assets = new Map();

function reviewClip(variety, voice, id) {
  const path = askClipPath(variety, voice, id);
  if (!assets.has(path)) {
    const bytes = readFileSync(new URL(path, publicRoot));
    if (index[path] !== digest(bytes)) throw new Error(`The recording at ${path} must match its checksum.`);
    assets.set(path, bytes);
  }
  return {
    id,
    path: path.replace("packs/phrases/", "audio/"),
    sha256: index[path],
  };
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
if (assets.size !== Object.keys(index).length || assets.size === 0) {
  throw new Error("The review set must cover all published Ask recordings.");
}
const source = {
  version: manifest.version,
  checksumsSha256: manifest.checksumsSha256,
  reviewSourceSha256: digest(JSON.stringify(rows)),
  voices: manifest.credits,
  clipCount: assets.size,
  rows,
};
const viewer = readFileSync(new URL("./ask-review.html", import.meta.url), "utf8");
const embedded = JSON.stringify(source).replaceAll("<", "\\u003c");
const target = resolve(output);
mkdirSync(target);
for (const [path, bytes] of assets) {
  const file = resolve(target, path.replace("packs/phrases/", "audio/"));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}
writeFileSync(resolve(target, "index.html"), viewer.replace("/* REVIEW SOURCE */", () => embedded));
console.log(`Exported ${rows.length} review entries and ${assets.size} verified recordings to ${target}`);
