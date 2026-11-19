import data from "../../public/data/quran-v1.json";

export interface QuranVerse {
  ref: string;
  uthmani: string;
  indopak: string;
  english: string;
}

export const quranText: Record<string, QuranVerse[]> = data.surahs;
