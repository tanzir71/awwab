import React, { type ReactNode } from "react";
import { splitArabicWords, splitGraphemes, wordAnatomy } from "../lib/wordAnatomy";
import { useUi } from "../lib/uiState";
import { useCopy } from "../lib/copy";

function WordChip({ children, recall, href, selected, onSelect }: {
  children: ReactNode;
  recall: "read" | "hint" | "hidden";
  href?: string;
  selected?: boolean;
  onSelect: () => void;
}) {
  if (href) return <a className="word-chip" href={href}>{children}</a>;
  return <button type="button" className="word-chip" data-recall={recall} aria-pressed={selected} onClick={onSelect}>{children}</button>;
}

export interface WordDetail {
  transliteration?: string;
  gloss?: string;
  root?: string;
  anatomyWord?: string;
}

export function ArabicText({ text, citation, words, recall = "read", mushaf, compact = false, verse, positionOffset = 0, wordLink,
  selectedPosition, onWordSelected, showGlosses = true }: {
  text: string;
  citation?: string;
  words?: WordDetail[];
  recall?: "read" | "hint" | "hidden";
  mushaf?: "indopak" | "uthmani";
  compact?: boolean;
  verse?: string;
  positionOffset?: number;
  wordLink?: (position: number) => string;
  selectedPosition?: number;
  onWordSelected?: (position: number) => void;
  showGlosses?: boolean;
}) {
  const selectWord = useUi(state => state.selectWord);
  const { language, t } = useCopy();
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
            const screenReaderText = recall === "read" ? transliteration : t("revealWord", { number: index + 1 });
            const position = positionOffset + index + 1;
            return (
              <WordChip key={index} recall={recall} href={wordLink?.(index + 1)} selected={selectedPosition === undefined ? undefined : selectedPosition === position}
                onSelect={() => {
                  onWordSelected?.(position);
                  selectWord({ word: anatomyWord, citation, connected: index > 0, verse, position, ...detail });
                }}>
                <span>{shown}</span>
                {recall === "read" && showGlosses && detail?.gloss && <small lang="en" dir="ltr">{detail.gloss}</small>}
                {screenReaderText && <span className="sr-only" lang={recall === "read" ? "en" : language} dir="ltr">{screenReaderText}</span>}
              </WordChip>
            );
          })}
        </span>
      ))}
    </span>
  );
}
