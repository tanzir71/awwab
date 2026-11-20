import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { splitUthmaniOpening } from "../src/lib/quranOpening.ts";

const project = new URL("../", import.meta.url);
const sourceDir = process.env.AWWAB_CONTENT_DIR;
const surahs = JSON.parse(await readFile(new URL("docs/content/surahs-for-salah.json", project), "utf8")).surahs;
const sources = {
  uthmani: "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2",
  uthmaniStudy: "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true&marks=true",
  pickthall: "https://tanzil.net/trans/en.pickthall",
  indopak: "https://raw.githubusercontent.com/DigitalKhatt/digitalkhatt-js/78372d7a1e211bbab677cc0304384f278f508657/apps/site-angular/src/app/services/quran_text_indopak_15.ts",
  metadata: "https://tanzil.net/res/text/metadata/quran-data.xml",
};

async function source(name: keyof typeof sources): Promise<string> {
  if (sourceDir) return readFile(join(sourceDir, name === "metadata" ? "quran-data.xml" : name === "indopak" ? "indopak-dk.ts" : `${name}.txt`), "utf8");
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
    const numbered = index === 8 ? [basmala, ...lines] : lines;
    const verses = numbered.join(" ").split(/(?:۝[٠-٩]*|\u202e[٠-٩]+)[^\s\p{L}]*/gu).map(line => line.trim()).filter(Boolean);
    if (index !== 0) return verses;
    return [basmala.split("۝")[0].trim(), ...verses.slice(0, 5), verses.slice(5).join(" ")];
  });
}

const [arabic, studyArabic, english, indopakText, metadata] = await Promise.all([
  source("uthmani"), source("uthmaniStudy"), source("pickthall"), source("indopak"), source("metadata"),
]);
const uthmani = parseVerses(arabic);
const studyUthmani = parseVerses(studyArabic);
const translation = parseVerses(english);
const indopak = parseIndopak(indopakText);
if (!uthmani.has("1:1")) throw new Error("Missing Al-Fātiḥa 1:1 in the Uthmani source.");
const chapters = [...metadata.matchAll(/<sura index="(\d+)" ayas="(\d+)" start="(\d+)" name="([^"]+)" tname="([^"]+)" ename="([^"]+)"/g)]
  .map(([, number, ayahs, start, nameArabic, title, meaning]) => ({ number: Number(number), ayahs: Number(ayahs), start: Number(start), nameArabic, title, meaning }));
const juzs = [...metadata.matchAll(/<juz index="(\d+)" sura="(\d+)" aya="(\d+)"/g)]
  .map(([, number, chapter, ayah]) => ({ number: Number(number), start: `${chapter}:${ayah}`, offset: chapters[Number(chapter) - 1].start + Number(ayah) - 1 }));
if (chapters.length !== 114 || juzs.length !== 30 || uthmani.size !== 6236 || studyUthmani.size !== 6236 || translation.size !== 6236) throw new Error("The Quran sources do not cover all chapters, verses and juzs.");
const full: Record<string, { ref: string; uthmani: string; indopak: string; english: string }[]> = {};
for (const chapter of chapters) {
  if (indopak[chapter.number - 1]?.length !== chapter.ayahs) throw new Error(`Unexpected IndoPak verse count for ${chapter.number}`);
  full[chapter.number] = Array.from({ length: chapter.ayahs }, (_, i) => {
    const ref = `${chapter.number}:${i + 1}`;
    if (!uthmani.has(ref) || !studyUthmani.has(ref) || !translation.has(ref)) throw new Error(`Missing verse ${ref}`);
    return { ref, uthmani: studyUthmani.get(ref)!, indopak: indopak[chapter.number - 1][i], english: translation.get(ref)! };
  });
}
const notice = arabic.split(/\r?\n/).filter(line => line.startsWith("#")).join("\n");
const supported = Object.fromEntries(surahs.slice(0, 12).map(({ number }: { number: number }) => [number, full[number].map(verse => ({
  ...verse, uthmani: splitUthmaniOpening(uthmani.get(verse.ref)!, verse.ref).text,
}))]));
const { metadata: _metadata, uthmaniStudy: _study, ...originalSources } = sources;
const result = JSON.stringify({ version: 1, notice, sources: originalSources, surahs: supported }, null, 2) + "\n";
await mkdir(new URL("public/data/", project), { recursive: true });
await writeFile(new URL("public/data/quran-v1.json", project), result);
const studyChapters = chapters.map(chapter => ({ ...chapter, words: full[chapter.number].reduce((sum, verse) => {
  const { text } = splitUthmaniOpening(verse.uthmani, verse.ref);
  return sum + text.split(/\s+/).filter(word => /\p{L}/u.test(word)).length;
}, 0) }));
await writeFile(new URL("public/data/quran-study-index-v1.json", project), JSON.stringify({ version: 1, source: sources.metadata,
  chapters: studyChapters, juzs, kursi: full[2][254].uthmani.split(/\s+/).slice(0, 5).join(" ") }, null, 2) + "\n");
const studyNotice = studyArabic.split(/\r?\n/).filter(line => line.startsWith("#")).join("\n");
await writeFile(new URL("public/data/quran-study-v1.json.gz", project), gzipSync(JSON.stringify({ version: 1, notice: studyNotice,
  sources: { ...originalSources, uthmani: sources.uthmaniStudy, metadata: sources.metadata }, surahs: full }), { level: 9 }));
