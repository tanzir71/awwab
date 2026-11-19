import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { canonicalHadithNumber, collectionIds, editionUrl, hadithArchiveVersion, narrationGrade, type HadithCollection, type HadithNarration } from "../src/lib/hadith-catalogue.ts";
import curated from "../docs/content/hadith-curated.json" with { type: "json" };

const dir = new URL("../public/data/", import.meta.url);
const local = process.env.AWWAB_CONTENT_DIR;

interface RawHadith {
  arabicnumber?: number | string;
  text: string;
  grades: { name: string; grade: string }[];
  reference: { book: number; hadith: number };
}

async function load(collection: HadithCollection, language: "eng" | "ara"): Promise<{ hadiths: RawHadith[] }> {
  if (local) return JSON.parse(await readFile(join(local, `${language}-${collection}.json`), "utf8"));
  const response = await fetch(editionUrl(collection, language), { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Hadith edition ${language}-${collection} returned HTTP ${response.status}`);
  return response.json();
}

const archives = await Promise.all(collectionIds.map(async collection => {
  const [source, arabicSource] = await Promise.all([load(collection, "eng"), load(collection, "ara")]);
  const editionKey = (item: RawHadith) => `${canonicalHadithNumber(collection, item.arabicnumber)}:${item.reference.book}:${item.reference.hadith}`;
  const arabic = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const item of arabicSource.hadiths) {
    const key = editionKey(item);
    const text = item.text.trim();
    if (!text) continue;
    if (arabic.has(key)) duplicates.add(key);
    else arabic.set(key, text);
  }
  const items = source.hadiths.flatMap((item): HadithNarration[] => {
    const number = canonicalHadithNumber(collection, item.arabicnumber);
    const grade = narrationGrade(collection, item.reference.book, item.grades);
    if (!number || !grade || !item.text.trim()) return [];
    const key = editionKey(item);
    const wording = duplicates.has(key) ? undefined : arabic.get(key);
    return [{ collection, number, text: item.text.trim(), grade, book: item.reference.book, inBook: item.reference.hadith,
      ...(wording ? { arabic: wording } : {}) }];
  });
  if (items.length < 100 || new Set(items.map(item => item.number)).size !== items.length) {
    throw new Error(`Invalid ${collection} edition with ${items.length} usable entries.`);
  }
  if (items.filter(item => item.arabic).length < items.length * .95) throw new Error(`Too few matching Arabic narrations in ${collection}.`);
  return { collection, items };
}));

const references = new Map(archives.flatMap(({ items }) => items.map(item => [`${item.collection}:${item.number}`, item] as const)));
const curatedReferences = [...curated.items, ...curated.character].map(item => `${item.collection}:${item.number}`);
const required = [...curatedReferences, ...curated.items.flatMap(item => item.alsoIn ? [item.alsoIn] : []), ...curated.riyad.map(item => item.original)];
for (const reference of required) {
  if (!references.get(reference)?.arabic) throw new Error(`A curated narration is missing its bilingual offline edition: ${reference}`);
}

await mkdir(dir, { recursive: true });
await Promise.all(archives.map(({ collection, items }) => writeFile(
  new URL(`hadith-${collection}-v${hadithArchiveVersion}.json.gz`, dir),
  gzipSync(JSON.stringify({ version: hadithArchiveVersion, source: editionUrl(collection), arabicSource: editionUrl(collection, "ara"), license: "Unlicense", items }), { level: 9 }),
)));
