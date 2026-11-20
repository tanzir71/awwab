import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const publicRoot = new URL("../public/", import.meta.url);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

export function askRecordingIndex() {
  const manifest = JSON.parse(readFileSync(new URL("../docs/content/umrah-phrase-audio.json", import.meta.url), "utf8"));
  const bytes = readFileSync(new URL("packs/phrases/checksums.json", publicRoot));
  if (digest(bytes) !== manifest.checksumsSha256) {
    throw new Error("The recording index must match the current Ask audio manifest.");
  }
  return { manifest, index: JSON.parse(bytes.toString("utf8")) };
}

export function pronunciationReview() {
  const assets = new Map();

  function recording(path, reviewPath, expectedDigest) {
    if (!assets.has(path)) {
      const bytes = readFileSync(new URL(path, publicRoot));
      const opus = path.endsWith(".opus") && bytes.subarray(0, 4).toString() === "OggS" && bytes.subarray(0, 95).includes("OpusHead");
      const mp3 = path.endsWith(".mp3") && (bytes.subarray(0, 3).toString() === "ID3" ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
      if (!opus && !mp3) {
        throw new Error(`The recording at ${path} must match its Opus or MP3 format.`);
      }
      assets.set(path, { bytes, path: reviewPath, sha256: digest(bytes) });
    }
    const clip = assets.get(path);
    if (clip.path !== reviewPath || (expectedDigest && expectedDigest !== clip.sha256)) {
      throw new Error(`The recording at ${path} must match its review path and checksum.`);
    }
    return { path: clip.path, sha256: clip.sha256 };
  }

  function write(output, metadata, rows, expectedClipCount = assets.size) {
    if (assets.size !== expectedClipCount || !assets.size || new Set(rows.map(row => row.id)).size !== rows.length) {
      throw new Error("The review must cover the expected recordings under unique entry identifiers.");
    }
    const source = {
      ...metadata,
      reviewSourceSha256: digest(JSON.stringify(rows)),
      clipCount: assets.size,
      rows,
    };
    const viewer = readFileSync(new URL("./pronunciation-review.html", import.meta.url), "utf8");
    const embedded = JSON.stringify(source).replaceAll("<", "\\u003c");
    const target = resolve(output);
    mkdirSync(target);
    for (const { path, bytes } of assets.values()) {
      const file = resolve(target, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, bytes);
    }
    writeFileSync(resolve(target, "index.html"), viewer.replace("/* REVIEW SOURCE */", () => embedded));
    console.log(`Exported ${rows.length} review entries and ${assets.size} verified recordings to ${target}`);
  }
  return { recording, write };
}
