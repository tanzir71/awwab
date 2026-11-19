import source from "../../handovers/H2-languages-paths-arabic-help/data/umrah-phrases.json";
import replies from "../../handovers/H2-languages-paths-arabic-help/data/reply-words.json";
import type { TripState } from "./umrah";

export const askCategories = ["directions", "phone", "transport", "food", "help", "hotel", "shopping", "polite"] as const;
export const askVarieties = ["saudi", "msa"] as const;
export const askVoices = ["male", "female"] as const;
export type AskVariety = typeof askVarieties[number];
export type AskVoice = typeof askVoices[number];
export type AskPhrase = typeof source.phrases[number];
export type CustomPhrase = { id: string; ar: string; meaning: string };
export const askDefaults = { variety: "saudi" as AskVariety, voice: "male" as AskVoice, speaker: "" as AskVoice | "", slow: false };
export const umrahPhrases = source.phrases;
export const askPhrase = (id: string) => umrahPhrases.find(phrase => phrase.id === id);
export const answerWords = ["right", "left", "straight on", "upstairs", "downstairs", "near", "far", "behind"].map(en => replies.words.find(word => word.en === en));
export const helperDirections = ["right", "straight on", "left", "upstairs", "downstairs"].map(en => replies.words.find(word => word.en === en));
export const arabicNumber = new Intl.NumberFormat("ar-u-nu-arab", { useGrouping: false });

const contexts: Record<TripState, string> = {
  "At the hotel": "hotel", Walking: "walking", "In the Haram": "haram", "Doing Umrah": "umrah", Resting: "resting", "Eating out": "eating",
};
const quickOrder: Record<string, string[]> = {
  haram: ["toilet", "wudu", "zamzam", "women-prayer", "gate-number"],
  hotel: ["wifi", "key-broken", "checkout", "fare-haram", "to-haram"],
  eating: ["water", "not-spicy", "bill", "allergy-nuts", "toilet"],
  umrah: ["masa", "mataf", "wheelchair", "wudu", "zamzam"],
  walking: ["gate-number", "taxi-stand", "nearest-mosque", "toilet", "show-map"],
  resting: ["water", "charge-phone", "nearest-mosque", "pharmacy", "need-doctor"],
};

export function quickAsks(state: TripState) {
  const context = contexts[state];
  const available = new Set(umrahPhrases.filter(phrase => phrase.contexts.includes(context) || phrase.contexts.includes("any")).map(phrase => phrase.id));
  return [...quickOrder[context].filter(id => available.has(id)), "lost"].map(askPhrase);
}

export function readGate(value: string | null) {
  const digits = (value ?? "").trim().replace(/[٠-٩۰-۹০-৯]/g, digit => String("٠١٢٣٤٥٦٧٨٩".includes(digit) ? digit.charCodeAt(0) - 0x660
    : "۰۱۲۳۴۵۶۷۸۹".includes(digit) ? digit.charCodeAt(0) - 0x6f0 : digit.charCodeAt(0) - 0x9e6));
  const number = Number(digits);
  return /^\d{1,3}$/.test(digits) && number >= 1 && number <= 300 ? number : undefined;
}

export const askPlaces = {
  madinah: { en: "Madinah", bn: "মদিনা", ar: "المدينة", tr: "al-Madīna" },
  jeddah: { en: "Jeddah", bn: "জেদ্দা", ar: "جدة", tr: "Jidda" },
  airport: { en: "the airport", bn: "বিমানবন্দর", ar: "المطار", tr: "al-maṭār" },
  hotel: { en: "the hotel", bn: "হোটেল", ar: "الفندق", tr: "al-funduq" },
};
export const askRelations = {
  mother: { en: "mother", bn: "মা", ar: "أمي", tr: "ummi", female: true },
  father: { en: "father", bn: "বাবা", ar: "أبوي", tr: "abūy", female: false },
  son: { en: "son", bn: "ছেলে", ar: "ولدي", tr: "waladi", female: false },
  daughter: { en: "daughter", bn: "মেয়ে", ar: "بنتي", tr: "binti", female: true },
  wife: { en: "wife", bn: "স্ত্রী", ar: "زوجتي", tr: "zōjti", female: true },
  husband: { en: "husband", bn: "স্বামী", ar: "زوجي", tr: "zōji", female: false },
};

export function renderAsk(phrase: AskPhrase, variety: AskVariety, options: {
  gate?: number; place?: keyof typeof askPlaces; relation?: keyof typeof askRelations; speaker?: AskVoice | ""; toFemale?: boolean;
} = {}) {
  const gate = options.gate ?? 79;
  const place = askPlaces[options.place] ?? askPlaces.madinah;
  const relation = askRelations[options.relation] ?? askRelations.mother;
  const gender = options.toFemale ? phrase.gender?.toFemale?.[variety] : options.speaker === "female" ? phrase.gender?.speakerFemale?.[variety] : undefined;
  const slot = (text: string, lang: "en" | "ar" | "tr") => text.replace("{n}", lang === "ar" ? arabicNumber.format(gate) : String(gate))
    .replace("{place}", place[lang]).replace("{relation}", relation[lang]);
  let ar = gender?.[0] ?? phrase[variety].ar;
  let tr = gender?.[1] ?? phrase[variety].tr;
  if (phrase.id === "lost-family" && variety === "saudi" && relation.female) {
    ar = ar.replace("ضاع", "ضاعت");
    tr = tr.replace("ḍāʿ", "ḍāʿat");
  }
  return { ar: slot(ar, "ar"), tr: slot(tr, "tr"), en: slot(phrase.en, "en") };
}
