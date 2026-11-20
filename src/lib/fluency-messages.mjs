import fluency from "../../docs/content/fluency.json" with { type: "json" };
import vocabulary from "../../docs/content/word-bank-glosses.json" with { type: "json" };

export const fluencyRootKey = root => `fluencyRoot-${root}`;
export const fluencyFamilyKey = (root, word) => `fluencyFamily-${root}-${word}`;
export const fluencyPairKey = (verse, usage) => `fluencyPair-${verse.replace(":", "-")}-${usage}`;
export const fluencySignKey = word => `fluencySign-${word}`;
export const fluencySentenceKey = (id, field) => `fluencySentence-${id}-${field}`;
export const wordGlossKey = word => `wordGloss-${word}`;

const fluencyEntry = (key, { en, bn }) => [key, { en, bn, definition: { file: "docs/content/fluency.json" } }];

export const fluencyLessonMessages = Object.fromEntries([
  ...Object.entries(fluency.roots).flatMap(([root, item]) => [
    fluencyEntry(fluencyRootKey(root), item),
    ...item.family.map(word => fluencyEntry(fluencyFamilyKey(root, word.tr), word)),
  ]),
  ...fluency.pairs.flatMap(pair => [
    fluencyEntry(fluencyPairKey(pair.verse, "quran"), pair),
    fluencyEntry(fluencyPairKey(pair.verse, "modern"), { en: pair.modernEn, bn: pair.modernBn }),
  ]),
  ...fluency.signs.map(sign => fluencyEntry(fluencySignKey(sign.ar), sign)),
  ...fluency.sentences.flatMap(sentence => [
    fluencyEntry(fluencySentenceKey(sentence.id, "meaning"), sentence),
    fluencyEntry(fluencySentenceKey(sentence.id, "hint"), { en: sentence.hintEn, bn: sentence.hintBn }),
  ]),
]);

export const wordGlossMessages = Object.fromEntries(Object.entries(vocabulary).map(([word, { en, bn }]) => [
  wordGlossKey(word), { en, bn, definition: { file: "docs/content/word-bank-glosses.json" } },
]));
