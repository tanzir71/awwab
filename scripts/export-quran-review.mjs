import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { splitUthmaniOpening } from "../src/lib/quranOpening.ts";
import { pronunciationReview } from "./pronunciation-review.mjs";
import { parseNumberedQuranMeanings, parseQuranEncMeanings } from "./quran-meaning-edition.mjs";
import { https, present } from "./translation-attribution.mjs";

const [manifestPath, output] = process.argv.slice(2);
if (process.argv.length !== 4) {
  throw new Error("Usage: node scripts/export-quran-review.mjs <candidate-manifest.json> <new-directory>");
}
const readJSON = path => JSON.parse(readFileSync(path, "utf8"));
const manifest = readJSON(manifestPath);
if (!Array.isArray(manifest) || !manifest.length) throw new Error("List at least one candidate edition.");
const { locales } = readJSON(new URL("../handovers/H2-languages-paths-arabic-help/data/locales.json", import.meta.url));
const dataRoot = new URL("../public/data/", import.meta.url);
const { chapters } = readJSON(new URL("quran-study-index-v1.json", dataRoot));
const quran = JSON.parse(gunzipSync(readFileSync(new URL("quran-study-v1.json.gz", dataRoot))));
const sourceDirectory = dirname(resolve(manifestPath));
const seen = new Set();

const candidates = manifest.map(({ locale, file, credit, source, terms, format = "numbered" }) => {
  const language = locales.find(item => item.code === locale);
  if (!language || seen.has(locale) || !present(file) || !present(credit) || !https(source) || !https(terms)) {
    throw new Error(`Candidate ${locale} needs a unique supported locale, file, translator credit, source and terms links.`);
  }
  if (format !== "quranenc-csv" && format !== "numbered") throw new Error(`Unknown Quran edition format ${format}.`);
  seen.add(locale);
  const bytes = readFileSync(resolve(sourceDirectory, file));
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const edition = format === "quranenc-csv" ? parseQuranEncMeanings(text) : parseNumberedQuranMeanings(text);
  if (format === "quranenc-csv" && edition.sourceNotice.match(/^# URL: (\S+)\r?$/m)?.[1] !== source) {
    throw new Error(`QuranEnc candidate ${locale} must use the edition URL printed in the source notice.`);
  }
  const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  return { language, credit: edition.sourceVersion ? `${credit} · QuranEnc ${edition.sourceVersion}` : credit,
    source, terms, sourceSha256, ...edition };
});

const directory = resolve(output);
mkdirSync(directory);
for (const candidate of candidates) {
  const { language, credit, source, terms, sourceSha256, sourceNotice, sourceVersion, verses, footnotes } = candidate;
  const groups = { edition: "Edition information" };
  const rows = [{
    id: "edition", variety: "quran", group: "edition", label: "Translator, source and permissions",
    expected: {}, recordings: [],
    fields: [
      { label: "Translator or institution", value: credit },
      { label: "Imported verses", value: String(Object.keys(verses).length) },
      ...(footnotes ? [{ label: "Verses with source footnotes", value: String(Object.keys(footnotes).length) }] : []),
      { label: "Source file SHA-256", value: sourceSha256 },
      { label: "Redistribution", value: "Confirmation pending" },
      ...(sourceNotice ? [{ label: "Source file notice", value: sourceNotice }] : []),
    ],
    sources: [{ title: "Edition download", url: source }, { title: "Source terms", url: terms }],
  }];
  for (const chapter of chapters) {
    const group = String(chapter.number);
    groups[group] = `${group} · ${chapter.title}`;
    for (const verse of quran.surahs[group]) {
      rows.push({
        id: verse.ref, variety: "quran", group, label: verse.ref,
        expected: { ar: splitUthmaniOpening(verse.uthmani, verse.ref).text, translation: verses[verse.ref], en: verse.english },
        ...(footnotes?.[verse.ref] && { fields: [{ label: "Source footnotes", value: footnotes[verse.ref], lang: language.code }] }),
        recordings: [], sources: [{ title: `Quran ${verse.ref}`, url: `https://quran.com/${verse.ref.replace(":", "/")}` }],
      });
    }
  }
  const target = resolve(directory, language.code);
  pronunciationReview().write(target, {
    title: `${language.english} Quran edition review`,
    reviewFormat: "awwab-quran-edition-review",
    filename: `awwab-quran-review-${language.code}.json`,
    instructions: "Compare the candidate meaning with the cited Arabic. Use the English edition for comparison. Record wording questions, omissions and attribution issues in Notes.",
    editionNotice: quran.notice,
    translation: { locale: language.code, dir: language.dir, credit },
    varieties: { quran: { label: language.native, assignment: "Review the meaning and check the edition’s permissions before publication." } },
    varietyLabel: "Edition", groupLabel: "Surah", groups,
  }, rows);
  const draft = { _status: "draft", locale: language.code, credit, source, license: null, licenseUrl: null,
    sourceSha256, sourceTerms: terms, sourceNotice, sourceVersion, verses, footnotes };
  writeFileSync(resolve(target, "edition.draft.json"), JSON.stringify(draft, null, 2) + "\n", { flag: "wx" });
}

const links = candidates.map(({ language }) => `<li><a href="./${language.code}/index.html">${language.english}</a></li>`).join("\n");
writeFileSync(resolve(directory, "index.html"), `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Awwab Quran edition review</title>
<main>
  <h1>Awwab Quran edition review</h1>
  <p>Choose an edition to compare its meaning, confirm attribution and export comments. Each edition opens offline.</p>
  <ul>${links}</ul>
  <p>These candidates are local review drafts. Confirm each edition’s redistribution terms and reviewer sign-off before publication.</p>
</main>
</html>
`, { flag: "wx" });
