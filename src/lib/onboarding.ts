import { defaults, db, getRecord, updateSettings, type Settings } from "./storageService";
import { methodNames, type PrayerMethod } from "./prayerServices";
import { quranText } from "./quran";
import alphabet from "../../docs/content/arabic-letters.json";
import onboarding from "../../docs/content/onboarding.json";
import localeInventory from "../../handovers/H2-languages-paths-arabic-help/data/locales.json";

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

export const placementAudio: Record<string, { path: string; pack?: string; generated?: boolean }> = onboarding.samples;

export const desktopPlacement: Placement[] = [
  placement[0], { ...placement[0], arabic: "م", audioRef: "placement:2" },
  { ...placement[2], arabic: "بِسْمِ ٱللَّهِ", audioRef: "1:1", chapter: 1, verse: 1 }, placement[2],
  placement[1], { ...placement[1], arabic: "بُ", audioRef: "placement:3" },
  placement[3], { ...placement[3], arabic: quranText[112][2].uthmani, audioRef: "112:3", chapter: 112, verse: 3 },
];

export function desktopPlacementPassed(answers: readonly string[]) {
  const pairs = [[0, 1], [4, 5], [2, 3], [6, 7]];
  const firstPractice = pairs.findIndex(pair => !pair.every(index => answers[index] === "easy"));
  return firstPractice === -1 ? pairs.length : firstPractice;
}

export function placementLesson(passed: number) {
  return placement[passed - 1]?.next ?? 1;
}

export function prayerSetupSuggestion(language: Settings["language"]): Pick<Settings, "method" | "school"> | undefined {
  const suggestion = localeInventory.locales.find(locale => locale.code === language)?.suggestedPrayerDefaults;
  if (!suggestion) return;
  const method = suggestion.method.replace(/ \([^)]*\)$/, "");
  const school = suggestion.asr === "hanafi" ? "hanafi" :
    ["shafii", "maliki/shafii Asr (standard shadow)"].includes(suggestion.asr) ? "shafi" : undefined;
  if (school && Object.prototype.hasOwnProperty.call(methodNames, method)) return { method: method as PrayerMethod, school };
}

export function completeOnboarding(mode: Settings["mode"], script: Settings["script"], passed: number,
  preferences: Partial<Pick<Settings, "spellStyle" | "city" | "method" | "school" | "prayerGuide">> = {}) {
  return db.transaction("rw", db.records, async () => {
    if ((await getRecord("settings", defaults)).onboarded) return;
    await db.records.put({ key: "qaida-current", value: placementLesson(passed) });
    await updateSettings({ onboarded: true, mode, script, spellStyle: mode === "maktab" ? "ampara-bn" : "en", ...preferences });
  });
}
