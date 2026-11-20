import salah from "../../docs/content/salah-words.json" with { type: "json" };
import surah from "../../docs/content/surah-study-words.json" with { type: "json" };
import anatomy from "../../docs/content/word-anatomy.sample.json" with { type: "json" };

export const ayahGlossKey = (reference, position) => `ayahGloss-${reference.replace(":", "-")}-${position}`;
export const salahGlossKey = (section, line, word) => `salahGloss-${section + 1}-${line + 1}-${word + 1}`;
export const salahPreviewKey = id => `salahMeaning-${id}`;
export const anatomyGlossKey = (part, index = 0) => `anatomyGloss-${anatomy.verseKey.replace(":", "-")}-${part}-${index + 1}`;

const salahSource = "docs/content/salah-words.json";
const anatomySource = "docs/content/word-anatomy.sample.json";
const entry = (key, en, file) => [key, { en, definition: { file } }];
const ayahEntries = (reference, glosses, file) => glosses.flatMap((gloss, index) =>
  gloss === null ? [] : [entry(ayahGlossKey(reference, index + 1), gloss, file)]);

export const studyGlossMessages = Object.fromEntries([
  ...Object.entries(surah.glosses).flatMap(([reference, glosses]) =>
    ayahEntries(reference, glosses, "docs/content/surah-study-words.json")),
  ...Object.entries(salah.fatiha).flatMap(([reference, verse]) => ayahEntries(reference, verse.glosses, salahSource)),
  ...salah.sections.flatMap((section, sectionIndex) => [
    ...section.lines.flatMap(([, glosses], lineIndex) =>
      glosses.map((gloss, index) => entry(salahGlossKey(sectionIndex, lineIndex, index), gloss, salahSource))),
    ...(section.preview ? [entry(salahPreviewKey(section.preview.id), section.preview.meaning, salahSource)] : []),
  ]),
  entry(anatomyGlossKey("meaning"), anatomy.meaning, anatomySource),
  entry(anatomyGlossKey("root"), anatomy.root.meaning, anatomySource),
  ...anatomy.prefixes.map((item, index) => entry(anatomyGlossKey("prefix", index), item.meaning, anatomySource)),
  ...anatomy.root.family.map((item, index) => entry(anatomyGlossKey("family", index), item.en, anatomySource)),
  ...anatomy.modern.examples.map((item, index) => entry(anatomyGlossKey("modern", index), item.en, anatomySource)),
]);
