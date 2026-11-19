import { asset } from "./config";
import { collectionIds, editionUrl, hadithArchiveVersion, hadithCollections, type HadithCollection, type HadithGrade, type HadithNarration } from "./hadith-catalogue";
import { studySearchTerm } from "./study-copy";
import curated from "../../docs/content/hadith-curated.json";

export type CollectionScope = HadithCollection | "all" | "riyadussalihin";
export const hadithTopics = ["all", "prayer", "repentance", "character", "family", "knowledge"] as const;
export type HadithTopic = typeof hadithTopics[number];
export type CuratedNarration = {
  collection: HadithCollection;
  number: number | string;
  grade: string;
  theme: string;
  summary: string;
  summaryBn: string;
  alsoIn: string | null;
  url: string;
  qudsi?: boolean;
  narrator?: string;
  excerptAr?: string;
  excerptEn?: string;
};
type Language = "en" | "bn";

export const featuredHadith = curated.items[0] as CuratedNarration;
export const featuredArabic = curated.featuredArabic;
export const curatedHadith = [...curated.items, ...curated.character] as CuratedNarration[];
export const riyadSelections = curated.riyad;

const archives = new Map<HadithCollection, Promise<HadithNarration[]>>();
const curatedById = new Map(curatedHadith.map(item => [hadithId(item.collection, item.number), item]));
const searchText = new WeakMap<HadithNarration, string>();
const repentanceReading = ["tirmidhi:3540", "bukhari:6307", "bukhari:6464", "bukhari:6306", "bukhari:1"];

export const desktopHadith = [...repentanceReading.map(id => curatedById.get(id)),
  ...curatedHadith.filter(item => !repentanceReading.includes(hadithId(item.collection, item.number)))];

export function curatedHadithFor(id: string) {
  return curatedById.get(id);
}

export function topicMatches(topic: HadithTopic, item?: CuratedNarration) {
  if (topic === "all") return true;
  if (!item) return false;
  if (topic === "repentance") return ["mercy", "return"].includes(item.theme) || repentanceReading.includes(hadithId(item.collection, item.number));
  return item.theme === topic;
}

export function loadHadith(collection: HadithCollection) {
  const existing = archives.get(collection);
  if (existing) return existing;
  const pending = (async () => {
    const response = await fetch(asset(`data/hadith-${collection}-v${hadithArchiveVersion}.json.gz`));
    if (!response.ok) throw new Error("Collection unavailable");
    const buffer = await response.arrayBuffer();
    const header = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
    const text = header[0] === 0x1f && header[1] === 0x8b
      ? await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
      : new TextDecoder().decode(buffer);
    const data = JSON.parse(text);
    if (data.version !== hadithArchiveVersion || !Array.isArray(data.items)) throw new Error("Unsupported collection");
    return data.items as HadithNarration[];
  })().catch(error => {
    archives.delete(collection);
    throw error;
  });
  archives.set(collection, pending);
  return pending;
}

export function hadithId(collection: string, number: string | number) {
  return `${collection}:${number}`;
}

export function parseHadithId(id: string) {
  const [key, number, extra] = id.split(":");
  if (!number || extra !== undefined || !/^[1-9]\d*(?:[a-z]|\.\d{1,2})?$/.test(number)) return undefined;
  const collection = collectionIds.find(item => item === key);
  return collection ? { collection, number } : undefined;
}

export function hadithSource(narration: HadithNarration) {
  const { collection, number } = narration;
  return number.includes(".") ? editionUrl(collection) : `https://sunnah.com/${collection}:${number}`;
}

export function hadithNumberLabel(number: string | number, language: Language) {
  if (language === "en") return String(number);
  return String(number).replace(/\d/g, digit => "০১২৩৪৫৬৭৮৯"[Number(digit)]);
}

export function hadithName(collection: HadithCollection, language: Language, short = false) {
  return short && language === "en" ? hadithCollections[collection].short : hadithCollections[collection][language];
}

export function normalizeHadithSearch(text: string) {
  return studySearchTerm(text).normalize("NFD").replace(/([\p{Script=Latin}\p{Script=Arabic}])\p{M}+/gu, "$1").normalize("NFC")
    .replace(/[’'ʿʾ]/g, "").replace(/[:#-]+/g, " ").replace(/\s+/g, " ").trim();
}

const aliases = [...collectionIds, "riyadussalihin" as const].map(collection => ({
  collection,
  names: (collection === "riyadussalihin"
    ? ["riyadussalihin", "riyad", "riyad as salihin", "riyad as salihin selections", "রিয়াদুস সালিহিন"]
    : [collection, hadithCollections[collection].en, hadithCollections[collection].bn, hadithCollections[collection].short]
  ).map(normalizeHadithSearch),
}));

function queryReference(query: string) {
  const match = /^(?:(.+) )?([1-9]\d*(?:[a-z]|\.\d{1,2})?)$/.exec(query);
  if (!match) return undefined;
  const collection = match[1] && aliases.find(item => item.names.includes(match[1]))?.collection;
  if (match[1] && !collection) return undefined;
  return { collection, number: match[2] };
}

function matchNumber(number: string, requested: string) {
  return number === requested || /^\d+$/.test(requested) && number.replace(/[a-z]$|\.\d+$/g, "") === requested;
}

export function searchHadith(query: string, narrations: HadithNarration[], scope: CollectionScope) {
  const normalized = normalizeHadithSearch(query);
  const reference = queryReference(normalized);
  const terms = normalized.split(" ").filter(Boolean);
  const matches = scope === "riyadussalihin" ? [] : narrations.filter(narration => {
    if (scope !== "all" && scope !== narration.collection) return false;
    if (reference) return (!reference.collection || reference.collection === narration.collection) && matchNumber(narration.number, reference.number);
    let haystack = searchText.get(narration);
    if (haystack === undefined) {
      const seed = curatedById.get(hadithId(narration.collection, narration.number));
      haystack = normalizeHadithSearch([
        narration.text, narration.arabic, narration.grade.label, narration.grade.grader, ...Object.values(hadithCollections[narration.collection]),
        seed?.summary, seed?.summaryBn, seed?.theme,
      ].filter(Boolean).join(" "));
      searchText.set(narration, haystack);
    }
    return terms.every(term => haystack.includes(term));
  });
  const riyad = scope !== "all" && scope !== "riyadussalihin" ? [] : riyadSelections.flatMap(item => {
    const narration = narrations.find(narration => hadithId(narration.collection, narration.number) === item.original);
    if (!narration) return [];
    const includes = reference
      ? (!reference.collection || reference.collection === "riyadussalihin") && matchNumber(item.number, reference.number)
      : terms.every(term => normalizeHadithSearch(`${item.summary} ${item.summaryBn} riyad as salihin riyadussalihin রিয়াদুস সালিহিন`).includes(term));
    return includes ? [{ ...item, grade: narration.grade }] : [];
  });
  return { matches, riyad };
}

export function curatedGrade(item: CuratedNarration): HadithGrade {
  return { tier: item.grade === "Hasan" ? "hasan" : "sahih", label: item.grade };
}
