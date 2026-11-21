import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
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

export function parseQuranEncMeanings(text) {
  const [notice, columns, ...rows] = parse(text, { bom: true, skip_empty_lines: true });
  const sourceNotice = notice?.[0];
  const sourceVersion = sourceNotice?.match(/^# Last update: [^\r\n]*\((v[\d.]+-csv\.\d+)\)\r?$/m)?.[1];
  if (!sourceVersion || notice.slice(1).some(Boolean) || columns?.join(",") !== "id,sura,aya,translation,footnotes") {
    throw new Error("Expected a QuranEnc CSV export with the original notice, version and column headings.");
  }
  const verses = {};
  const footnotes = {};
  for (const [index, [id, surah, ayah, meaning, note]] of rows.entries()) {
    const ref = `${surah}:${ayah}`;
    if (id !== String(index + 1) || !present(meaning)) throw new Error(`Invalid QuranEnc meaning at ${ref}.`);
    if (Object.hasOwn(verses, ref)) throw new Error(`Duplicate Quran meaning at ${ref}.`);
    verses[ref] = meaning;
    if (note) footnotes[ref] = note;
  }
  checkQuranVerseCoverage(verses);
  return { verses, footnotes, sourceNotice, sourceVersion };
}

export function checkQuranMeaningEdition(edition, locale) {
  if (locale === "en") throw new Error("English Quran meanings are built in.");
  const attribution = checkTranslationAttribution(edition);
  const { verses, footnotes, sourceNotice, sourceVersion } = edition;
  checkQuranVerseCoverage(verses);
  if (footnotes !== undefined && (!footnotes || typeof footnotes !== "object" || Array.isArray(footnotes) ||
    Object.entries(footnotes).some(([ref, note]) => !Object.hasOwn(verses, ref) || typeof note !== "string" || !note.length))) {
    throw new Error("Quran edition footnotes must contain text and match canonical ayah references.");
  }
  if (sourceVersion !== undefined && (!present(sourceVersion) || !present(sourceNotice) || !footnotes)) {
    throw new Error("A versioned QuranEnc edition needs its original notice and footnotes.");
  }
  return { ...attribution, verses, ...(footnotes && { footnotes }), ...(present(sourceNotice) && { sourceNotice }),
    ...(sourceVersion && { sourceVersion }) };
}
