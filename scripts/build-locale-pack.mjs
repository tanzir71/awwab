import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { validateLocaleMessages } from "./locale-messages.mjs";
import { checkHadithMeaningEditions } from "./hadith-meaning-edition.mjs";
import { checkQuranMeaningEdition } from "./quran-meaning-edition.mjs";
import { checkQuranWordEdition } from "./quran-word-edition.mjs";

const { positionals, values } = parseArgs({ allowPositionals: true, options: { hadith: { type: "string" }, "quran-words": { type: "string" } } });
const [sourcePath, reviewPath, output, quranPath] = positionals;
if (!sourcePath || !reviewPath || !output || positionals.length > 4) {
  throw new Error("Usage: node scripts/build-locale-pack.mjs <source-ui.json> <reviewed-catalogue.json> <output-directory> [reviewed-quran-meanings.json] [--hadith reviewed-hadith-meanings.json] [--quran-words reviewed-quran-words.json]");
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

const translations = review.messages ?? {};
validateLocaleMessages(sourceMessages, translations);

let quran;
if (quranPath) {
  const edition = read(quranPath);
  if (edition?.locale !== locale.code || edition._status !== "reviewed") {
    throw new Error("Supply a reviewed Quran edition in the catalogue’s language.");
  }
  quran = checkQuranMeaningEdition(edition, locale.code);
}

let hadith;
if (values.hadith) {
  const edition = read(values.hadith);
  if (edition?.locale !== locale.code || edition._status !== "reviewed") {
    throw new Error("Supply reviewed Hadith editions in the catalogue’s language.");
  }
  hadith = checkHadithMeaningEditions(edition.collections, locale.code);
}

let quranWords;
if (values["quran-words"]) {
  const edition = read(values["quran-words"]);
  if (edition?.locale !== locale.code || edition._status !== "reviewed") {
    throw new Error("Supply a reviewed Quran word edition in the catalogue’s language.");
  }
  quranWords = checkQuranWordEdition(edition);
}

const pack = { version: 1, locale: locale.code, dir: locale.dir, sourceFingerprint: fingerprint, messages: translations, quran, quranWords, hadith };
mkdirSync(output, { recursive: true });
const destination = resolve(output, `${locale.code}.json`);
writeFileSync(destination, JSON.stringify(pack) + "\n", { flag: "wx" });
console.log(`Compiled ${Object.keys(translations).length} reviewed messages to ${destination}`);
