import { momentPath } from "./studyMilestones";

const shareOrigins = new Map([
  ["return", "/return"], ["umrah", "/umrah"], ["today", "/today"], ["learn", "/learn"],
]);

export function shareReturnPath(params: URLSearchParams) {
  const origin = params.get("from");
  const template = params.get("template") ?? "surah";
  const value = Number(params.get("value"));
  if (origin === "moment" && Number.isSafeInteger(value) && value > 0 &&
    (template === "surah" || template === "words" || template === "qaida" || template === "maktab")) {
    return momentPath(template, value, params.get("study") === "salah");
  }
  return shareOrigins.get(origin) ?? "/you";
}
