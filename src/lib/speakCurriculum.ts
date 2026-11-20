import starter from "../../docs/content/spoken-arabic.json";
import everyday from "../../docs/content/spoken-saudi-a2.json";
import conversation from "../../docs/content/spoken-saudi-b1.json";
import gulf from "../../docs/content/spoken-gulf-a1.json";
import modernStandard from "../../docs/content/spoken-msa-a1.json";
import umrah from "../../docs/content/spoken-umrah-hajj.json";
import gulfWork from "../../docs/content/spoken-gulf-work.json";
import { asset } from "./config";
import { askClipPath, askPhrase, renderAsk } from "./umrahAsk";

export const speakBase = "/learn/speak";
export const speakProgressKey = "speak-complete";
export const speakGoalsKey = "speak-goals";
export const speakVarietyKey = "speak-variety";
export const speakGoals = ["speakUmrah", "speakWork", "speakEveryday", "speakNews"] as const;
export const speakLevels = ["A1", "A2", "B1"] as const;
export type SpeakLevel = typeof speakLevels[number];
export const speakPacks = ["umrah-hajj", "gulf-work"] as const;
export type SpeakPack = typeof speakPacks[number];
export const speakPathCourses = [...speakLevels, ...speakPacks] as const;
export type SpeakCourse = typeof speakPathCourses[number];
export const speakLevelLabels = { A1: "speakSurvival", A2: "speakEverydayLevel", B1: "speakConversation", "umrah-hajj": "speakUmrah", "gulf-work": "speakWork" };
export const speakVarieties = ["saudi-hijazi", "gulf", "msa"] as const;
export type SpeakVariety = typeof speakVarieties[number];
export const defaultSpeakVariety: SpeakVariety = "saudi-hijazi";
export const speakVarietyLabels = { "saudi-hijazi": "speakSaudi", gulf: "speakGulf", msa: "speakFormal" };
type SpeakPackDetails = { path: string; variety: SpeakVariety; description: string };
export const speakPackDetails: Readonly<Partial<Record<SpeakCourse, SpeakPackDetails>>> = {
  "umrah-hajj": { path: "/learn/paths/speak/4", variety: "saudi-hijazi", description: "speakUmrahPackDescription" },
  "gulf-work": { path: "/learn/paths/speak/5", variety: "gulf", description: "speakWorkPackDescription" },
};
export const speakCourseTitle = (course: SpeakCourse, t: (key: string) => string) => speakPackDetails[course] ? t(speakLevelLabels[course]) : course;

type StarterUnit = typeof starter.units[number] & { level: "A1"; variety: "saudi-hijazi" };
type ConversationUnit = (typeof everyday[number] | typeof conversation[number] | typeof gulf[number] | typeof modernStandard[number] | typeof umrah[number] | typeof gulfWork[number]) &
  { level: SpeakCourse; variety: SpeakVariety };
export type SpeakUnit = StarterUnit | ConversationUnit;
export type SpeakWord = { ar: string; tr: string; meaning: string[]; root?: string; bridge?: string };
type SpeakLine = SpeakWord & { clip: string; askId?: string };

export const speakCourses: Record<SpeakVariety, Partial<Record<SpeakCourse, SpeakUnit[]>>> = {
  "saudi-hijazi": {
    A1: starter.units.map(unit => ({ ...unit, level: "A1", variety: "saudi-hijazi" })),
    A2: everyday.map(unit => ({ ...unit, level: "A2", variety: "saudi-hijazi" })),
    B1: conversation.map(unit => ({ ...unit, level: "B1", variety: "saudi-hijazi" })),
    "umrah-hajj": umrah.map(unit => ({ ...unit, level: "umrah-hajj", variety: "saudi-hijazi" })),
  },
  gulf: {
    A1: gulf.map(unit => ({ ...unit, level: "A1", variety: "gulf" })),
    "gulf-work": gulfWork.map(unit => ({ ...unit, level: "gulf-work", variety: "gulf" })),
  },
  msa: { A1: modernStandard.map(unit => ({ ...unit, level: "A1", variety: "msa" })) },
};
export const speakCourseVariety = (preferred: SpeakVariety, course: SpeakCourse) =>
  speakCourses[preferred][course] ? preferred : speakPackDetails[course]?.variety ?? defaultSpeakVariety;
const speakUnits = Object.values(speakCourses).flatMap(courses => Object.values(courses).flat());
export const speakUnit = (id: string | undefined) => speakUnits.find(unit => unit.id === id);
export const speakUnitNumber = (unit: SpeakUnit) => speakCourses[unit.variety][unit.level].indexOf(unit) + 1;
export function speakSetupPath(level: SpeakCourse, variety?: SpeakVariety) {
  const pack = speakPackDetails[level];
  if (pack) return pack.path;
  const params = new URLSearchParams();
  if (level !== "A1") params.set("level", level);
  if (variety) params.set("variety", variety);
  return params.size ? `${speakBase}?${params}` : speakBase;
}
export const speakLessonPath = (id: string) => `${speakBase}/${id}`;
export const studyClipPath = (name: string) => `packs/study-speech/${name}.opus`;

function sharedAskLine(id: string): SpeakLine {
  const phrase = askPhrase(id);
  const line = renderAsk(phrase, "saudi");
  return { ...line, meaning: [line.en, phrase.bn], clip: askClipPath("saudi", "female", id), askId: id };
}

export function speakLessonContent(unit: SpeakUnit) {
  let lines: SpeakLine[];
  let words: SpeakWord[];
  let wordClips: string[];
  const signClip = studyClipPath(`sign-${unit.id}`);
  if ("dialogue" in unit) {
    lines = unit.dialogue.map((line, index) => {
      if (!Array.isArray(line)) return sharedAskLine(line.ask);
      const [ar, tr, en, bn] = line;
      return { ar, tr, meaning: [en, bn], clip: studyClipPath(`${unit.id}-line-${index + 1}`) };
    });
    words = unit.words;
    wordClips = words.map((_, index) => studyClipPath(`${unit.id}-word-${index + 1}`));
  } else if (unit.id === "sim") {
    lines = starter.simDialogue.map((line, index) => ({ ...line, clip: studyClipPath(`sim-${index + 1}`) }));
    words = starter.simWords;
    wordClips = words.map((_, index) => studyClipPath(`sim-word-${index + 1}`));
  } else {
    lines = unit.phrases.map(sharedAskLine);
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
