import { create } from "zustand";

export interface WordSelection {
  word: string;
  citation?: string;
  transliteration?: string;
  gloss?: string;
  root?: string;
  position?: number;
  verse?: string;
  connected: boolean;
  automatic?: boolean;
  annotation?: { label: string };
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
