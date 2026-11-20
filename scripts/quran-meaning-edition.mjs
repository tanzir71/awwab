import { readFileSync } from "node:fs";
import { checkTranslationAttribution, present } from "./translation-attribution.mjs";

const index = JSON.parse(readFileSync(new URL("../public/data/quran-study-index-v1.json", import.meta.url), "utf8"));
const references = index.chapters.flatMap(({ number, ayahs }) => Array.from({ length: ayahs }, (_, index) => `${number}:${index + 1}`));
export function checkQuranVerseCoverage(verses) {
  if (!verses || Object.keys(verses).length !== references.length || references.some(ref => !present(verses[ref]))) {
    throw new Error("A local Quran edition must contain one nonempty meaning for every canonical ayah reference.");
  }
}

export function parseNumberedQuranMeanings(text) {
  const verses = {};
  const notice = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    if (line.startsWith("#")) {
      notice.push(line);
      continue;
    }
    const match = /^([1-9]\d*)\|([1-9]\d*)\|(.*)$/u.exec(line);
    if (!match || !present(match[3])) throw new Error(`Expected a numbered Quran meaning on line ${index + 1}.`);
    const ref = `${match[1]}:${match[2]}`;
    if (Object.hasOwn(verses, ref)) throw new Error(`Duplicate Quran meaning at ${ref}.`);
    verses[ref] = match[3];
  }
  checkQuranVerseCoverage(verses);
  return { verses, sourceNotice: notice.join("\n") };
}

export function checkQuranMeaningEdition(edition, locale) {
  if (locale === "en") throw new Error("English Quran meanings are built in.");
  const attribution = checkTranslationAttribution(edition);
  const { verses } = edition;
  checkQuranVerseCoverage(verses);
  return { ...attribution, verses };
}
