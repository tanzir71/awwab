import { create } from "zustand";
import type { WordGloss } from "./localePacks";

export interface WordSelection extends Partial<WordGloss> {
  word: string;
  citation?: string;
  transliteration?: string;
  root?: string;
  position?: number;
  script?: "uthmani" | "indopak";
  verse?: string;
  connected: boolean;
  automatic?: boolean;
  annotation?: { label: string; lessons?: { title: string; to: string }[] };
}

type WordActivation = { trigger: HTMLElement; keyboard: boolean };

export const useUi = create<{
  word?: WordSelection;
  wordActivation?: WordActivation;
  wordPinned: boolean;
  toggleWordPin: () => void;
  selectWord: (word?: WordSelection, activation?: WordActivation) => void;
}>((set) => ({
  wordPinned: false,
  toggleWordPin: () => set(state => ({ wordPinned: !!state.word && !state.wordPinned })),
  selectWord: (word, wordActivation) => set(state => word && state.wordPinned ? state : { word, wordActivation, wordPinned: false }),
}));
