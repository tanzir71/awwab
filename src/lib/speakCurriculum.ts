import starter from "../../docs/content/spoken-arabic.json";
import everyday from "../../docs/content/spoken-saudi-a2.json";
import conversation from "../../docs/content/spoken-saudi-b1.json";
import modernStandard from "../../docs/content/spoken-msa-a1.json";
import { asset } from "./config";
import { askPhrase, renderAsk } from "./umrahAsk";
import { banglaPhrases } from "./umrah-ask-copy";

export const speakBase = "/learn/speak";
export const speakProgressKey = "speak-complete";
export const speakGoalsKey = "speak-goals";
export const speakVarietyKey = "speak-variety";
export const speakGoals = ["speakUmrah", "speakWork", "speakEveryday", "speakNews"] as const;
export const speakLevels = ["A1", "A2", "B1"] as const;
export type SpeakLevel = typeof speakLevels[number];
export const speakLevelLabels = { A1: "speakSurvival", A2: "speakEverydayLevel", B1: "speakConversation" };
export const speakVarieties = ["saudi-hijazi", "msa"] as const;
export type SpeakVariety = typeof speakVarieties[number];
export const defaultSpeakVariety: SpeakVariety = "saudi-hijazi";
export const speakVarietyLabels = { "saudi-hijazi": "speakSaudi", msa: "speakFormal" };

type StarterUnit = typeof starter.units[number] & { level: "A1"; variety: "saudi-hijazi" };
type ConversationUnit = (typeof everyday[number] | typeof conversation[number] | typeof modernStandard[number]) & { level: SpeakLevel; variety: SpeakVariety };
export type SpeakUnit = StarterUnit | ConversationUnit;
export type SpeakWord = { ar: string; tr: string; meaning: string[]; root?: string; bridge?: string };
type SpeakLine = SpeakWord & { clip: string };

export const speakCourses: Record<SpeakVariety, Partial<Record<SpeakLevel, SpeakUnit[]>>> = {
  "saudi-hijazi": {
    A1: starter.units.map(unit => ({ ...unit, level: "A1", variety: "saudi-hijazi" })),
    A2: everyday.map(unit => ({ ...unit, level: "A2", variety: "saudi-hijazi" })),
    B1: conversation.map(unit => ({ ...unit, level: "B1", variety: "saudi-hijazi" })),
  },
  msa: { A1: modernStandard.map(unit => ({ ...unit, level: "A1", variety: "msa" })) },
};
export const speakCourseVariety = (preferred: SpeakVariety, level: SpeakLevel) => speakCourses[preferred][level] ? preferred : defaultSpeakVariety;
const speakUnits = Object.values(speakCourses).flatMap(courses => Object.values(courses).flat());
export const speakUnit = (id: string | undefined) => speakUnits.find(unit => unit.id === id);
export const speakUnitNumber = (unit: SpeakUnit) => speakCourses[unit.variety][unit.level].indexOf(unit) + 1;
export function speakSetupPath(level: SpeakLevel, variety?: SpeakVariety) {
  const params = new URLSearchParams();
  if (level !== "A1") params.set("level", level);
  if (variety) params.set("variety", variety);
  return params.size ? `${speakBase}?${params}` : speakBase;
}
export const speakLessonPath = (id: string) => `${speakBase}/${id}`;
export const studyClipPath = (name: string) => `packs/study-speech/${name}.opus`;

export function speakLessonContent(unit: SpeakUnit) {
  let lines: SpeakLine[];
  let words: SpeakWord[];
  let wordClips: string[];
  const signClip = studyClipPath(`sign-${unit.id}`);
  if ("dialogue" in unit) {
    lines = unit.dialogue.map(([ar, tr, en, bn], index) => ({ ar, tr, meaning: [en, bn], clip: studyClipPath(`${unit.id}-line-${index + 1}`) }));
    words = unit.words;
    wordClips = words.map((_, index) => studyClipPath(`${unit.id}-word-${index + 1}`));
  } else if (unit.id === "sim") {
    lines = starter.simDialogue.map((line, index) => ({ ...line, clip: studyClipPath(`sim-${index + 1}`) }));
    words = starter.simWords;
    wordClips = words.map((_, index) => studyClipPath(`sim-word-${index + 1}`));
  } else {
    lines = unit.phrases.map(id => {
      const line = renderAsk(askPhrase(id)!, "saudi");
      return { ...line, meaning: [line.en, banglaPhrases[id] ?? line.en], clip: `packs/phrases/saudi/female/${id}.opus` };
    });
    words = lines;
    wordClips = lines.map(line => line.clip);
  }
  const clips = Object.fromEntries<string>([
    ...lines.map((line, index) => [`line-${index}`, asset(line.clip)] as const),
    ...wordClips.map((clip, index) => [`word-${index}`, asset(clip)] as const),
    ["sign", asset(signClip)],
  ]);
  return { lines, words, clips };
}
