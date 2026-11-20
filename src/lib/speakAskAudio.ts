import starter from "../../docs/content/spoken-arabic.json";
import umrah from "../../docs/content/spoken-umrah-hajj.json";
import { askClipPath, type AskVariety, type AskVoice } from "./umrahAsk";

export const placementSpeakPhraseIds = ["excuse-me", "toilet", "buy-sim", "lost"] as const;
const sharedIds = new Set([
  ...starter.units.flatMap(unit => unit.id === "sim" ? [] : unit.phrases),
  ...umrah.flatMap(unit => unit.dialogue.flatMap(line => Array.isArray(line) ? [] : [line.ask])),
  ...placementSpeakPhraseIds,
]);

export const sharedSpeakClips = [...sharedIds].map(id => askClipPath("saudi", "female", id));
export const hasSharedSpeakAudio = (ids: string[], variety: AskVariety, voice: AskVoice) =>
  variety === "saudi" && voice === "female" && ids.length > 0 && ids.every(id => sharedIds.has(id));
