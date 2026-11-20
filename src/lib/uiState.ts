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

export const useUi = create<{
  word?: WordSelection;
  wordPinned: boolean;
  toggleWordPin: () => void;
  selectWord: (word?: WordSelection) => void;
}>((set) => ({
  wordPinned: false,
  toggleWordPin: () => set(state => ({ wordPinned: !!state.word && !state.wordPinned })),
  selectWord: word => set(state => word && state.wordPinned ? state : { word, wordPinned: false }),
}));
