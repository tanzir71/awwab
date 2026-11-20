import { readFileSync } from "node:fs";

const index = JSON.parse(readFileSync(new URL("../public/data/quran-study-index-v1.json", import.meta.url), "utf8"));
const references = index.chapters.flatMap(({ number, ayahs }) => Array.from({ length: ayahs }, (_, index) => `${number}:${index + 1}`));
const present = value => typeof value === "string" && Boolean(value.trim());
const https = value => present(value) && URL.canParse(value) && new URL(value).protocol === "https:";

export function checkQuranMeaningEdition(edition, locale) {
  const { credit, source, license, licenseUrl, verses } = edition ?? {};
  if (locale === "en" || !present(credit) || !https(source) || !present(license) || !https(licenseUrl)) {
    throw new Error("A local Quran edition requires a translator credit, source URL, and redistribution terms.");
  }
  if (!verses || Object.keys(verses).length !== references.length || references.some(ref => !present(verses[ref]))) {
    throw new Error("A local Quran edition must contain one nonempty meaning for every canonical ayah reference.");
  }
  return { credit, source, license, licenseUrl, verses };
}
