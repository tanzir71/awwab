import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { canonicalHadithNumber, collectionIds, hadithArchiveVersion, hadithSource } from "../src/lib/hadith-catalogue.ts";
import { checkTranslationAttribution, present } from "./translation-attribution.mjs";

const archives = new Map();

function canonicalNarrations(collection) {
  if (!archives.has(collection)) {
    const archiveUrl = new URL(`../public/data/hadith-${collection}-v${hadithArchiveVersion}.json.gz`, import.meta.url);
    const { items } = JSON.parse(gunzipSync(readFileSync(archiveUrl)).toString("utf8"));
    archives.set(collection, new Map(items.map(item => [item.number, item])));
  }
  return archives.get(collection);
}

export function alignHadithTranslations(collection, rows) {
  if (!collectionIds.includes(collection)) throw new Error(`Unsupported Hadith collection: ${collection}`);
  if (!Array.isArray(rows)) throw new Error(`${collection} source must contain a hadiths array.`);
  const canonical = canonicalNarrations(collection);
  const matches = new Map();
  const ambiguous = new Set();
  const mismatches = [];
  let outsideArchive = 0;
  let missingText = 0;
  for (const row of rows) {
    const number = canonicalHadithNumber(collection, row?.arabicnumber);
    const original = canonical.get(number);
    if (!original) {
      outsideArchive++;
      continue;
    }
    const { book, hadith: inBook } = row.reference ?? {};
    if (book !== original.book || inBook !== original.inBook) {
      mismatches.push({ number, book, inBook, expectedBook: original.book, expectedInBook: original.inBook });
      continue;
    }
    if (!present(row.text)) {
      missingText++;
      continue;
    }
    if (ambiguous.has(number) || matches.has(number)) {
      matches.delete(number);
      ambiguous.add(number);
      continue;
    }
    matches.set(number, { book, inBook, text: row.text, original: {
      arabic: original.arabic, english: original.text, grade: original.grade,
      source: hadithSource(original),
    } });
  }
  return {
    narrations: Object.fromEntries(matches),
    alignment: { bundled: canonical.size, sourceRows: rows.length, matched: matches.size, outsideArchive, missingText,
      ambiguous: [...ambiguous], mismatches },
  };
}

export function checkHadithMeaningEditions(collections, locale) {
  if (locale === "en") throw new Error("English Hadith meanings are built in.");
  const editions = Object.entries(collections ?? {});
  if (!editions.length) throw new Error("Supply at least one reviewed Hadith collection.");
  return Object.fromEntries(editions.map(([collection, edition]) => {
    if (!collectionIds.includes(collection)) throw new Error(`Unsupported Hadith collection: ${collection}`);
    const attribution = checkTranslationAttribution(edition);
    const entries = Object.entries(edition.narrations ?? {});
    if (!entries.length) throw new Error(`${collection} has no translated narrations.`);
    const canonical = canonicalNarrations(collection);
    const narrations = Object.fromEntries(entries.map(([number, translation]) => {
      const original = canonical.get(number);
      if (!original || original.book !== translation?.book || original.inBook !== translation?.inBook || !present(translation?.text)) {
        throw new Error(`${collection}:${number} must match a bundled narration and its book and in-book number.`);
      }
      const { book, inBook, text } = translation;
      return [number, { book, inBook, text }];
    }));
    return [collection, { ...attribution, narrations }];
  }));
}
