import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const contentDir = process.env.AWWAB_CONTENT_DIR;
const fromLocal = process.argv.includes("--from-local");
const output = new URL("../public/packs/audio/", import.meta.url);
const dir = new URL("../public/packs/audio/aaqib-azeez/", import.meta.url);
const run = promisify(execFile);
const timings = JSON.parse(await readFile(new URL("../docs/content/recitation-timings.json", import.meta.url), "utf8")) as
  Record<number, { sha256: string; rangesMs: [number, number][] }>;
const { surahs } = JSON.parse(await readFile(new URL("../public/data/quran-v1.json", import.meta.url), "utf8")) as
  { surahs: Record<number, { ref: string }[]> };
type Source = { id: string; source: string; attribution: string; licenseUrl: string };
const localIndex: { packs: Source[] } | undefined = fromLocal
  ? JSON.parse(await readFile(new URL("index.json", output), "utf8")) : undefined;
const names = [
  [1, "Al-Fatiha", ""], [103, "Al-Asr", ""], [105, "Al-Fil", " v2"], [106, "Quraysh", " v2"],
  [107, "Al-Ma'un", ""], [108, "Al-Kawthar", ""], [109, "Al-Kafirun", ""], [110, "An-Nasr", " v2"],
  [111, "Al-Masad", ""], [112, "Al-Ikhlas", ""], [113, "Al-Falaq", " v2"], [114, "Al-Nas", " v2"],
] as const;

async function request(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60000),
    headers: { "User-Agent": "Awwab build (https://github.com/tanzir71/awwab)" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response;
}

async function getRecording(number: number, name: string, version: string) {
  const id = `aaqib-${number}`;
  if (fromLocal) {
    const source = localIndex?.packs.find(pack => pack.id === id);
    if (!source) throw new Error(`No source metadata for ${name}.`);
    return { source, bytes: await readFile(new URL(`${number}.mp3`, dir)) };
  }
  const title = `File:Chapter ${number}, ${name} (Murattal)${version} - Recitation of the Holy Qur'an.mp3`;
  const page = "https://commons.wikimedia.org/wiki/" + encodeURIComponent(title.replaceAll(" ", "_"));
  const html = contentDir ? await readFile(join(contentDir, `audio-${number}.html`), "utf8") : await (await request(page)).text();
  const sourceBox = html.match(/id="Licensing"([\s\S]*?)(?:id="(?:File_history|filehistory)"|$)/i)?.[1] ?? "";
  const labels = new Set([...sourceBox.matchAll(/class="licensetpl(?:_|&#95;)short"[^>]*>\s*([^<]+)/gi)].map(match => match[1].trim()));
  const zero = labels.has("CC0");
  const shareAlike = labels.has("CC BY-SA 4.0");
  if ((!zero && !shareAlike) || !/Aaqib Azeez/i.test(html) || !/Own work/i.test(html)) throw new Error("Recording terms could not be verified from the file page.");
  const license = zero ? "CC0 1.0" : "CC BY-SA 4.0";
  const licenseUrl = zero ? "https://creativecommons.org/publicdomain/zero/1.0/" : "https://creativecommons.org/licenses/by-sa/4.0/";
  const file = html.match(/(?:href|src)="(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?!thumb\/)[^"]+?\.mp3)(?:\?[^"]*)?"/i)?.[1];
  if (!file) throw new Error("Original MP3 URL was not found.");
  const bytes = contentDir ? await readFile(join(contentDir, `audio-${number}.mp3`)) : Buffer.from(await (await request(file)).arrayBuffer());
  if (bytes.length < 10_000 || !(bytes.subarray(0, 3).toString() === "ID3" || bytes[0] === 0xff)) throw new Error("The downloaded file is not an MP3.");
  const attribution = `Aaqib Azeez · ${license} · Wikimedia Commons${zero ? "" : " · āyah clips trimmed and re-encoded"}`;
  return { source: { id, source: page, attribution, licenseUrl }, bytes };
}

const recordings = [];
for (const [number, name, version] of names) {
  const track = await getRecording(number, name, version);
  const timing = timings[number];
  const verses = surahs[number];
  if (!timing || !verses || timing.rangesMs.length !== verses.length) throw new Error(`Missing verse timings for ${name}.`);
  if (createHash("sha256").update(track.bytes).digest("hex") !== timing.sha256) {
    throw new Error(`${name} recording has changed. Recheck the verse cuts before generating this pack.`);
  }
  recordings.push({ ...track, number, name, verses, ranges: timing.rangesMs });
}

await mkdir(dir, { recursive: true });
const packs = [];
for (const { source: { id, source, attribution, licenseUrl }, bytes, number, name, verses, ranges } of recordings) {
  const chapter = new URL(`${number}.mp3`, dir);
  if (!fromLocal) await writeFile(chapter, bytes);
  const items = [{ ref: `surah:${number}`, path: `packs/audio/aaqib-azeez/${number}.mp3` }];
  let size = bytes.length;
  for (const [i, [start, end]] of ranges.entries()) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || (i > 0 && start < ranges[i - 1][1])) {
      throw new Error(`Invalid timing for ${verses[i].ref}.`);
    }
    const filename = `${number}-${i + 1}.mp3`;
    const { stdout: clip } = await run("ffmpeg", [
      "-nostdin", "-v", "error", "-ss", String(start / 1000), "-i", fileURLToPath(chapter),
      "-t", String((end - start) / 1000), "-map_metadata", "-1", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "96k", "-f", "mp3", "pipe:1",
    ], { encoding: "buffer" });
    if (clip.length < 1000) throw new Error(`Empty clip for ${verses[i].ref}.`);
    await writeFile(new URL(filename, dir), clip);
    items.push({ ref: verses[i].ref, path: `packs/audio/aaqib-azeez/${filename}` });
    size += clip.length;
  }
  packs.push({ id, name, speaker: "Aaqib Azeez", source, attribution, licenseUrl, bytes: size, items });
}
await writeFile(new URL("index.json", output), JSON.stringify({ version: 1, packs }, null, 2) + "\n");
