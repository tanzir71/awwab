import alphabet from "../../docs/content/arabic-letters.json";
import sample from "../../docs/content/word-anatomy.sample.json";

const aliases: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ی": "ي", "ة": "ت", "ؤ": "و", "ئ": "ي",
};
const longVowels: Record<string, [string, string]> = { "ا": ["a", "ā"], "ى": ["a", "ā"], "و": ["u", "ū"], "ي": ["i", "ī"] };
const annotation = /[\u0610-\u061A\u06D6-\u06ED]/gu;
const letterPattern = /\p{L}/u;
const arabicWordPattern = /[\p{Script=Arabic}\p{M}\u200C\u200D]+/gu;

export const normalizeWord = (word: string) => word.normalize("NFC")
  .replace(annotation, "").replace(/[\p{M}\u0640\u200C\u200D]/gu, "").replace(/ٱ/g, "ا");

export function splitGraphemes(word: string) {
  const letters: string[] = [];
  for (const char of word.normalize("NFC")) {
    if (/\p{M}/u.test(char)) {
      if (letters.length) letters[letters.length - 1] += char;
    } else if (letterPattern.test(char) && char !== "ـ") {
      letters.push(char);
    }
  }
  return letters;
}

export function splitArabicWords(line: string) {
  return [...line.matchAll(arabicWordPattern)].map(match => match[0]).filter(word => splitGraphemes(word).length > 0);
}

function letterTile(glyph: string, index: number, connected: boolean) {
  const [base, ...marks] = Array.from(glyph);
  const letter = alphabet.letters.find(item => item.letter === (aliases[base] ?? base));
  const waṣl = base === "ٱ";
  const silentMark = marks.includes("۟") || marks.includes("۠");
  const silent = (waṣl && (index > 0 || connected)) || silentMark;
  const details = alphabet.marks.filter(mark => marks.includes(mark.mark) || mark.alsoMatches?.some(alias => marks.includes(alias)));
  const vowel = details.find(mark => (mark.sound === "ā")) ?? details.find(mark => /^[aiu]n?$/.test(mark.sound));
  const shadda = marks.includes("ّ");
  const consonant = ["أ", "إ", "ؤ", "ئ", "ء"].includes(base) ? "ʾ" : base === "ة" ? "t" : letter?.sound.split(" / ")[0] ?? "";
  const sound = silent ? "" : waṣl ? "a" : base === "ا" ? (vowel?.sound ?? "") : base === "آ" ? "ʾā" : (shadda ? consonant : "") + consonant + (vowel?.sound ?? "");
  return {
    glyph, base, name: waṣl ? "Alif waṣl" : base === "ء" ? "Hamza" : letter?.name ?? base,
    nameBn: letter?.nameBn, details, silent, sound,
    vowel: !silent && (vowel?.sound ?? (waṣl ? "a" : base === "آ" ? "ā" : "")),
    shadda, consonant, joinsNext: Boolean(letter?.joinsNext) && base !== "ة", joinsPrevious: base !== "ء",
    mark: silent ? "Silent" : details.map(mark => mark.name).join(" + ") || "No mark",
    color: silent ? "harakat-silent" : details[0]?.color ?? "ink",
  };
}

export function wordAnatomy(word: string, connected = false) {
  const letters = splitGraphemes(word).map((glyph, index) => letterTile(glyph, index, connected));
  const syllables: { ar: string; tr: string }[] = [];
  letters.forEach((tile, index) => {
    const prev = syllables[syllables.length - 1];
    const [short, long] = longVowels[tile.base] ?? [];
    if (prev && short && !tile.silent && !tile.vowel && !tile.shadda && prev.tr.endsWith(short)
      && !tile.details.some(mark => mark.color === "harakat-sukoon")) {
      prev.ar += tile.glyph;
      prev.tr = prev.tr.slice(0, -1) + long;
    } else if (tile.vowel || !prev) {
      if (tile.shadda && prev) {
        prev.tr += tile.consonant;
        syllables.push({ ar: tile.glyph, tr: tile.sound.slice(tile.consonant.length) });
      } else {
        syllables.push({ ar: tile.glyph, tr: tile.sound });
      }
    } else {
      prev.ar += tile.glyph;
      prev.tr += tile.sound;
    }
  });
  const joining = letters.map((tile, i) => {
    const previous = Boolean(letters[i - 1]?.joinsNext && tile.joinsPrevious);
    const next = Boolean(tile.joinsNext && letters[i + 1]?.joinsPrevious);
    const position = previous ? (next ? "medial" : "final") : (next ? "initial" : "isolated");
    return { position, form: `${previous ? "ـ" : ""}${aliases[tile.base] ?? tile.base}${next ? "ـ" : ""}` };
  });
  const curated = normalizeWord(word) === normalizeWord(sample.word) ? sample : undefined;
  return { letters, syllables, joining, curated, modern: curated?.modern.spelling ?? normalizeWord(word) };
}
