import { qaidaAudioRef, qaidaRowCitation, qaidaRows } from "./qaidaPractice.ts";
import { studyRecitation, type StudyRecitation } from "./studyRecitations.ts";

const advancedLessons = [14, 15, 16, 17];
const rowRecitations = advancedLessons.flatMap(lesson => qaidaRows(lesson).flatMap((_row, index) => {
  const citation = qaidaRowCitation(lesson, index);
  if (!citation) return [];
  const clip = studyRecitation(citation.verse);
  if (!clip) throw new Error(`Missing Qaida recitation for ${citation.verse}`);
  return [[qaidaAudioRef(lesson, index), clip] as const];
}));

export const qaidaRecitations: Record<string, StudyRecitation | undefined> = Object.fromEntries([
  [qaidaAudioRef(17), studyRecitation("surah:112")!],
  ...rowRecitations,
]);

export const qaidaRecitationLessons: Record<string, StudyRecitation[] | undefined> = Object.fromEntries([14, 15, 16].map(lesson => [
  qaidaAudioRef(lesson), qaidaRows(lesson).flatMap((_row, index) => qaidaRecitations[qaidaAudioRef(lesson, index)] ?? []),
]));
