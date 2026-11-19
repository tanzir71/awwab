export type PseudoLocale = "en-XA" | "en-XB";

export function readPseudoLocale(search: string): PseudoLocale | undefined {
  const code = new URLSearchParams(search).get("locale");
  return code === "en-XA" || code === "en-XB" ? code : undefined;
}

const accents: Record<string, string> = {
  a: "á", b: "ƀ", c: "ç", d: "ď", e: "ë", f: "ƒ", g: "ğ", h: "ĥ", i: "ï", j: "ĵ", k: "ķ", l: "ľ", m: "ḿ",
  n: "ñ", o: "ö", p: "þ", q: "ʠ", r: "ř", s: "š", t: "ţ", u: "ü", v: "ṽ", w: "ŵ", x: "ẋ", y: "ÿ", z: "ž",
};

export function pseudoLiteral(text: string, locale: PseudoLocale) {
  if (locale === "en-XB") return text.replace(/[A-Za-z][A-Za-z’'-]*/g, value => `\u2067\u202E${value}\u202C\u2069`);
  return text.replace(/[A-Za-z]{2,}/g, word => {
    const mapped = word.replace(/[A-Za-z]/g, char => {
      const lower = char.toLowerCase();
      return char === lower ? accents[lower] : accents[lower].toUpperCase();
    });
    return mapped + "~".repeat(Math.round(word.length * .4));
  });
}
