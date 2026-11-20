import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";
import { checkQuranMeaningEdition } from "./quran-meaning-edition.mjs";

const [sourcePath, reviewPath, output, quranPath] = process.argv.slice(2);
if (!sourcePath || !reviewPath || !output || process.argv.length > 6) {
  throw new Error("Usage: node scripts/build-locale-pack.mjs <source-ui.json> <reviewed-catalogue.json> <output-directory> [reviewed-quran-meanings.json]");
}
const read = path => JSON.parse(readFileSync(path, "utf8"));
const source = read(sourcePath);
const review = read(reviewPath);
const { locales } = read(new URL("../handovers/H2-languages-paths-arabic-help/data/locales.json", import.meta.url));
const { terms } = read(new URL("../handovers/H2-languages-paths-arabic-help/data/glossary.json", import.meta.url));
const locale = locales.find(item => item.code === review.locale?.code);
if (!locale) throw new Error("The review must name a locale in the handover inventory.");

const names = Array.isArray(review.reviewers) ? review.reviewers.filter(name => typeof name === "string").map(name => name.trim()).filter(Boolean) : [];
if (review._status !== "reviewed" || new Set(names.map(name => name.toLowerCase())).size < (locale.tier === 1 ? 2 : 1)) {
  throw new Error("Supply a reviewed catalogue with the locale’s recorded native reviewer sign-off.");
}

const sourceMessages = Object.fromEntries(Object.entries(source.messages).map(([key, entry]) => [key, entry.text]));
const fingerprint = createHash("sha256").update(JSON.stringify({ messages: sourceMessages, glossary: terms })).digest("hex");
if (source.language !== "en" || source.fingerprint !== fingerprint || review.sourceFingerprint !== fingerprint) {
  throw new Error("The translations must match the message and glossary fingerprint from the same review export.");
}

function icuContract(text, allowGlossary) {
  const argumentsFound = new Set();
  const required = new Set();
  const fixed = new Set();
  function visit(elements, pluralArgument) {
    for (const element of elements) {
      if (element.type === TYPE.literal) continue;
      if (element.type === TYPE.pound) {
        required.add(pluralArgument);
        continue;
      }
      if (element.value.startsWith("term_") &&
        (!allowGlossary || element.type !== TYPE.argument || !Object.hasOwn(terms, element.value.slice(5)))) {
        throw new Error("Use only documented glossary terms as plain arguments in app copy.");
      }
      const isPlural = element.type === TYPE.plural;
      argumentsFound.add(element.value);
      if (!isPlural) required.add(element.value);
      const keys = element.options ? Object.keys(element.options).sort() : [];
      const exactCounts = keys.filter(key => key.startsWith("="));
      if (isPlural && (exactCounts.length || element.offset)) {
        fixed.add(JSON.stringify(["plural-count", element.value, element.offset, exactCounts]));
      } else if (element.type === TYPE.select || element.type === TYPE.tag) {
        fixed.add(JSON.stringify([element.type, element.value, keys]));
      }
      if (element.options) {
        Object.values(element.options).forEach(({ value }) => visit(value, isPlural ? element.value : pluralArgument));
      }
      if (element.children) visit(element.children, pluralArgument);
    }
  }
  visit(parse(text));
  return { argumentsFound, required, fixed };
}

function checkMessage(english, translation, allowGlossary) {
  if (typeof english !== "string") {
    if (!translation || typeof translation !== "object" || Object.keys(translation).length !== 2) {
      throw new Error("Provide both Adult and Maktab text.");
    }
    checkMessage(english.adult, translation.adult, allowGlossary);
    checkMessage(english.maktab, translation.maktab, allowGlossary);
    return;
  }
  if (typeof translation !== "string" || !translation.trim()) throw new Error("Translation is missing.");
  const source = icuContract(english, allowGlossary);
  const target = icuContract(translation, allowGlossary);
  if ([...target.argumentsFound].some(argument => !source.argumentsFound.has(argument) && !argument.startsWith("term_"))
    || [...source.required].some(argument => !target.required.has(argument))
    || source.fixed.size !== target.fixed.size
    || [...source.fixed].some(choice => !target.fixed.has(choice))) {
    throw new Error("Keep the required ICU arguments and fixed choices.");
  }
}

const translations = review.messages ?? {};
const unknown = Object.keys(translations).filter(key => !Object.hasOwn(sourceMessages, key));
if (unknown.length) throw new Error(`Unknown message keys: ${unknown.join(", ")}`);
for (const [key, english] of Object.entries(sourceMessages)) {
  try { checkMessage(english, translations[key], !key.startsWith("landing")); }
  catch (error) { throw new Error(`${key}: ${error.message}`); }
}

let quran;
if (quranPath) {
  const edition = read(quranPath);
  if (edition?.locale !== locale.code || edition._status !== "reviewed") {
    throw new Error("Supply a reviewed Quran edition in the catalogue’s language.");
  }
  quran = checkQuranMeaningEdition(edition, locale.code);
}

const pack = { version: 1, locale: locale.code, dir: locale.dir, sourceFingerprint: fingerprint, messages: translations, quran };
mkdirSync(output, { recursive: true });
const destination = resolve(output, `${locale.code}.json`);
writeFileSync(destination, JSON.stringify(pack) + "\n", { flag: "wx" });
console.log(`Compiled ${Object.keys(translations).length} reviewed messages to ${destination}`);
