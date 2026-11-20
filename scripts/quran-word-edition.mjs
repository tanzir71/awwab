import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { splitUthmaniOpening } from "../src/lib/quranOpening.ts";
import { indopakSplitVerses } from "../src/lib/quranWordPositions.ts";
import { splitArabicWords } from "../src/lib/wordAnatomy.ts";
import { checkTranslationAttribution, present } from "./translation-attribution.mjs";

let positions;
function wordCounts() {
  if (positions) return positions;
  const bundled = new URL("../public/data/quran-study-v1.json.gz", import.meta.url);
  const { surahs } = JSON.parse(gunzipSync(readFileSync(bundled)).toString("utf8"));
  const counts = new Map();
  for (const verse of Object.values(surahs).flat()) {
    const uthmani = splitArabicWords(splitUthmaniOpening(verse.uthmani, verse.ref).text).length;
    const indopak = splitArabicWords(verse.indopak).length;
    if ((uthmani !== indopak) !== indopakSplitVerses.has(verse.ref)) {
      throw new Error(`Review the script alignment for ${verse.ref} before compiling word glosses.`);
    }
    counts.set(verse.ref, { uthmani, indopak });
  }
  return positions = counts;
}

function checkWords(words, script) {
  if (!words || typeof words !== "object" || Array.isArray(words)) {
    throw new Error(`Provide the ${script} glosses as an object keyed by surah:ayah:word.`);
  }
  const counts = wordCounts();
  for (const [location, text] of Object.entries(words)) {
    const match = /^([1-9]\d*:[1-9]\d*):([1-9]\d*)$/.exec(location);
    const count = match && counts.get(match[1])?.[script];
    if (!count || Number(match[2]) > count || !present(text) || (script === "indopak" && !indopakSplitVerses.has(match[1]))) {
      throw new Error(`Invalid ${script} word gloss at ${location}.`);
    }
  }
  return words;
}

export function checkQuranWordEdition(edition) {
  const attribution = checkTranslationAttribution(edition);
  const words = checkWords(edition.words, "uthmani");
  if (!Object.keys(words).length) throw new Error("A Quran word edition needs at least one reviewed gloss.");
  const indopak = edition.indopak === undefined ? undefined : checkWords(edition.indopak, "indopak");
  return { ...attribution, words, indopak };
}
