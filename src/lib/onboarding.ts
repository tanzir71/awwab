import { defaults, db, getRecord, updateSettings, type Settings } from "./storageService";
import { quranText } from "./quran";
import alphabet from "../../docs/content/arabic-letters.json";
import onboarding from "../../docs/content/onboarding.json";

type Placement = {
  title: string;
  audioRef: string;
  arabic: string;
  next: number;
  chapter?: number;
  verse?: number;
};

export const placement: Placement[] = [
  { title: "letters", arabic: alphabet.letters[18].letter, audioRef: "placement:0", next: 2 },
  { title: "harakat", arabic: "بِ", audioRef: "placement:1", next: 5 },
  { title: "words", arabic: quranText[112][0].uthmani, audioRef: "112:1", next: 6, chapter: 112, verse: 1 },
  { title: "ayah", arabic: quranText[103][1].uthmani, audioRef: "103:2", next: 7, chapter: 103, verse: 2 },
];

export const placementAudio: Record<string, { path: string; pack: string }> = onboarding.samples;

export function placementLesson(passed: number) {
  return placement[passed - 1]?.next ?? 1;
}

export function completeOnboarding(mode: Settings["mode"], script: Settings["script"], passed: number) {
  return db.transaction("rw", db.records, async () => {
    if ((await getRecord("settings", defaults)).onboarded) return;
    await db.records.put({ key: "qaida-current", value: placementLesson(passed) });
    await updateSettings({ onboarded: true, mode, script, spellStyle: mode === "maktab" ? "ampara-bn" : "en" });
  });
}
