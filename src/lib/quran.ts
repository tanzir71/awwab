import data from "../../public/data/quran-v1.json";
import { normalizeWord, splitArabicWords } from "./wordAnatomy";

export interface QuranVerse {
  ref: string;
  uthmani: string;
  indopak: string;
  english: string;
}

export const quranText: Record<string, QuranVerse[]> = data.surahs;

export function countKnownQuranWords(knownVerses: string[], knownVocabulary: string[]) {
  return new Set([
    ...quranText[1].filter(verse => knownVerses.includes(verse.ref)).flatMap(verse => splitArabicWords(verse.uthmani).map(normalizeWord)),
    ...knownVocabulary.map(item => item.replace(/^word:/, "")),
  ]).size;
}
