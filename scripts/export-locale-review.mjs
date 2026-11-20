import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const [output] = process.argv.slice(2);
if (!output || process.argv.length !== 3) {
  throw new Error("Usage: node scripts/export-locale-review.mjs <review-directory>");
}
const destination = resolve(output);
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

const entries = [...messages.entries()].sort(([left], [right]) => left.localeCompare(right, "en"));
const english = Object.fromEntries(entries.map(([key, { en, definition, references }]) => [key, { text: en, definition, references }]));
const fingerprint = createHash("sha256").update(JSON.stringify(Object.fromEntries(entries.map(([key, { en }]) => [key, en])))).digest("hex");
const { locales } = JSON.parse(readFileSync(resolve(root, "handovers/H2-languages-paths-arabic-help/data/locales.json"), "utf8"));
const tierOne = locales.filter(locale => locale.tier === 1);
const screenshots = [...filesBelow(resolve(root, "docs/qa"), [".png"])].map(sourceName).sort();
mkdirSync(destination, { recursive: true });
const filenames = ["source-ui.json", ...tierOne.map(({ code }) => `${code}.draft.json`)];
if (filenames.some(name => existsSync(resolve(destination, name)))) {
  throw new Error("Choose a fresh review directory to preserve any existing drafts.");
}
const write = (name, value) => writeFileSync(resolve(destination, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
write("source-ui.json", { language: "en", fingerprint, messages: english, screenshots });
for (const { code, native, english: name, dir } of tierOne) {
  write(`${code}.draft.json`, {
    _status: "draft",
    sourceFingerprint: fingerprint,
    locale: { code, native, name, dir },
    messages: Object.fromEntries(entries.map(([key, entry]) => [key, entry[code] ?? null])),
  });
}
console.log(`Exported ${entries.length} UI messages and ${screenshots.length} screenshots for ${tierOne.length} draft catalogues.`);
