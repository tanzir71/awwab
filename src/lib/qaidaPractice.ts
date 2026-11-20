import alphabet from "../../docs/content/arabic-letters.json" with { type: "json" };

const practiceWords = ["بَابٌ", "بِسْمِ", "قُلْ", "أَحَدٌ", "يَوْمٌ", "رَبِّ", "ٱلْعَصْرِ"];
const exercises: Record<number, string[]> = {
  2: ["بتث", "جحخ", "سشط", "درز", "فقي", "كتب"],
  3: ["الٓمٓ", "يسٓ", "طسمٓ", "طه", "كهيعصٓ"],
  6: practiceWords, 7: ["هَٰذَا", "مَٰلِكِ", "ٱلرَّحْمَٰنِ", "مُوسَىٰ"],
  8: ["بَا", "بِي", "بُو", "بَيْ", "بَوْ"], 9: ["خَيْرٌ", "سَلَامٌ", "نُورٌ", "رَيْبٌ"],
  10: ["أَبْ", "أَجْ", "أَدْ", "بِسْ", "قُلْ"], 11: ["ٱلْحَمْدُ", "رَبِّ", "نَعْبُدُ", "ٱهْدِنَا"],
  12: ["رَبَّ", "إِنَّ", "أُمُّ", "حَقٌّ"], 13: ["ٱلضُّحَىٰ", "رَبِّ", "ٱلنَّاسِ", "ٱلصَّمَدُ"],
  14: ["ٱلضَّآلِّينَ", "ٱلصَّآفَّٰتِ", "فَذَكِّرْ"], 15: ["جَآءَ", "إِنَّآ", "ٱلسَّمَآءِ"],
  16: ["مِنْ", "أَنْعَمْتَ", "مِنْ رَبِّهِمْ", "مِنْ خَيْرٍ", "مِنْ بَعْدِ"], 17: ["قُلْ هُوَ ٱللَّهُ أَحَدٌ", "ٱللَّهُ ٱلصَّمَدُ", "لَمْ يَلِدْ"],
};

export function qaidaRows(lesson: number) {
  if (lesson === 1) return Array.from({ length: 10 }, (_, i) => alphabet.letters.slice(i * 3, i * 3 + 3).map(letter => [letter.letter]));
  if (lesson !== 4 && lesson !== 5) return (exercises[lesson] ?? []).map(text => [[text]]);
  const marks = lesson === 4 ? ["َ", "ِ", "ُ"] : ["ً", "ٍ", "ٌ"];
  const letters = alphabet.letters.map(letter => letter.letter);
  const intro = [0, 7].flatMap(start => marks.map(mark => letters.slice(start, start + 7).map(letter => [letter + mark])));
  const acrossMarks = [14, 21].map(start => letters.slice(start, start + 7).map(letter => marks.map(mark => letter + mark)));
  const recap = lesson === 4 ? [["بَاب", "جَبَل", "قُلْ"], ["كَتَبَ", "نَصَرَ", "رَبِّ"]] :
    [["بَابٌ", "قَلَمٌ", "كِتَابٌ"], ["بَابًا", "قَلَمٍ", "كِتَابٍ"]];
  return [...intro, ...acrossMarks, ...recap.map(row => row.map(word => [word]))];
}

export function qaidaExamples(lesson: number) {
  if (lesson === 4) return ["بَ", "بِ", "بُ"];
  if (lesson === 5) return ["بً", "بٍ", "بٌ"];
  return qaidaRows(lesson).flat(2).slice(0, 3);
}

export const qaidaHarakatExercise = "تَ تِ جُ حَ حِ دُ";
export const qaidaHarakatExerciseRef = "qaida:4:examples";

const citedRows: Record<number, string[]> = {
  3: ["2:1", "36:1", "26:1", "20:1", "19:1"],
  17: ["112:1", "112:2", "112:3"],
};

export function qaidaRowVerse(lesson: number, row: number) {
  return citedRows[lesson]?.[row];
}

export function qaidaAudioRef(lesson: number, row?: number) {
  if (row === undefined) return `qaida:${lesson}:lesson`;
  const revision = lesson === 4 || lesson === 5 ? ":v2" : "";
  return `qaida:${lesson}:${row + 1}${revision}`;
}

export function resolveQaidaRow(requested: string | null, saved: number, count: number) {
  const row = requested && /^\d+$/.test(requested) ? Number(requested) - 1 : -1;
  if (row >= 0 && row < count) return row;
  return Number.isInteger(saved) ? Math.max(-1, Math.min(count - 1, saved)) : 0;
}

export function qaidaReviewId(lesson: number, row: number) {
  return `qaida:${lesson}:${row}`;
}

export function parseQaidaReview(id: string) {
  const match = /^qaida:(\d{1,2}):(\d{1,2})$/.exec(id);
  if (!match) return undefined;
  const lesson = Number(match[1]);
  const row = Number(match[2]);
  return row < qaidaRows(lesson).length ? { lesson, row } : undefined;
}
