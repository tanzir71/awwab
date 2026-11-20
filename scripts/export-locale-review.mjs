import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { entries, filesBelow, fingerprint, glossary, messages, readSource, root, sourceName } from "./ui-catalogue.mjs";

const [output] = process.argv.slice(2);
if (!output || process.argv.length !== 3) {
  throw new Error("Usage: node scripts/export-locale-review.mjs <review-directory>");
}
const destination = resolve(output);

for (const path of filesBelow(resolve(root, "src"), [".ts", ".tsx"])) {
  if (path.endsWith(".test.ts")) continue;
  const file = readSource(path);
  const name = sourceName(path);
  function visit(node) {
    if (ts.isStringLiteralLike(node) && messages.has(node.text)) {
      const entry = messages.get(node.text);
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      if (entry.definition.file !== name || entry.definition.line !== line) entry.references.push({ file: name, line });
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}

const english = Object.fromEntries(entries.map(([key, { en, definition, references }]) => [key, { text: en, definition, references }]));
const { locales } = JSON.parse(readFileSync(resolve(root, "handovers/H2-languages-paths-arabic-help/data/locales.json"), "utf8"));
const glossaryFor = code => Object.fromEntries(Object.entries(glossary).map(([term, translations]) => [`term_${term}`, translations[code] ?? translations.en]));
const tierOne = locales.filter(locale => locale.tier === 1);
const screenshots = [...filesBelow(resolve(root, "docs/qa"), [".png"])].map(sourceName).sort();

function supplementalDraft(code) {
  const path = resolve(root, "handovers/H2-languages-paths-arabic-help/drafts", `${code}.json`);
  const additions = new Map();
  if (!existsSync(path)) return additions;
  const draft = JSON.parse(readFileSync(path, "utf8"));
  if (draft._status !== "draft" || draft.locale !== code) throw new Error(`Expected a supplemental draft for ${code}.`);
  const hasText = value => typeof value === "string" && value.trim().length > 0;
  for (const [key, { source, text }] of Object.entries(draft.messages)) {
    const entry = messages.get(key);
    if (entry?.[code] !== undefined) continue;
    if (!entry || !isDeepStrictEqual(entry.en, source)) {
      console.warn(`Skipped the ${code} draft for ${key} because its English source changed.`);
      continue;
    }
    const valid = typeof source === "string" ? hasText(text) :
      text && Object.keys(text).length === 2 && hasText(text.adult) && hasText(text.maktab);
    if (!valid) throw new Error(`Expected a draft translation for each source variant of ${key} in ${code}.`);
    additions.set(key, text);
  }
  return additions;
}

const drafts = new Map(tierOne.map(({ code }) => [code, supplementalDraft(code)]));
mkdirSync(destination, { recursive: true });
const filenames = ["source-ui.json", ...tierOne.map(({ code }) => `${code}.draft.json`)];
if (filenames.some(name => existsSync(resolve(destination, name)))) {
  throw new Error("Choose a fresh review directory to preserve any existing drafts.");
}
const write = (name, value) => writeFileSync(resolve(destination, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
write("source-ui.json", { language: "en", fingerprint, messages: english, glossary: glossaryFor("en"), screenshots });
for (const { code, native, english: name, dir } of tierOne) {
  const additions = drafts.get(code);
  write(`${code}.draft.json`, {
    _status: "draft",
    sourceFingerprint: fingerprint,
    locale: { code, native, name, dir },
    glossary: glossaryFor(code),
    ...(additions.size ? { supplementalDraftKeys: [...additions.keys()] } : {}),
    messages: Object.fromEntries(entries.map(([key, entry]) => [key, entry[code] ?? additions.get(key) ?? null])),
  });
}
console.log(`Exported ${entries.length} UI messages and ${screenshots.length} screenshots for ${tierOne.length} draft catalogues.`);
