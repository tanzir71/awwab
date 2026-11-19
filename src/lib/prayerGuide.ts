import { prayerIds, type RakatGroup } from "@/types/Prayer";
import type { Reviews } from "./reviews";
import type { AsrSchool } from "./prayerServices";
import content from "../../docs/content/rakat-structure.json";
import surahs from "../../docs/content/surahs-for-salah.json";

export const guideReferences = ["hanafi", "fard"] as const;
export type GuideReference = typeof guideReferences[number];
export const guidedPrayers = [...prayerIds, "jumuah"] as const;
export type GuidedPrayer = typeof guidedPrayers[number];
export const prayerGuideTopics = ["witr", "eid", "janazah", "sahw"] as const;
export type PrayerGuideTopic = typeof prayerGuideTopics[number];

export function guideReference(settings: { prayerGuide?: GuideReference; school: AsrSchool }): GuideReference {
  return settings.prayerGuide ?? (settings.school === "hanafi" ? "hanafi" : "fard");
}

type GuideSettings = Parameters<typeof guideReference>[0];
export function guideRakats(groups: RakatGroup[], settings: GuideSettings) {
  return guideReference(settings) === "hanafi" ? groups : groups.filter(group => group.type === "fard");
}

export function prayerGuidePath(value: string | null | undefined, rakah?: string | null) {
  const prayer = [...guidedPrayers, ...prayerGuideTopics].find(id => id === value);
  return prayer ? `/today/guide/${prayer}${rakah && /^[1-4]$/.test(rakah) ? `?rakah=${rakah}` : ""}` : undefined;
}

export const guideSource = content.fardRakahGuide;
const availableSurahs = surahs.surahs.slice(1, 12);

export function prayerGuideGroups(prayer: GuidedPrayer, settings: GuideSettings) {
  return guideRakats(content.prayers[prayer], settings);
}

export function guideRakahIndex(query: string | null, count: number) {
  const selected = query && /^[1-9]\d*$/.test(query) ? Number(query) : 1;
  return selected > count ? 0 : selected - 1;
}

export function prayerGuide(prayer: GuidedPrayer, settings: GuideSettings, reviews: Reviews) {
  const fard = content.prayers[prayer].find(group => group.type === "fard");
  const groups = prayerGuideGroups(prayer, settings);
  const solid = availableSurahs.filter(surah => reviews[surah.number]?.bucket === "manzil");
  const suggestions = [...solid, ...availableSurahs.filter(surah => !solid.includes(surah))];
  const steps = Array.from({ length: fard.count }, (_, index) => {
    const number = index + 1;
    const suggestion = number <= guideSource.withAdditionalSurahThrough ? suggestions[index] : undefined;
    const sitting = number === fard.count ? "final" : number === guideSource.firstSittingAfter ? "first" : undefined;
    return { number, suggestion, sitting, recitation: fard.recitation };
  });
  return { groups, fardCount: fard.count, total: groups.reduce((sum, group) => sum + group.count, 0), steps };
}
