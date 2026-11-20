import { readFileSync } from "node:fs";
import { checkTranslationAttribution, present } from "./translation-attribution.mjs";

const index = JSON.parse(readFileSync(new URL("../public/data/quran-study-index-v1.json", import.meta.url), "utf8"));
const references = index.chapters.flatMap(({ number, ayahs }) => Array.from({ length: ayahs }, (_, index) => `${number}:${index + 1}`));
export function checkQuranMeaningEdition(edition, locale) {
  if (locale === "en") throw new Error("English Quran meanings are built in.");
  const attribution = checkTranslationAttribution(edition);
  const { verses } = edition;
  if (!verses || Object.keys(verses).length !== references.length || references.some(ref => !present(verses[ref]))) {
    throw new Error("A local Quran edition must contain one nonempty meaning for every canonical ayah reference.");
  }
  return { ...attribution, verses };
}
