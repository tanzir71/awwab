import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = new URL("../public/data/", import.meta.url);
const local = process.env.AWWAB_CONTENT_DIR;
const base = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";
const collections = ["abudawud", "ibnmajah", "nasai", "tirmidhi"] as const;
const accepted = /^(?:sahih(?: hadith| - agreed upon| - bukhari and muslim| lighairihi)?|hasan(?: sahih| lighairihi)?)$/i;
const weak = /daif|munkar|mawdu|shadh|mursal|batil|maqtu|muquf/i;

interface RawHadith {
  hadithnumber: number;
  text: string;
  grades: { name: string; grade: string }[];
  reference: { book: number; hadith: number };
}

async function load(collection: string): Promise<{ hadiths: RawHadith[] }> {
  if (local) return JSON.parse(await readFile(join(local, `eng-${collection}.json`), "utf8"));
  const response = await fetch(`${base}/eng-${collection}.min.json`, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Hadith source ${collection} returned HTTP ${response.status}`);
  return response.json();
}

await mkdir(dir, { recursive: true });
await Promise.all(collections.map(async collection => {
  const source = await load(collection);
  const items = source.hadiths.flatMap(item => {
    if (!item.text.trim() || item.grades.some(grade => weak.test(grade.grade))) return [];
    const grade = item.grades.find(grade => accepted.test(grade.grade));
    return grade ? [{
      collection, number: item.hadithnumber, text: item.text, grade: grade.grade, grader: grade.name,
      book: item.reference.book, inBook: item.reference.hadith,
    }] : [];
  });
  if (items.length < 100) throw new Error(`Only ${items.length} usable entries for ${collection}`);
  await writeFile(new URL(`hadith-${collection}-v1.json`, dir), JSON.stringify({
    version: 1, source: `${base}/eng-${collection}.min.json`, license: "Unlicense", items,
  }));
}));
