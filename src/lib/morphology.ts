import { asset } from "./config";
import { normalizeWord } from "./wordAnatomy";

const letters: Record<string, string> = {
  "'": "ء", "|": "آ", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ", A: "ا", b: "ب", p: "ة", t: "ت", v: "ث", j: "ج", H: "ح", x: "خ",
  d: "د", "*": "ذ", r: "ر", z: "ز", s: "س", "$": "ش", S: "ص", D: "ض", T: "ط", Z: "ظ", E: "ع", g: "غ", f: "ف", q: "ق", k: "ك",
  l: "ل", m: "م", n: "ن", h: "ه", w: "و", Y: "ى", y: "ي", F: "ً", N: "ٌ", K: "ٍ", a: "َ", u: "ُ", i: "ِ", "~": "ّ", o: "ْ", "`": "ٰ",
  "{": "ٱ", "^": "ٓ", "#": "ٔ", ":": "ۜ", "@": "۟", "\"": "۠", "[": "ۢ", ";": "ۣ", ",": "ۥ", ".": "ۦ", "!": "ۨ", "-": "ـ",
};

export function fromBuckwalter(s: string) {
  return [...s].map(char => letters[char] ?? char).join("");
}

export interface Morphology {
  word: string;
  root?: string;
  lemma?: string;
  type: string;
  verse: string;
  position: number;
}

interface Corpus {
  positions: Map<string, Morphology>;
  vocabulary: (Morphology & { count: number })[];
  families: Map<string, Morphology[]>;
}
const types: Record<string, string> = {
  N: "Noun", V: "Verb", ADJ: "Adjective", PN: "Proper noun", PRON: "Pronoun", P: "Preposition",
  CONJ: "Conjunction", NEG: "Negation", REL: "Relative pronoun", DEM: "Demonstrative", LOC: "Place adverb", T: "Time adverb",
};
let source: Promise<Corpus> | undefined;

function parseCorpus(text: string): Corpus {
  const positions = new Map<string, Morphology>();
  let prev: { key: string; tokens: string[] } | undefined;
  for (const line of text.split("\n")) {
    const match = line.match(/^\((\d+:\d+):(\d+):\d+\)\t([^\t]+)\t([^\t]+)\t(.+)$/);
    if (!match) continue;
    const [, verse, pos, token, tag, info] = match;
    const key = `${verse}:${pos}`;
    if (prev?.key !== key) prev = { key, tokens: [] };
    prev.tokens.push(token);
    if (!info.startsWith("STEM") && positions.has(key)) {
      positions.get(key).word = fromBuckwalter(prev.tokens.join(""));
      continue;
    }
    const root = info.match(/(?:^|\|)ROOT:([^|]+)/)?.[1];
    const lemma = info.match(/(?:^|\|)LEM:([^|]+)/)?.[1];
    positions.set(key, {
      word: fromBuckwalter(prev.tokens.join("")),
      root: root ? fromBuckwalter(root) : undefined,
      lemma: lemma ? fromBuckwalter(lemma) : undefined,
      type: types[tag] ?? tag,
      verse,
      position: Number(pos),
    });
  }
  const words = new Map<string, Morphology & { count: number }>();
  for (const word of positions.values()) {
    const lemma = normalizeWord(word.lemma ?? word.word);
    if (lemma.length < 1) continue;
    const key = `${lemma}:${word.type}`;
    const entry = words.get(key);
    if (entry) entry.count++;
    else words.set(key, { ...word, count: 1 });
  }
  const vocabulary = Array.from(words.values()).sort((a, b) => b.count - a.count);
  const families = new Map<string, Morphology[]>();
  for (const word of vocabulary) {
    if (!word.root) continue;
    const current = families.get(word.root) ?? [];
    if (current.length < 8) families.set(word.root, [...current, word]);
  }
  return { positions, vocabulary, families };
}

export function loadMorphology() {
  if (!source) source = (async () => {
    const response = await fetch(asset("data/qac-morphology-0.4.txt.gz"));
    if (!response.ok) throw new Error("Morphology unavailable");
    const buffer = await response.arrayBuffer();
    const header = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 2));
    if (header[0] !== 0x1f || header[1] !== 0x8b) return parseCorpus(new TextDecoder().decode(buffer));
    const bytes = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
    return parseCorpus(await new Response(bytes).text());
  })().catch(error => { source = undefined; throw error; });
  return source;
}

export async function lookupMorphology(verse: string, position: number) {
  const corpus = await loadMorphology();
  const word = corpus.positions.get(`${verse}:${position}`);
  if (!word) return undefined;
  return { ...word, family: corpus.families.get(word.root) ?? [] };
}
