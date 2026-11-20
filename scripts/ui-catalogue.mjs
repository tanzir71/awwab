import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { askPhraseMessages } from "../src/lib/umrah-phrase-messages.mjs";
import { landingCopyEntries } from "./landing-copy.mjs";
import { umrahStepMessages } from "../src/lib/umrah-step-messages.mjs";
import { speakLessonMessages } from "../src/lib/speak-lesson-messages.mjs";
import { grammarLessonMessages } from "../src/lib/grammar-lesson-messages.mjs";
import { fluencyLessonMessages, wordGlossMessages } from "../src/lib/fluency-messages.mjs";
import { studyGlossMessages } from "../src/lib/study-gloss-messages.mjs";
import { prayerSourceMessages } from "../src/lib/prayer-source-messages.mjs";
import { hifzVirtueMessages } from "../src/lib/essentialPassages.ts";
import { tajweedPointMessages } from "../src/lib/tajweed-point-messages.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const { terms: glossary } = JSON.parse(readFileSync(resolve(root, "handovers/H2-languages-paths-arabic-help/data/glossary.json"), "utf8"));
const sources = new Map();
const sourceName = path => relative(root, path).split("\\").join("/");

function readSource(path) {
  if (!sources.has(path)) {
    sources.set(path, ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true));
  }
  return sources.get(path);
}

function findObject(file, name) {
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(file) !== name) continue;
      let value = declaration.initializer;
      while (value && (ts.isSatisfiesExpression(value) || ts.isAsExpression(value) || ts.isParenthesizedExpression(value))) value = value.expression;
      if (value && ts.isObjectLiteralExpression(value)) return value;
      throw new Error(`${sourceName(file.fileName)} must define ${name} as a literal object`);
    }
  }
  throw new Error(`${name} is missing from ${sourceName(file.fileName)}`);
}

function nameOf(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  throw new Error(`Unsupported catalogue property: ${node.getText()}`);
}

function modesOf(value, file) {
  const read = node => {
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const binding = imported.get(node.expression.text);
      const declarationFile = binding ? readSource(binding.path) : file;
      const object = findObject(declarationFile, binding?.name ?? node.expression.text);
      const property = object.properties.find(entry => ts.isPropertyAssignment(entry) && nameOf(entry.name) === node.name.text);
      if (property && ts.isStringLiteralLike(property.initializer)) return property.initializer.text;
    }
    throw new Error(`Catalogue text must be a literal: ${node.getText()}`);
  };
  if (ts.isArrayLiteralExpression(value) && value.elements.length === 2) {
    return { adult: read(value.elements[0]), maktab: read(value.elements[1]) };
  }
  return read(value);
}

function* filesBelow(directory, suffixes) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) yield* filesBelow(path, suffixes);
    else if (entry.isFile() && suffixes.some(suffix => entry.name.endsWith(suffix))) yield path;
  }
}

const catalogue = readSource(resolve(root, "src/lib/copy.ts"));
const imported = new Map();
for (const statement of catalogue.statements) {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
  const names = statement.importClause?.namedBindings;
  if (!names || !ts.isNamedImports(names) || !statement.moduleSpecifier.text.startsWith(".")) continue;
  for (const binding of names.elements) {
    const path = resolve(dirname(catalogue.fileName), statement.moduleSpecifier.text + ".ts");
    imported.set(binding.name.text, { path, name: binding.propertyName?.text ?? binding.name.text });
  }
}

const messages = new Map();
function readMessages(file, object) {
  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property)) {
      const binding = imported.get(property.expression.getText(file));
      if (!binding) throw new Error(`Unknown catalogue spread: ${property.getText(file)}`);
      const child = readSource(binding.path);
      readMessages(child, findObject(child, binding.name));
      continue;
    }
    if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) {
      throw new Error(`Unsupported catalogue entry: ${property.getText(file)}`);
    }
    const key = nameOf(property.name);
    const translations = Object.fromEntries(property.initializer.properties.map(entry => {
      if (!ts.isPropertyAssignment(entry)) throw new Error(`${key} must define literal translations`);
      return [nameOf(entry.name), modesOf(entry.initializer, file)];
    }));
    if (!translations.en) throw new Error(`English source missing for ${key}`);
    const line = file.getLineAndCharacterOfPosition(property.getStart(file)).line + 1;
    messages.set(key, { ...translations, definition: { file: sourceName(file.fileName), line }, references: [] });
  }
}
readMessages(catalogue, findObject(catalogue, "messages"));

const phraseSource = "handovers/H2-languages-paths-arabic-help/data/umrah-phrases.json";
const phraseLines = new Map(readFileSync(resolve(root, phraseSource), "utf8").split("\n").flatMap((line, index) => {
  const id = line.match(/"id": "([^"]+)"/)?.[1];
  return id ? [[id, index + 1]] : [];
}));
for (const [key, translations] of Object.entries(askPhraseMessages)) {
  if (messages.has(key)) throw new Error(`Duplicate catalogue message: ${key}`);
  const line = phraseLines.get(key.slice(key.indexOf("-") + 1));
  messages.set(key, { ...translations, definition: { file: phraseSource, line }, references: [] });
}
for (const [key, entry] of landingCopyEntries()) {
  if (messages.has(key)) throw new Error(`Duplicate catalogue message: ${key}`);
  messages.set(key, entry);
}
for (const [key, translations] of Object.entries(umrahStepMessages)) {
  if (messages.has(key)) throw new Error(`Duplicate catalogue message: ${key}`);
  messages.set(key, { ...translations, definition: { file: "docs/content/umrah-steps.json" }, references: [] });
}
for (const [catalogue, ...files] of [
  [speakLessonMessages, "src/pages/Speak.tsx"],
  [grammarLessonMessages, "src/pages/Grammar.tsx"],
  [fluencyLessonMessages, "src/pages/Fluency.tsx", "src/components/FluencyCards.tsx", "src/pages/WordBank.tsx"],
  [wordGlossMessages, "src/pages/WordBank.tsx", "src/pages/ReadingPractice.tsx"],
  [studyGlossMessages, "src/pages/SalahWords.tsx", "src/pages/Surahs.tsx", "src/components/WordPanel.tsx", "src/pages/Print.tsx"],
  [prayerSourceMessages, "src/pages/Return.tsx", "src/components/PrayerGuideSupport.tsx"],
  [hifzVirtueMessages, "src/pages/Hifz.tsx"],
  [tajweedPointMessages, "src/pages/Tajweed.tsx"],
]) {
  for (const [key, entry] of Object.entries(catalogue)) {
    if (messages.has(key)) throw new Error(`Duplicate catalogue message: ${key}`);
    messages.set(key, { ...entry, references: files.map(file => ({ file })) });
  }
}

const entries = [...messages.entries()].sort(([left], [right]) => left.localeCompare(right, "en"));
const englishMessages = Object.fromEntries(entries.map(([key, { en }]) => [key, en]));
const fingerprint = createHash("sha256").update(JSON.stringify({ messages: englishMessages, glossary })).digest("hex");

export { entries, filesBelow, fingerprint, glossary, messages, readSource, root, sourceName };
