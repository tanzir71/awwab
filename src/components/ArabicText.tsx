import { splitArabicWords, splitGraphemes, wordAnatomy } from "@/lib/wordAnatomy";
import { useUi } from "@/lib/uiState";

export interface WordDetail {
  transliteration?: string;
  gloss?: string;
  root?: string;
  anatomyWord?: string;
}

export function ArabicText({ text, citation, words, recall = "read", mushaf, compact = false, verse }: {
  text: string;
  citation?: string;
  words?: WordDetail[];
  recall?: "read" | "hint" | "hidden";
  mushaf?: "indopak" | "uthmani";
  compact?: boolean;
  verse?: string;
}) {
  const selectWord = useUi(state => state.selectWord);
  let wordIndex = 0;
  return (
    <span className={`arabic-text ${compact ? "arabic-compact" : ""}`} data-script={mushaf} dir="rtl" lang="ar">
      {text.split("\n").map((line, lineIndex) => (
        <span className="arabic-line" key={lineIndex}>
          {splitArabicWords(line).map(word => {
            const index = wordIndex++;
            const detail = words?.[index];
            const anatomyWord = detail?.anatomyWord || word;
            const transliteration = recall === "read" ? detail?.transliteration ?? wordAnatomy(anatomyWord, index > 0).syllables.map(syllable => syllable.tr).join("") : "";
            const shown = recall === "hidden" ? "···" : recall === "hint" ? `${splitGraphemes(word)[0]}···` : word;
            const screenReaderText = recall === "read" ? transliteration : `Reveal word ${index + 1}`;
            return (
              <button key={index} type="button" className="word-chip" data-recall={recall}
                onClick={() => selectWord({ word: anatomyWord, citation, connected: index > 0, verse, position: index + 1, ...detail })}>
                <span>{shown}</span>
                {recall === "read" && detail?.gloss && <small lang="en" dir="ltr">{detail.gloss}</small>}
                {screenReaderText && <span className="sr-only" lang="en" dir="ltr">{screenReaderText}</span>}
              </button>
            );
          })}
        </span>
      ))}
    </span>
  );
}
