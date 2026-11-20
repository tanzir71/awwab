import { parse, TYPE } from "@formatjs/icu-messageformat-parser";
import vocabulary from "../handovers/H2-languages-paths-arabic-help/data/glossary.json" with { type: "json" };

const { terms } = vocabulary;

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

export function validateLocaleMessages(sourceMessages, translations, { allowMissing = false } = {}) {
  const unknown = Object.keys(translations).filter(key => !Object.hasOwn(sourceMessages, key));
  if (unknown.length) throw new Error(`Unknown message keys: ${unknown.join(", ")}`);
  for (const [key, english] of Object.entries(sourceMessages)) {
    if (allowMissing && translations[key] == null) continue;
    try { checkMessage(english, translations[key], !key.startsWith("landing")); }
    catch (error) { throw new Error(`${key}: ${error.message}`); }
  }
}
