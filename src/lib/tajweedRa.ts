const sukun = /[ْۡ]/u;
const emphatic = /^[خصضغطقظ]/u;

export function vowelledRaRule(glyph: string) {
  if (!glyph.startsWith("ر")) return;
  if (/[ًٌَُ]/u.test(glyph)) return "ra-heavy";
  if (/[ٍِ]/u.test(glyph)) return "ra-light";
}

export function writtenSukunRaRule(letters: string[], index: number) {
  const glyph = letters[index];
  if (!glyph.startsWith("ر") || !sukun.test(glyph)) return;
  const previous = letters[index - 1] ?? "";
  const initialWasl = /^[ٱا]ِ?$/u.test(previous) &&
    (index === 1 || (index === 2 && /^[وف]/u.test(letters[0])));
  if (initialWasl || /[َُ]/u.test(previous)) return "ra-sukun-heavy";
  if (!previous.includes("ِ")) return;

  const next = letters[index + 1] ?? "";
  if (emphatic.test(next)) {
    // An emphatic letter with kasrah can allow different readings.
    return next.includes("ِ") ? undefined : "ra-sukun-heavy";
  }
  return "ra-sukun-light";
}

export function stoppedRaRule(letters: string[], reference: string, isLastWord: boolean) {
  const final = letters.at(-1) ?? "";
  if (!vowelledRaRule(final) || final.includes("ً")) return;
  // The historical final yāʾ of yasri accounts for both readings at this stop.
  if (reference === "89:4" && isLastWord) return "ra-sukun-either";

  const previous = letters.at(-2) ?? "";
  if (/^[يىی]/u.test(previous) && !/[ًٌٍَُِّٰ]/u.test(previous)) return "ra-sukun-light";
  if (/[َُٰ]/u.test(previous)) return "ra-sukun-heavy";
  if (previous.includes("ِ")) return "ra-sukun-light";

  // Look past a sākin consonant or the carrier of a long ā or ū.
  if (!sukun.test(previous) && !/^[او][ٓ࢜]*$/u.test(previous)) return;
  const earlier = letters.at(-3) ?? "";
  if (/[َُٰ]/u.test(earlier)) return "ra-sukun-heavy";
  if (earlier.includes("ِ") && !emphatic.test(previous)) return "ra-sukun-light";
}
