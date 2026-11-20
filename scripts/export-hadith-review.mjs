import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { hadithArchiveVersion } from "../src/lib/hadith-catalogue.ts";
import { alignHadithTranslations } from "./hadith-meaning-edition.mjs";

const [manifestPath, outputPath] = process.argv.slice(2);
if (!manifestPath || !outputPath || process.argv.length !== 4) {
  throw new Error("Usage: node scripts/export-hadith-review.mjs <source-manifest.json> <draft-output.json>");
}
const read = path => JSON.parse(readFileSync(path, "utf8"));
const manifest = read(manifestPath);
const { locales } = read(new URL("../handovers/H2-languages-paths-arabic-help/data/locales.json", import.meta.url));
if (manifest.locale === "en" || !locales.some(item => item.code === manifest.locale)) {
  throw new Error("Supply a non-English locale from the handover inventory.");
}
const entries = Object.entries(manifest.collections ?? {});
if (!entries.length) throw new Error("Supply at least one candidate collection.");

const collections = {};
const alignment = {};
for (const [collection, { file, credit = null, source, license = null, licenseUrl = null }] of entries) {
  const bytes = readFileSync(resolve(dirname(manifestPath), file));
  const { narrations, alignment: checked } = alignHadithTranslations(collection, JSON.parse(bytes.toString("utf8")).hadiths);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  alignment[collection] = { source, sha256, ...checked };
  if (checked.matched) collections[collection] = { credit, source, license, licenseUrl, narrations };
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify({ _status: "draft", locale: manifest.locale, archiveVersion: hadithArchiveVersion, collections, alignment }, null, 2) + "\n", { flag: "wx" });
console.log(`${manifest.locale}: ${Object.values(alignment).reduce((sum, item) => sum + item.matched, 0)} narrations aligned for review`);
