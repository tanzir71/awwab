import data from "../../public/data/quran-v1.json";
import vocabulary from "../../docs/content/core-quran-words.json";

export interface QuranVerse {
  ref: string;
  uthmani: string;
  indopak: string;
  english: string;
}

export const quranText: Record<string, QuranVerse[]> = data.surahs;
export const quranMeaningSource = "https://tanzil.net/trans/en.pickthall";

export function formatQuranReference(reference: string, locale: string) {
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  return reference.replace(/\d+/g, part => number.format(Number(part)));
}

export const coreWordTotal = vocabulary.words.length;
export const coreWordCoverage = vocabulary.occurrences / vocabulary.corpusWords;
export const coreWordSource = vocabulary.sourceUrl;
export const fatihaMorphology: Record<string, { key: string; lemma?: string; root?: string }> = vocabulary.fatiha;
const coreWords = new Set(vocabulary.words);

export function knownCoreQuranWords(knownVerses: string[], knownVocabulary: string[]) {
  const verses = new Set(knownVerses);
  const keys = knownVocabulary.filter(key => coreWords.has(key));
  for (const [location, word] of Object.entries(fatihaMorphology)) {
    const verse = location.slice(0, location.lastIndexOf(":"));
    if (verses.has(verse) && coreWords.has(word.key)) keys.push(word.key);
  }
  return new Set(keys);
}

export function countKnownQuranWords(knownVerses: string[], knownVocabulary: string[]) {
  return knownCoreQuranWords(knownVerses, knownVocabulary).size;
}
