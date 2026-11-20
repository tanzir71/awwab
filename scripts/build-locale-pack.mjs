import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";

const [sourcePath, reviewPath, output] = process.argv.slice(2);
if (!sourcePath || !reviewPath || !output || process.argv.length !== 5) {
  throw new Error("Usage: node scripts/build-locale-pack.mjs <source-ui.json> <reviewed-catalogue.json> <output-directory>");
}
const read = path => JSON.parse(readFileSync(path, "utf8"));
const source = read(sourcePath);
const review = read(reviewPath);
const { locales } = read(new URL("../handovers/H2-languages-paths-arabic-help/data/locales.json", import.meta.url));
const locale = locales.find(item => item.code === review.locale?.code);
if (!locale) throw new Error("The review must name a locale in the handover inventory.");

const names = Array.isArray(review.reviewers) ? review.reviewers.filter(name => typeof name === "string").map(name => name.trim()).filter(Boolean) : [];
if (review._status !== "reviewed" || new Set(names.map(name => name.toLowerCase())).size < (locale.tier === 1 ? 2 : 1)) {
  throw new Error("Supply a reviewed catalogue with the locale’s recorded native reviewer sign-off.");
}

const sourceMessages = Object.fromEntries(Object.entries(source.messages).map(([key, entry]) => [key, entry.text]));
const fingerprint = createHash("sha256").update(JSON.stringify(sourceMessages)).digest("hex");
if (source.language !== "en" || source.fingerprint !== fingerprint || review.sourceFingerprint !== fingerprint) {
  throw new Error("The translations must match the English source fingerprint from the same review export.");
}

function icuArguments(text) {
  const argumentsFound = new Set();
  function visit(elements) {
    for (const element of elements) {
      if (element.type === TYPE.literal || element.type === TYPE.pound) continue;
      const keys = element.options ? Object.keys(element.options).sort() : [];
      const choices = element.type === TYPE.plural ? keys.filter(key => key === "other" || key.startsWith("=")) : keys;
      argumentsFound.add(JSON.stringify([element.type, element.value, element.pluralType, element.offset, choices]));
      if (element.options) Object.values(element.options).forEach(({ value }) => visit(value));
      if (element.children) visit(element.children);
    }
  }
  visit(parse(text));
  return [...argumentsFound].sort().join("\n");
}

function checkMessage(english, translation) {
  if (typeof english !== "string") {
    if (!translation || typeof translation !== "object" || Object.keys(translation).length !== 2) {
      throw new Error("Provide both Adult and Maktab text.");
    }
    checkMessage(english.adult, translation.adult);
    checkMessage(english.maktab, translation.maktab);
    return;
  }
  if (typeof translation !== "string" || !translation.trim()) throw new Error("Translation is missing.");
  if (icuArguments(english) !== icuArguments(translation)) throw new Error("Keep the same ICU arguments and fixed choices.");
}

const translations = review.messages ?? {};
const unknown = Object.keys(translations).filter(key => !Object.hasOwn(sourceMessages, key));
if (unknown.length) throw new Error(`Unknown message keys: ${unknown.join(", ")}`);
for (const [key, english] of Object.entries(sourceMessages)) {
  try { checkMessage(english, translations[key]); }
  catch (error) { throw new Error(`${key}: ${error.message}`); }
}

const pack = { version: 1, locale: locale.code, dir: locale.dir, sourceFingerprint: fingerprint, messages: translations };
mkdirSync(output, { recursive: true });
const destination = resolve(output, `${locale.code}.json`);
writeFileSync(destination, JSON.stringify(pack) + "\n", { flag: "wx" });
console.log(`Compiled ${Object.keys(translations).length} reviewed messages to ${destination}`);
