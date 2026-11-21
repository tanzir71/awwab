import source from "../../docs/content/umrah-guide-audio.json";
import type { AudioPack } from "./audio";

export type UmrahGuidePack = AudioPack & { language: "en" | "bn" | "ur" | "fr" | "ms" | "fa" | "ha" | "id" | "tr"; dataset?: string; datasetName?: string };
export const umrahGuidePacks = source.packs as UmrahGuidePack[];

export function umrahGuidePack(language: string) {
  return umrahGuidePacks.find(pack => pack.language === language) ?? umrahGuidePacks.find(pack => pack.language === "en")!;
}
