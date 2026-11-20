import recitations from "../../public/packs/audio/index.json";
import qaida from "../../docs/content/qaida-recitations.json";
import tajweed from "../../docs/content/tajweed-recitations.json";

export type StudyRecitation = {
  ref: string;
  throughAyah?: number;
  path: string;
  speaker: string;
  source: string;
  licenseUrl: string;
  license: string;
};

const supplemental: { speaker: string; clips: Omit<StudyRecitation, "speaker">[] }[] = [qaida, tajweed];
const studyClips = new Map<string, StudyRecitation>([
  ...recitations.packs.flatMap(pack => pack.items.map(item => [item.ref, {
    ...item, speaker: pack.speaker, source: pack.source, licenseUrl: pack.licenseUrl, license: pack.attribution.split(" · ")[1],
  }] as const)),
  ...supplemental.flatMap(pack => pack.clips.map(({ ref, path, source, licenseUrl, license, throughAyah }) => [
    ref, { ref, path, source, licenseUrl, license, throughAyah, speaker: pack.speaker },
  ] as const)),
]);

export const studyRecitation = (ref: string) => studyClips.get(ref);
