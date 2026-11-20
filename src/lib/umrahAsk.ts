import source from "../../handovers/H2-languages-paths-arabic-help/data/umrah-phrases.json";
import replies from "../../handovers/H2-languages-paths-arabic-help/data/reply-words.json";
import type { TripState } from "./umrah";
import { askPhraseKey } from "./umrah-phrase-messages.mjs";

export const askCategories = ["directions", "phone", "transport", "food", "help", "hotel", "shopping", "polite"] as const;
export const askVarieties = ["saudi", "msa"] as const;
export const askVoices = ["male", "female"] as const;
export type AskVariety = typeof askVarieties[number];
export type AskVoice = typeof askVoices[number];
export type AskPhrase = typeof source.phrases[number];
export type CustomPhrase = { id: string; ar: string; meaning: string };
export const askHomePath = (desktop = false) => desktop ? "/umrah?view=phrases" : "/umrah/ask";
export const askPhrasePath = (id: string, desktop = false) =>
  desktop ? `${askHomePath(true)}#${id}` : `${askHomePath()}/phrase/${id}`;
export const askClipPath = (variety: AskVariety, voice: AskVoice, id: string) => `packs/phrases/${variety}/${voice}/${id}.opus`;
export const askDefaults = { variety: "saudi" as AskVariety, voice: "female" as AskVoice, speaker: "" as AskVoice | "", slow: false };
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
  madinah: { en: "Madinah", label: "umrahPrepMadinah", ar: "المدينة", tr: "al-Madīna" },
  jeddah: { en: "Jeddah", label: "askPlaceJeddah", ar: "جدة", tr: "Jidda" },
  airport: { en: "the airport", label: "askPlaceAirport", ar: "المطار", tr: "al-maṭār" },
  hotel: { en: "the hotel", label: "askPlaceHotel", ar: "الفندق", tr: "al-funduq" },
};
export const askRelations = {
  mother: { en: "mother", label: "askRoleMother", ar: "أمي", tr: "ummi", female: true },
  father: { en: "father", label: "askRoleFather", ar: "أبوي", tr: "abūy", female: false },
  son: { en: "son", label: "askRoleSon", ar: "ولدي", tr: "waladi", female: false },
  daughter: { en: "daughter", label: "askRoleDaughter", ar: "بنتي", tr: "binti", female: true },
  wife: { en: "wife", label: "askRoleWife", ar: "زوجتي", tr: "zōjti", female: true },
  husband: { en: "husband", label: "askRoleHusband", ar: "زوجي", tr: "zōji", female: false },
};

type AskSlots = { gate?: number; place?: keyof typeof askPlaces; relation?: keyof typeof askRelations };
type AskGender = { speaker?: AskVoice | ""; toFemale?: boolean };
type Translate = (key: string, values?: Record<string, string | number>) => string;

export function askGenderVariant(phrase: AskPhrase, variety: AskVariety, options: AskGender) {
  const toWoman = options.toFemale && phrase.gender?.toFemale?.[variety];
  if (toWoman) return { text: toWoman, suffix: "to-woman" };
  const femaleSpeaker = options.speaker === "female" && phrase.gender?.speakerFemale?.[variety];
  if (femaleSpeaker) return { text: femaleSpeaker, suffix: "speaker-female" };
}

export function askMeaning(phrase: AskPhrase, t: Translate, { gate = 79, place = "madinah", relation = "mother" }: AskSlots = {}) {
  return t(askPhraseKey(phrase.id), { n: gate, place: t(askPlaces[place].label), relation: t(askRelations[relation].label) });
}

export function askPhraseMatches(phrase: AskPhrase, needle: string, meaning: string) {
  return [meaning, phrase.en, phrase.bn, phrase.saudi.ar, phrase.msa.ar, phrase.saudi.tr, phrase.msa.tr]
    .some(value => value.normalize().toLowerCase().includes(needle));
}

export function renderAsk(phrase: AskPhrase, variety: AskVariety, options: AskSlots & AskGender = {}) {
  const gate = options.gate ?? 79;
  const place = askPlaces[options.place] ?? askPlaces.madinah;
  const relation = askRelations[options.relation] ?? askRelations.mother;
  const gender = askGenderVariant(phrase, variety, options)?.text;
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
