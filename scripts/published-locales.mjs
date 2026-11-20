import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { entries, fingerprint, root } from "./ui-catalogue.mjs";
import { localeFonts, localeReadingFont } from "./locale-fonts.mjs";
import { checkHadithMeaningEditions } from "./hadith-meaning-edition.mjs";
import { checkQuranMeaningEdition } from "./quran-meaning-edition.mjs";
import { checkQuranWordEdition } from "./quran-word-edition.mjs";

export function localePackAsset(bytes, locale) {
  return {
    bytes: bytes.length, digest: createHash("sha256").update(bytes).digest("hex"),
    fonts: localeFonts(locale.script), readingFont: localeReadingFont(locale.code),
  };
}

export function publishedLocales() {
  const directory = resolve(root, "public/locales");
  if (!existsSync(directory)) return {};

  const { locales } = JSON.parse(readFileSync(resolve(root, "handovers/H2-languages-paths-arabic-help/data/locales.json"), "utf8"));
  const published = [];
  for (const file of readdirSync(directory).filter(name => name.endsWith(".json")).sort()) {
    const locale = locales.find(item => `${item.code}.json` === file);
    const bytes = readFileSync(resolve(directory, file));
    const pack = JSON.parse(bytes.toString("utf8"));
    if (pack.reviewOnly) throw new Error(`${file} is a draft preview pack. Remove it from public/locales before building.`);
    if (!locale || pack.version !== 1 || pack.locale !== locale.code || pack.dir !== locale.dir || pack.sourceFingerprint !== fingerprint
      || Object.keys(pack.messages ?? {}).length !== entries.length || entries.some(([key]) => !Object.hasOwn(pack.messages, key))) {
      throw new Error(`${file} does not match the current UI catalogue. Compile the matching reviewed locale before publishing it.`);
    }
    if (pack.quran !== undefined) checkQuranMeaningEdition(pack.quran, locale.code);
    if (pack.quranWords !== undefined) checkQuranWordEdition(pack.quranWords);
    if (pack.hadith !== undefined) checkHadithMeaningEditions(pack.hadith, locale.code);
    published.push([locale.code, localePackAsset(bytes, locale)]);
  }
  return Object.fromEntries(published);
}
