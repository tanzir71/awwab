import source from "../../handovers/H2-languages-paths-arabic-help/data/umrah-phrases.json" with { type: "json" };

export const askPhraseKey = id => `askPhrase-${id}`;
export const askSignKey = id => `askSign-${id}`;
const numberSlot = text => text.replace("{n}", "{n, number}");

export const askPhraseMessages = Object.fromEntries(source.phrases.flatMap(phrase => [
  [askPhraseKey(phrase.id), { en: numberSlot(phrase.en), bn: numberSlot(phrase.bn) }],
  ...(phrase.sign ? [[askSignKey(phrase.id), { en: phrase.sign.en, bn: phrase.sign.bn }]] : []),
]));
