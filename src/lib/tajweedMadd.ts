const plainVowel = /[ًٌٍَُِّ]/u;
const longMark = /[ٓ࢜]/u;
const sukun = /[ْۡ]/u;
const silentLetter = /[۟۠]/u;
const alifCarrier = /^[اىیي]/u;
const extraHamzah = /[ٕٔ]/u;

function hasHamzah(glyph: string) {
  return /^[ءأإآؤئ]/u.test(glyph) || (/^[اوىیي]/u.test(glyph) && extraHamzah.test(glyph)) ||
    (glyph.startsWith("ا") && /[َُِ]/u.test(glyph));
}

function hasMaddVowel(letters: string[], index: number) {
  const glyph = letters[index] ?? "";
  const previous = letters[index - 1] ?? "";
  const next = letters[index + 1] ?? "";
  if (silentLetter.test(glyph)) return false;
  // IndoPak can print the dagger alif on the letter before its carrier.
  if (glyph.includes("ٰ") && !glyph.startsWith("ا") && !(alifCarrier.test(next) && !plainVowel.test(next))) return true;
  if (!glyph || plainVowel.test(glyph) || extraHamzah.test(glyph)) return false;
  if (/^[اآ]/u.test(glyph)) return previous.includes("َ");
  if (glyph.startsWith("و")) return previous.includes("ُ");
  if (/^[يىی]/u.test(glyph)) return /[ِٰ]/u.test(previous);
  return false;
}

function lengthened(glyph: string) {
  return glyph.startsWith("آ") || longMark.test(glyph);
}

function terminalIndex(letters: string[]) {
  const index = letters.length - 1;
  const final = letters[index] ?? "";
  const previous = letters[index - 1] ?? "";
  // The last alif after the plural wāw does not add a sound.
  return /^ا[۟]?$/u.test(final) && /^و/u.test(previous) && hasMaddVowel(letters, index - 1) ? index - 1 : index;
}

function changesLengthAtStop(letters: string[]) {
  const final = letters.at(-1) ?? "";
  const previous = letters.at(-2) ?? "";
  if (hasHamzah(final) || lengthened(final) || /[ًّٰ]/u.test(final) || !/[ٌٍَُِ]/u.test(final)) return false;
  if (lengthened(previous)) return false;
  const leen = /^[ويىی]/u.test(previous) && sukun.test(previous) && Boolean(letters.at(-3)?.includes("َ"));
  return leen || hasMaddVowel(letters, letters.length - 2);
}

function spelledTogether(letters: string[], index: number) {
  if (index !== 0) return false;
  const [beforeHamzah, afterHamzah, following] = letters;
  // The vocative yāʾ and demonstrative hāʾ can be written as part of the next word.
  return (beforeHamzah.startsWith("ي") && /^ي.*ّ/u.test(following ?? "")) ||
    (beforeHamzah.startsWith("ه") && /^[ؤو]/u.test(afterHamzah) && /^ل/u.test(following ?? ""));
}

export function maddForWord(letters: string[]) {
  const rules = new Set<string>();
  const natural: number[] = [];
  const lastVowelPosition = terminalIndex(letters);
  for (let index = 0; index < lastVowelPosition; index++) {
    if (!hasMaddVowel(letters, index)) continue;
    const following = letters[index + 1];
    if (hasHamzah(following)) rules.add(spelledTogether(letters, index) ? "madd-separated" : "madd-connected");
    else if (following.includes("ّ")) rules.add("madd-necessary");
    else if (!lengthened(letters[index]) && !sukun.test(following) && !hasHamzah(letters[index - 1] ?? "")) natural.push(index);
  }
  if (natural.length) rules.add("madd-natural");
  return {
    rules,
    terminal: hasMaddVowel(letters, lastVowelPosition),
    whenStopping: changesLengthAtStop(letters),
    onlyNaturalBeforeFinal: natural.length === 1 && natural[0] === letters.length - 2,
  };
}
