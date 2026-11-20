import recitations from "../../public/packs/audio/index.json";
import supplemental from "../../docs/content/qaida-recitations.json";
import { qaidaAudioRef, qaidaRowCitation, qaidaRows } from "./qaidaPractice";

type Recitation = { ref: string; throughAyah?: number; path: string; speaker: string; source: string; licenseUrl: string; license: string };

const sources = new Map<string, Recitation>([
  ...recitations.packs.flatMap(pack => pack.items.map(item => [item.ref, {
    ...item, speaker: pack.speaker, source: pack.source, licenseUrl: pack.licenseUrl, license: pack.attribution.split(" · ")[1],
  }] as const)),
  ...supplemental.clips.map(({ ref, path, source, licenseUrl, license, throughAyah }) => [
    ref, { ref, path, source, licenseUrl, license, throughAyah, speaker: supplemental.speaker },
  ] as const),
]);

const advancedLessons = [14, 15, 16, 17];
const rowRecitations = advancedLessons.flatMap(lesson => qaidaRows(lesson).flatMap((_row, index) => {
  const citation = qaidaRowCitation(lesson, index);
  if (!citation) return [];
  const clip = sources.get(citation.verse);
  if (!clip) throw new Error(`Missing Qaida recitation for ${citation.verse}`);
  return [[qaidaAudioRef(lesson, index), clip] as const];
}));

export const qaidaRecitations: Record<string, Recitation | undefined> = Object.fromEntries([
  [qaidaAudioRef(17), sources.get("surah:112")!],
  ...rowRecitations,
]);

export const qaidaRecitationLessons: Record<string, Recitation[] | undefined> = Object.fromEntries([14, 15, 16].map(lesson => [
  qaidaAudioRef(lesson), qaidaRows(lesson).flatMap((_row, index) => qaidaRecitations[qaidaAudioRef(lesson, index)] ?? []),
]));
