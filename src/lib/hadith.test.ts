import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { curatedHadith, curatedHadithFor, desktopHadith, hadithCitation, hadithId, hadithNumberLabel, hadithSource, parseHadithId, riyadSelections, searchHadith, topicMatches } from "./hadith";
import { canonicalHadithNumber, collectionIds, hadithArchiveVersion, narrationGrade, type HadithNarration } from "./hadith-catalogue";
import { message } from "./copy";
import { formatLocale } from "./languagePreferences";

const archive = collectionIds.flatMap(collection => {
  const file = new URL(`../../public/data/hadith-${collection}-v${hadithArchiveVersion}.json.gz`, import.meta.url);
  const source = JSON.parse(gunzipSync(readFileSync(file)).toString()) as { items: HadithNarration[] };
  return source.items;
});
const byId = new Map(archive.map(item => [hadithId(item.collection, item.number), item]));

describe("hadith editions", () => {
  it("preserves edition numbering and turns Muslim variants into their canonical suffixes", () => {
    expect(canonicalHadithNumber("muslim", "2702.01")).toBe("2702a");
    expect(canonicalHadithNumber("muslim", "52.10")).toBe("52j");
    expect(canonicalHadithNumber("muslim", undefined)).toBeUndefined();
    expect(canonicalHadithNumber("bukhari", 402.2)).toBe("402.2");
    expect(parseHadithId("muslim:571a")).toEqual({ collection: "muslim", number: "571a" });
    expect(parseHadithId("muslim:571a:again")).toBeUndefined();
    expect(hadithSource(byId.get("muslim:2702a")!)).toBe("https://sunnah.com/muslim:2702a");
  });

  it("keeps only documented grades and excludes the ungraded introduction to Muslim", () => {
    expect(narrationGrade("muslim", 0, [])).toBeUndefined();
    expect(narrationGrade("bukhari", 1, [])).toEqual({ tier: "sahih", label: "Sahih" });
    expect(narrationGrade("tirmidhi", 48, [])).toBeUndefined();
    expect(narrationGrade("tirmidhi", 48, [
      { name: "first grader", grade: "Sahih" }, { name: "second grader", grade: "Daif" },
    ])).toBeUndefined();
    expect(byId.get("tirmidhi:3540")?.grade).toMatchObject({ tier: "hasan", label: "Hasan", grader: "Bashar Awad Maarouf" });
    expect(archive.filter(item => item.collection === "muslim").every(item => item.book > 0)).toBe(true);
  });

  it("localizes citation digits, collection and grade without dropping suffixes or grader attribution", () => {
    const copy = (nativeDigits: boolean) => {
      const settings = { language: "bn", mode: "adult", nativeDigits } as const;
      return { language: settings.language, locale: formatLocale(settings), direction: "ltr" as const, t: message.bind(null, settings) };
    };
    const source = { source: "Muslim 571a · Sahih", url: "https://sunnah.com/muslim:571a" };
    expect(hadithCitation(source, copy(true))).toEqual({ reference: "মুসলিম ৫৭১a", grade: "সহিহ", full: "মুসলিম ৫৭১a · সহিহ" });
    expect(hadithCitation(source, copy(false)).full).toBe("মুসলিম 571a · সহিহ");
    const graded = { source: "Abu Dawud 1151 · Hasan (Al-Albani)", url: "https://sunnah.com/abudawud:1151" };
    expect(hadithCitation(graded, copy(true)).full).toBe("আবু দাউদ ১১৫১ · হাসান (Al-Albani)");
  });

  it("bundles the verified original references for every curated card and Riyad selection", () => {
    expect(byId.size).toBe(archive.length);
    expect(new Set(archive.map(item => item.collection))).toEqual(new Set(collectionIds));
    for (const reference of curatedHadith) {
      expect(byId.get(hadithId(reference.collection, reference.number))?.text, reference.url).toBeTruthy();
      expect(byId.get(hadithId(reference.collection, reference.number))?.arabic, reference.url).toMatch(/\p{Script=Arabic}/u);
      if (reference.alsoIn) expect(byId.has(reference.alsoIn)).toBe(true);
    }
    for (const reference of riyadSelections) expect(byId.has(reference.original)).toBe(true);
  });

  it("finds references by canonical suffix, local digits, text, and selected Riyad collection", () => {
    const exact = searchHadith("সহিহ মুসলিম ২৭০২a", archive, "all");
    expect(exact.matches.map(item => item.number)).toEqual(["2702a"]);
    expect(exact.matches[0].text).toMatch(/seek forgiveness/i);
    expect(searchHadith("Muslim 2702", archive, "all").matches.map(item => item.number)).toContain("2702b");
    expect(searchHadith(`Muslim ${hadithNumberLabel("2702a", "fa")}`, archive, "all").matches.map(item => item.number)).toEqual(["2702a"]);
    expect(searchHadith("Muslim 2702", archive, "bukhari").matches).toEqual([]);
    expect(searchHadith("প্রতিবেশীর ক্ষতি", archive, "all").matches.some(item => item.number === "6018")).toBe(true);
    expect(searchHadith("Riyad 14", archive, "riyadussalihin").riyad.map(item => item.original)).toEqual(["muslim:2702b"]);
    expect(searchHadith("999999999", archive, "all")).toEqual({ matches: [], riyad: [] });
  });

  it("keeps the desktop topics and highlighted bilingual excerpt attached to their verified references", () => {
    const selected = desktopHadith[0];
    const edition = byId.get(hadithId(selected.collection, selected.number));
    expect(edition?.arabic.normalize()).toContain(selected.excerptAr?.normalize());
    expect(edition?.text).toContain(selected.excerptEn);
    expect(topicMatches("repentance", selected)).toBe(true);
    expect(topicMatches("family", selected)).toBe(false);
    expect(topicMatches("family", curatedHadithFor("bukhari:5971"))).toBe(true);
    expect(topicMatches("knowledge", curatedHadithFor("bukhari:5027"))).toBe(true);
    expect(searchHadith("ذنوبك عنان السماء", [edition!], "all").matches[0]?.number).toBe("3540");
  });
});
