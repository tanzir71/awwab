import inventory from "../../handovers/H2-languages-paths-arabic-help/data/locales.json";
import glossary from "../../handovers/H2-languages-paths-arabic-help/data/glossary.json";

export const builtInLanguages = ["en", "bn"] as const;
export type AppLanguage = typeof builtInLanguages[number];
export type GlossaryTerm = keyof typeof glossary.terms;
export type WordChoices = Partial<Record<AppLanguage, Partial<Record<GlossaryTerm, string>>>>;
export const glossaryTerms = Object.keys(glossary.terms) as GlossaryTerm[];
export const textSizes = ["default", "large"] as const;

export const languages = [
  { code: "en", english: "English", native: "English", dir: "ltr", script: "Latn", countries: [], tier: 1 },
  ...inventory.locales,
];
export type LanguageItem = typeof languages[number];

export function isBuiltIn(code: string): code is AppLanguage {
  return builtInLanguages.some(language => language === code);
}

export function suggestedLanguage(preferences: readonly string[]) {
  for (const preference of preferences) {
    const parts = preference.toLowerCase().split("-");
    while (parts.length) {
      const requested = parts.join("-");
      const language = languages.find(item => item.code.toLowerCase() === requested);
      if (language) return language;
      parts.pop();
    }
  }
}

export function languageMatches(item: LanguageItem, query: string) {
  const simplify = (text: string) => text.toLocaleLowerCase().normalize("NFD").replace(/(\p{Script=Latin})\p{M}+/gu, "$1").normalize();
  const searchable = simplify([item.native, item.english, item.code, ...item.countries].join(" "));
  return simplify(query.trim()).split(/\s+/).every(value => searchable.includes(value));
}

export function glossaryOptions(language: AppLanguage, term: GlossaryTerm) {
  return glossary.terms[term][language];
}

export const salahVariants = Object.entries(glossary.terms.salah).filter(([code]) => code !== "en").map(([code, words]) => ({
  words, language: languages.find(item => item.code === code),
}));

export function glossaryValue(language: AppLanguage, term: GlossaryTerm, choices?: WordChoices) {
  const options = glossaryOptions(language, term);
  const saved = choices?.[language]?.[term];
  return options.includes(saved) ? saved : options[0];
}

const banglaSpellings = /সালাত|নামাজ|ওজু|অজু|যোহর|জোহর|এশা|ইশা|কাযা|কাজা|তাওবা|তওবা|রামাদান|রমজান/gu;
const termsBySpelling = new Map(glossaryTerms.flatMap(term => glossaryOptions("bn", term).map(option => [option, term] as const)));

export function applyGlossary(format: string, language: AppLanguage, choices?: WordChoices) {
  if (language !== "bn") return format;
  return format.replace(banglaSpellings, word => glossaryValue("bn", termsBySpelling.get(word), choices));
}

export function formatLocale({ language, nativeDigits }: { language: AppLanguage; nativeDigits?: boolean }) {
  return language === "bn" && nativeDigits === false ? "bn-u-nu-latn" : language;
}

export function showEnglishQuranMeaning(preferences: { language: AppLanguage; quranMeanings?: boolean; englishMeaning?: boolean }) {
  const localMeaning = preferences.language === "en" && preferences.quranMeanings !== false;
  return localMeaning || (preferences.englishMeaning ?? preferences.language === "bn");
}
