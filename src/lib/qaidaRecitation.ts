import recitations from "../../public/packs/audio/index.json";
import { qaidaAudioRef, qaidaRows, qaidaRowVerse } from "./qaidaPractice";

export const qaidaReciter = recitations.packs.find(pack => pack.id === "aaqib-112")!;
const sources = new Map(qaidaReciter.items.map(item => [item.ref, item]));
export const qaidaRecitations: Record<string, { ref: string; path: string } | undefined> = Object.fromEntries([
  [qaidaAudioRef(17), sources.get("surah:112")!],
  ...qaidaRows(17).map((_row, index) => [qaidaAudioRef(17, index), sources.get(qaidaRowVerse(17, index))!]),
]);
