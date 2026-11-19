import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const project = new URL("../", import.meta.url);
const sourceDir = process.env.AWWAB_CONTENT_DIR;
const surahs = JSON.parse(await readFile(new URL("docs/content/surahs-for-salah.json", project), "utf8")).surahs;
const sources = {
  uthmani: "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2",
  pickthall: "https://tanzil.net/trans/en.pickthall",
  indopak: "https://raw.githubusercontent.com/DigitalKhatt/digitalkhatt-js/78372d7a1e211bbab677cc0304384f278f508657/apps/site-angular/src/app/services/quran_text_indopak_15.ts",
};

async function source(name: keyof typeof sources): Promise<string> {
  if (sourceDir) return readFile(join(sourceDir, name === "indopak" ? "indopak-dk.ts" : `${name}.txt`), "utf8");
  const response = await fetch(sources[name], { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${name} source returned HTTP ${response.status}`);
  return response.text();
}

function parseVerses(text: string) {
  const result = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const verse = line.match(/^(\d+)\|(\d+)\|(.+)$/);
    if (verse) result.set(`${verse[1]}:${verse[2]}`, verse[3]);
  }
  return result;
}

function parseIndopak(text: string) {
  const chapters: string[][] = [];
  for (const [, line] of text.matchAll(/^\s*'([^']*)',/gm)) {
    if (line.startsWith("سُورَةُ")) chapters.push([]);
    else chapters[chapters.length - 1]?.push(line);
  }
  if (chapters.length !== 114) throw new Error("The IndoPak source does not contain 114 chapter headings.");
  return chapters.map(([basmala, ...lines], index) => {
    const verses = lines.join(" ").split(/(?:۝[٠-٩]*|\u202e[٠-٩]+)[^\s\p{L}]*/gu).map(line => line.trim()).filter(Boolean);
    if (index !== 0) return verses;
    return [basmala.split("۝")[0].trim(), ...verses.slice(0, 5), verses.slice(5).join(" ")];
  });
}

const [arabic, english, indopakText] = await Promise.all([source("uthmani"), source("pickthall"), source("indopak")]);
const uthmani = parseVerses(arabic);
const translation = parseVerses(english);
const indopak = parseIndopak(indopakText);
const basmala = uthmani.get("1:1");
if (!basmala) throw new Error("Missing Al-Fātiḥa 1:1 in the Uthmani source.");
const unnumberedOpening = basmala + " ";
const supported: Record<string, { ref: string; uthmani: string; indopak: string; english: string }[]> = {};
for (const chapter of surahs.slice(0, 12)) {
  if (indopak[chapter.number - 1]?.length !== chapter.ayahs) throw new Error(`Unexpected IndoPak verse count for ${chapter.number}`);
  supported[chapter.number] = Array.from({ length: chapter.ayahs }, (_, i) => {
    const ref = `${chapter.number}:${i + 1}`;
    if (!uthmani.has(ref) || !translation.has(ref)) throw new Error(`Missing verse ${ref}`);
    const text = uthmani.get(ref)!;
    const numberedText = chapter.number !== 1 && i === 0 && text.startsWith(unnumberedOpening)
      ? text.slice(unnumberedOpening.length) : text;
    return { ref, uthmani: numberedText, indopak: indopak[chapter.number - 1][i], english: translation.get(ref)! };
  });
}
const notice = arabic.split(/\r?\n/).filter(line => line.startsWith("#")).join("\n");
const result = JSON.stringify({ version: 1, notice, sources, surahs: supported }, null, 2) + "\n";
await mkdir(new URL("public/data/", project), { recursive: true });
await writeFile(new URL("public/data/quran-v1.json", project), result);
