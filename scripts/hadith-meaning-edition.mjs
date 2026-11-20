import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { collectionIds, hadithArchiveVersion } from "../src/lib/hadith-catalogue.ts";
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
