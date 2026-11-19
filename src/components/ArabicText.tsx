import React, { type ReactNode } from "react";
import { splitArabicPhrase, splitArabicWords, splitGraphemes, wordAnatomy } from "../lib/wordAnatomy";
import { useUi } from "../lib/uiState";
import { useCopy } from "../lib/copy";

type WordRecall = "read" | "hint" | "hidden";
type WordIndicator = { state: "known" | "learning" | "new"; label: string };

function WordChip({ children, recall, href, selected, indicator, annotation, onSelect }: {
  children: ReactNode;
  recall: WordRecall;
  href?: string;
  selected?: boolean;
  indicator?: WordIndicator;
  annotation?: WordDetail["annotation"];
  onSelect: () => void;
}) {
  if (href) return <a className="word-chip" href={href}>{children}</a>;
  return <button type="button" className="word-chip" data-recall={recall} data-learning={indicator?.state} aria-pressed={selected}
    data-annotation={annotation?.tone} aria-description={annotation?.label} onClick={onSelect}>{children}</button>;
}

export interface WordDetail {
  transliteration?: string;
  gloss?: string;
  displayText?: string;
  root?: string;
  anatomyWord?: string;
  annotation?: { tone: "accent" | "soft" | "tint" | "neutral"; label: string };
}

export function ArabicText({ text, citation, words, recall = "read", mushaf, compact = false, verse, positionOffset = 0, wordLink,
  selectedPosition, onWordSelected, showGlosses = true, indicators, preserveSeparators = false }: {
  text: string;
  citation?: string;
  words?: WordDetail[];
  recall?: WordRecall | ((position: number) => WordRecall);
  mushaf?: "indopak" | "uthmani";
  compact?: boolean;
  verse?: string;
  positionOffset?: number;
  wordLink?: (position: number) => string;
  selectedPosition?: number;
  onWordSelected?: (position: number) => boolean | void;
  showGlosses?: boolean;
  indicators?: WordIndicator[];
  preserveSeparators?: boolean;
}) {
  const selectWord = useUi(state => state.selectWord);
  const { language, t } = useCopy();
  let wordIndex = 0;
  return (
    <span className={`arabic-text ${compact ? "arabic-compact" : ""}`} data-script={mushaf} dir="rtl" lang="ar">
      {text.split("\n").map((line, lineIndex) => (
        <span className={preserveSeparators ? "arabic-line arabic-phrase-line" : "arabic-line"} key={lineIndex}>
          {(preserveSeparators ? splitArabicPhrase(line) : splitArabicWords(line).map(text => ({ text, word: true }))).map((part, partIndex) => {
            if (!part.word) return <React.Fragment key={partIndex}>{part.text}</React.Fragment>;
            const word = part.text;
            const index = wordIndex++;
            const position = positionOffset + index + 1;
            const chipRecall = typeof recall === "function" ? recall(position) : recall;
            const detail = words?.[index];
            const indicator = indicators?.[index];
            const anatomyWord = detail?.anatomyWord || word;
            const transliteration = chipRecall === "read" ? detail?.transliteration ?? wordAnatomy(anatomyWord, index > 0).syllables.map(syllable => syllable.tr).join("") : "";
            const shown = chipRecall === "hidden" ? "···" : chipRecall === "hint" ? `${splitGraphemes(word)[0]}···` : detail?.displayText ?? word;
            const screenReaderText = chipRecall === "read" ? transliteration : t("revealWord", { number: index + 1 });
            return (
              <WordChip key={partIndex} recall={chipRecall} href={wordLink?.(index + 1)} selected={selectedPosition === undefined ? undefined : selectedPosition === position} indicator={indicator} annotation={detail?.annotation}
                onSelect={() => {
                  if (onWordSelected?.(position) === false) return;
                  selectWord({ word: anatomyWord, citation, connected: index > 0, verse, position, ...detail });
                }}>
                <span>{shown}</span>
                {chipRecall === "read" && showGlosses && detail?.gloss && <small lang="en" dir="ltr">{detail.gloss}</small>}
                {indicator && <small className="word-indicator" lang={language} dir="auto">{indicator.label}</small>}
                {screenReaderText && <span className="sr-only" lang={chipRecall === "read" ? "en" : language} dir="ltr">{screenReaderText}</span>}
              </WordChip>
            );
          })}
        </span>
      ))}
    </span>
  );
}
