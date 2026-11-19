import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { canonicalHadithNumber, collectionIds, editionUrl, narrationGrade, type HadithCollection, type HadithNarration } from "../src/lib/hadith-catalogue.ts";
import curated from "../docs/content/hadith-curated.json" with { type: "json" };

const dir = new URL("../public/data/", import.meta.url);
const local = process.env.AWWAB_CONTENT_DIR;

interface RawHadith {
  arabicnumber?: number | string;
  text: string;
  grades: { name: string; grade: string }[];
  reference: { book: number; hadith: number };
}

async function load(collection: HadithCollection): Promise<{ hadiths: RawHadith[] }> {
  if (local) return JSON.parse(await readFile(join(local, `eng-${collection}.json`), "utf8"));
  const response = await fetch(editionUrl(collection), { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Hadith source ${collection} returned HTTP ${response.status}`);
  return response.json();
}

const archives = await Promise.all(collectionIds.map(async collection => {
  const source = await load(collection);
  const items = source.hadiths.flatMap((item): HadithNarration[] => {
    const number = canonicalHadithNumber(collection, item.arabicnumber);
    const grade = narrationGrade(collection, item.reference.book, item.grades);
    if (!number || !grade || !item.text.trim()) return [];
    return [{ collection, number, text: item.text.trim(), grade, book: item.reference.book, inBook: item.reference.hadith }];
  });
  if (items.length < 100 || new Set(items.map(item => item.number)).size !== items.length) {
    throw new Error(`Invalid ${collection} edition with ${items.length} usable entries.`);
  }
  return { collection, items };
}));

const references = new Set(archives.flatMap(({ items }) => items.map(item => `${item.collection}:${item.number}`)));
const curatedReferences = [...curated.items, ...curated.character].map(item => `${item.collection}:${item.number}`);
const required = [...curatedReferences, ...curated.items.flatMap(item => item.alsoIn ? [item.alsoIn] : []), ...curated.riyad.map(item => item.original)];
for (const reference of required) {
  if (!references.has(reference)) throw new Error(`A curated narration is missing its offline edition: ${reference}`);
}

await mkdir(dir, { recursive: true });
await Promise.all(archives.map(({ collection, items }) => writeFile(
  new URL(`hadith-${collection}-v2.json.gz`, dir),
  gzipSync(JSON.stringify({ version: 2, source: editionUrl(collection), license: "Unlicense", items }), { level: 9 }),
)));
