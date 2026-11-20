import foundations from "../../docs/content/grammar-foundations.json" with { type: "json" };
import roots from "../../docs/content/roots-curriculum.json" with { type: "json" };
import sentence from "../../docs/content/sentence-structure.json" with { type: "json" };

export const grammarLessonKey = (course, id, field) => `grammarLesson-${course}-${id}-${field}`;
export const grammarWordField = (index, field) => `word-${index + 1}-${field}`;
export const grammarExampleField = (index, field) => `example-${index + 1}-${field}`;

const courses = [
  ["foundations", "grammar-foundations.json", foundations],
  ["roots", "roots-curriculum.json", roots],
  ["sentence", "sentence-structure.json", sentence],
];

export const grammarLessonMessages = Object.fromEntries(courses.flatMap(([course, file, curriculum]) =>
  curriculum.lessons.flatMap(unit => {
    const definition = { file: `docs/content/${file}` };
    const entry = (field, [en, bn]) => [grammarLessonKey(course, unit.id, field), { en, bn, definition }];
    const entries = ["title", "rule", "prompt"].map(field => entry(field, unit[field]));
    for (const [index, [, latin, en, bn, banglaLabel]] of unit.words.entries()) {
      entries.push(entry(grammarWordField(index, "meaning"), [en, bn]));
      if (banglaLabel) entries.push(entry(grammarWordField(index, "label"), [latin, banglaLabel]));
    }
    for (const [index, example] of (unit.examples ?? []).entries()) {
      for (const field of ["label", "note"]) if (example[field]) entries.push(entry(grammarExampleField(index, field), example[field]));
    }
    if (unit.commentary) entries.push(entry("commentary", unit.commentary.text));
    return entries;
  }),
));
