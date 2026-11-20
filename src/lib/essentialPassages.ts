import index from "../../public/data/quran-study-index-v1.json" with { type: "json" };
import catalogue from "../../handovers/H2-languages-paths-arabic-help/data/essential-passages.json" with { type: "json" };

export const essentialPassages = catalogue.passages;
const chapterLengths = new Map(index.chapters.map(chapter => [chapter.number, chapter.ayahs]));

function displayableSource(entry: typeof essentialPassages[number]) {
  // The handover marks displayable virtues with a categorical grade.
  return entry.source && ["sahih", "hasan"].includes(entry.source.grade) ? entry.source : undefined;
}

export const hifzVirtueKey = (id: string) => `hifzVirtue-${id}`;
export const hifzVirtueMessages: Record<string, { en: string; definition: { file: string } }> = Object.fromEntries(
  essentialPassages.filter(entry => displayableSource(entry) && entry.why).map(entry => [
    hifzVirtueKey(entry.id),
    { en: entry.why, definition: { file: "handovers/H2-languages-paths-arabic-help/data/essential-passages.json" } },
  ]),
);

export function essentialStudyPassage(id: string) {
  const entry = essentialPassages.find(item => item.id === id);
  if (!entry) return undefined;
  const ranges = entry.ref.split(" · ").map(part => {
    const [number, ayahs] = part.split(":");
    const chapter = Number(number);
    const [first, last] = (ayahs ?? `1-${chapterLengths.get(chapter)}`).split("-");
    return { chapter, from: Number(first), to: Number(last ?? first) };
  });
  const source = displayableSource(entry);
  return { id, title: entry.title, ranges, ayahs: ranges.reduce((sum, range) => sum + range.to - range.from + 1, 0),
    source, why: source ? entry.why : undefined };
}
