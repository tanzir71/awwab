import content from "../../docs/content/fluency.json";
import glosses from "../../docs/content/word-bank-glosses.json";
import { normalizeWord } from "./wordAnatomy";
import { studySearchTerm } from "./study-copy";

export type Gloss = { en: string; bn: string };
export type RootWord = Gloss & { ar: string; tr: string; verse?: string; position?: number; modern?: boolean };
export type FluencyRoot = Gloss & { tr: string; family: RootWord[] };

export const fluencyRoots: Record<string, FluencyRoot> = content.roots;
export const fluencyPairs = content.pairs;
export const fluencySigns = content.signs;
export const fluencySentences = content.sentences;
export const wordGlosses: Record<string, Gloss & { tr?: string }> = glosses;

export function wordBankSearch(text: string) {
  const term = studySearchTerm(text);
  if (/\p{Script=Arabic}/u.test(term)) {
    return normalizeWord(term).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/\s+/g, "");
  }
  return term.normalize("NFD").replace(/(\p{Script=Latin})\p{M}+/gu, "$1").normalize("NFC");
}

export function matchingReadingWord(word: string, vocabulary: ReadonlySet<string>) {
  const key = wordBankSearch(word);
  return vocabulary.has(key) || key.startsWith("ال") && vocabulary.has(key.slice(2));
}
