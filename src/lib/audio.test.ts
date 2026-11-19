import { openSync, closeSync, readSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalogue from "../../public/packs/audio/index.json";
import onboarding from "../../docs/content/onboarding.json";
import { quranText } from "./quran";
import { askClipIds, askPackPaths, reviewedAskAudio } from "./umrahAskAudio";
import { askPhrase } from "./umrahAsk";

describe("Bundled recitation packs", () => {
  it("has one attributed recording for the surah and every numbered ayah", () => {
    expect(catalogue.packs.map(pack => pack.id)).toEqual(Object.keys(quranText).map(number => `aaqib-${number}`));
    for (const pack of catalogue.packs) {
      const number = pack.id.slice("aaqib-".length);
      expect(pack.items.map(item => item.ref)).toEqual([`surah:${number}`, ...quranText[number].map(verse => verse.ref)]);
      expect(pack.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
      const size = pack.items.reduce((sum, item) => sum + statSync(new URL(`../../public/${item.path}`, import.meta.url)).size, 0);
      expect(size).toBe(pack.bytes);
    }
  });

  it("uses cited catalogue excerpts for the starter recitations", () => {
    for (const [ref, sample] of Object.entries(onboarding.samples)) {
      const pack = catalogue.packs.find(item => item.id === sample.pack);
      expect(pack?.items).toContainEqual({ ref, path: sample.path });
    }
    const shareAlike = catalogue.packs.filter(pack => pack.licenseUrl === "https://creativecommons.org/licenses/by-sa/4.0/");
    expect(shareAlike.map(pack => pack.id)).toEqual([105, 106, 112, 113, 114].map(number => `aaqib-${number}`));
    expect(shareAlike.every(pack => pack.attribution.includes("trimmed and re-encoded"))).toBe(true);
  });
});

describe("Umrah phrase recordings", () => {
  it("addresses the saved gate number and applicable grammar variants", () => {
    expect(askClipIds(askPhrase("gate-number"), { variety: "saudi", gate: 300 })).toEqual(["gate-number", "number-300"]);
    expect(askClipIds(askPhrase("bus-to"), { variety: "msa", place: "jeddah" })).toEqual(["bus-to-jeddah"]);
    expect(askClipIds(askPhrase("lost-family"), { variety: "saudi", relation: "wife" })).toEqual(["lost-family-wife"]);
    expect(askClipIds(askPhrase("excuse-me"), { variety: "saudi", toFemale: true })).toEqual(["excuse-me-to-woman"]);
    expect(askClipIds(askPhrase("excuse-me"), { variety: "msa", toFemale: true })).toEqual(["excuse-me"]);
  });

  it("defines all voice and gate files without duplicates", () => {
    const paths = askPackPaths();
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.filter(path => /\/number-\d+\.opus$/.test(path))).toHaveLength(1200);
  });

  it.skipIf(!reviewedAskAudio)("checks the published recording files and pack size", () => {
    let size = 0;
    for (const path of askPackPaths()) {
      const file = new URL(`../../public/${path}`, import.meta.url);
      const fd = openSync(file, "r");
      try {
        const header = Buffer.alloc(4);
        readSync(fd, header);
        expect(header.toString()).toBe("OggS");
        size += statSync(file).size;
      } finally { closeSync(fd); }
    }
    expect(size).toBe(reviewedAskAudio.bytes);
  });
});
