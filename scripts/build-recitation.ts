import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const contentDir = process.env.AWWAB_CONTENT_DIR;
const output = new URL("../public/packs/audio/", import.meta.url);
const dir = new URL("../public/packs/audio/aaqib-azeez/", import.meta.url);
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

await mkdir(dir, { recursive: true });
const packs = [];
for (const [number, name, version] of names) {
  const title = `File:Chapter ${number}, ${name} (Murattal)${version} - Recitation of the Holy Qur'an.mp3`;
  const page = "https://commons.wikimedia.org/wiki/" + encodeURIComponent(title.replaceAll(" ", "_"));
  try {
    const html = contentDir ? await readFile(join(contentDir, `audio-${number}.html`), "utf8") : await (await request(page)).text();
    const zero = /creativecommons\.org\/publicdomain\/zero\/1\.0/.test(html);
    const shareAlike = /creativecommons\.org\/licenses\/by-sa\/4\.0/.test(html);
    if ((!zero && !shareAlike) || !/Aaqib Azeez/i.test(html) || !/Own work/i.test(html)) throw new Error("Recording terms could not be verified from the file page.");
    const license = zero ? "CC0 1.0" : "CC BY-SA 4.0";
    const licenseUrl = zero ? "https://creativecommons.org/publicdomain/zero/1.0/" : "https://creativecommons.org/licenses/by-sa/4.0/";
    const file = html.match(/(?:href|src)="(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?!thumb\/)[^"]+?\.mp3)(?:\?[^"]*)?"/i)?.[1];
    if (!file) throw new Error("Original MP3 URL was not found.");
    const bytes = contentDir ? await readFile(join(contentDir, `audio-${number}.mp3`)) : Buffer.from(await (await request(file)).arrayBuffer());
    if (bytes.length < 10_000 || !(bytes.subarray(0, 3).toString() === "ID3" || bytes[0] === 0xff)) throw new Error("The downloaded file is not an MP3.");
    await writeFile(new URL(`${number}.mp3`, dir), bytes);
    packs.push({
      id: `aaqib-${number}`, name, speaker: "Aaqib Azeez", source: page, attribution: `Aaqib Azeez · ${license} · Wikimedia Commons`,
      licenseUrl, bytes: bytes.length, items: [{ ref: `surah:${number}`, path: `packs/audio/aaqib-azeez/${number}.mp3` }],
    });
  } catch (error) {
    console.warn(`Skipped ${name}: ${error instanceof Error ? error.message : error}`);
  }
}
if (!packs.length) throw new Error("No recitation files were downloaded.");
await writeFile(new URL("index.json", output), JSON.stringify({ version: 1, packs }, null, 2) + "\n");
