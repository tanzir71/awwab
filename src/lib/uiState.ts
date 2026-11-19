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
}

export const useUi = create<{
  word?: WordSelection;
  selectWord: (word?: WordSelection) => void;
}>((set) => ({ selectWord: word => set({ word }) }));
