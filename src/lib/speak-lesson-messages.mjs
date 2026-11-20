import starter from "../../docs/content/spoken-arabic.json" with { type: "json" };
import everyday from "../../docs/content/spoken-saudi-a2.json" with { type: "json" };
import conversation from "../../docs/content/spoken-saudi-b1.json" with { type: "json" };
import gulf from "../../docs/content/spoken-gulf-a1.json" with { type: "json" };
import modernStandard from "../../docs/content/spoken-msa-a1.json" with { type: "json" };
import umrah from "../../docs/content/spoken-umrah-hajj.json" with { type: "json" };
import gulfWork from "../../docs/content/spoken-gulf-work.json" with { type: "json" };

export const speakUnitKey = (id, field) => `speakUnit-${id}-${field}`;
export const speakLineKey = (id, index) => speakUnitKey(id, `line-${index + 1}`);
export const speakWordKey = (id, index) => speakUnitKey(id, `word-${index + 1}`);

const courses = [
  ["spoken-arabic.json", starter.units],
  ["spoken-saudi-a2.json", everyday],
  ["spoken-saudi-b1.json", conversation],
  ["spoken-gulf-a1.json", gulf],
  ["spoken-msa-a1.json", modernStandard],
  ["spoken-umrah-hajj.json", umrah],
  ["spoken-gulf-work.json", gulfWork],
];

export const speakLessonMessages = Object.fromEntries(courses.flatMap(([file, units]) => units.flatMap(unit => {
  const definition = { file: `docs/content/${file}` };
  const entry = (key, [en, bn]) => [key, { en, bn, definition }];
  const unitEntries = [
    entry(speakUnitKey(unit.id, "title"), unit.title),
    entry(speakUnitKey(unit.id, "sign"), unit.meaning),
  ];
  if (unit.partner) unitEntries.push(entry(speakUnitKey(unit.id, "partner"), unit.partner));
  const dialogue = unit.id === "sim" ? starter.simDialogue : unit.dialogue ?? [];
  const words = unit.id === "sim" ? starter.simWords : unit.words ?? [];
  for (const [index, line] of dialogue.entries()) {
    if (!line.ask) unitEntries.push(entry(speakLineKey(unit.id, index), Array.isArray(line) ? line.slice(2) : line.meaning));
  }
  for (const [index, word] of words.entries()) unitEntries.push(entry(speakWordKey(unit.id, index), word.meaning));
  return unitEntries;
})));
