import { openSync, closeSync, readFileSync, readSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalogue from "../../public/packs/audio/index.json";
import onboarding from "../../docs/content/onboarding.json";
import rituals from "../../docs/content/umrah-steps.json";
import { quranText } from "./quran";
import { askAudioPack, askClipIds, askPackPaths, askPlaybackVoice, askVoiceInstalled, packVoices } from "./umrahAskAudio";
import { askClipPath, askPhrase, renderAsk } from "./umrahAsk";
import { asset } from "./config";
import { speakCourses, speakLessonContent, speakUnitNumber } from "./speakCurriculum";
import { hasSharedSpeakAudio, placementSpeakPhraseIds, sharedSpeakClips } from "./speakAskAudio";
import { umrahGuidePack, umrahGuidePacks } from "./umrahGuideAudio";

describe("Generated Umrah narration", () => {
  it("pairs all seven steps and transcripts with size-checked clips in both languages", () => {
    expect(umrahGuidePacks.map(pack => pack.language)).toEqual(["en", "bn"]);
    expect(rituals.steps).toHaveLength(7);
    for (const pack of umrahGuidePacks) {
      expect(pack.items.map(item => item.ref)).toEqual(rituals.steps.map(step => `${pack.id}:${step.id}`));
      let bytes = 0;
      for (const [index, step] of rituals.steps.entries()) {
        const item = pack.items[index];
        expect(item.path).toBe(`packs/audio/umrah-guide-v1/${pack.language}/${step.id}.mp3`);
        const file = readFileSync(new URL(`../../public/${item.path}`, import.meta.url));
        expect(file.subarray(0, 3).toString("ascii")).toBe("ID3");
        expect(file.length).toBeGreaterThan(4096);
        expect(step.narration[pack.language]).toBeTruthy();
        expect(step.notesBn?.length ?? 0).toBe(step.notes?.length ?? 0);
        bytes += file.length;
      }
      expect(bytes).toBe(pack.bytes);
    }
    expect(umrahGuidePack("ur").language).toBe("en");
  });
});

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
      if (!("pack" in sample)) continue;
      const pack = catalogue.packs.find(item => item.id === sample.pack);
      expect(pack?.items).toContainEqual({ ref, path: sample.path });
    }
    const shareAlike = catalogue.packs.filter(pack => pack.licenseUrl === "https://creativecommons.org/licenses/by-sa/4.0/");
    expect(shareAlike.map(pack => pack.id)).toEqual([105, 106, 112, 113, 114].map(number => `aaqib-${number}`));
    expect(shareAlike.every(pack => pack.attribution.includes("trimmed and re-encoded"))).toBe(true);
  });

  it("bundles generated letter prompts alongside the recitation excerpts", () => {
    const samples = Object.values(onboarding.samples).filter(sample => "generated" in sample);
    expect(samples).toHaveLength(4);
    for (const sample of samples) expect(statSync(new URL(`../../public/${sample.path}`, import.meta.url)).size).toBeGreaterThan(500);
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
    expect(askAudioPack).toBeDefined();
    expect(packVoices).toEqual(askAudioPack.version === 2 ? ["female", "male"] : ["female"]);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.filter(path => /\/number-\d+\.opus$/.test(path))).toHaveLength(2 * 300 * packVoices.length);
  });

  it("checks the published recording files and pack size", () => {
    const bytes = { female: 0, male: 0 };
    for (const path of askPackPaths()) {
      const file = new URL(`../../public/${path}`, import.meta.url);
      const fd = openSync(file, "r");
      try {
        const header = Buffer.alloc(4);
        readSync(fd, header);
        expect(header.toString()).toBe("OggS");
        const voice = path.split("/")[3] as keyof typeof bytes;
        bytes[voice] += statSync(file).size;
      } finally { closeSync(fd); }
    }
    expect(bytes.female + bytes.male).toBe(askAudioPack?.bytes);
    if (askAudioPack.version === 2) {
      for (const voice of packVoices) {
        expect(askAudioPack.credits[voice].bytes).toBe(bytes[voice]);
        expect(askAudioPack.credits[voice].source).toMatch(/^https:\/\/huggingface\.co\//);
      }
      for (const variety of ["saudi", "msa"] as const) {
        const female = readFileSync(new URL(`../../public/${askClipPath(variety, "female", "toilet")}`, import.meta.url));
        const male = readFileSync(new URL(`../../public/${askClipPath(variety, "male", "toilet")}`, import.meta.url));
        expect(male.equals(female)).toBe(false);
      }
    }
  });

  it("keeps the first download playable during the upgrade", () => {
    expect(askVoiceInstalled(0, "female")).toBe(false);
    expect(askVoiceInstalled(1, "female")).toBe(true);
    expect(askVoiceInstalled(1, "male")).toBe(false);
    expect(askPlaybackVoice(1, "male")).toBe("female");
    const hasSecondVoice = askAudioPack.version === 2;
    expect(askVoiceInstalled(2, "female")).toBe(hasSecondVoice);
    expect(askVoiceInstalled(2, "male")).toBe(hasSecondVoice);
    expect(askPlaybackVoice(2, "male")).toBe(hasSecondVoice ? "male" : "female");
  });
});

describe("Speak lesson recordings", () => {
  it.each([
    ["saudi-hijazi", "A2", 14, 4, 2],
    ["saudi-hijazi", "B1", 12, 6, 3],
    ["saudi-hijazi", "umrah-hajj", 9, 4, 2],
    ["gulf", "A1", 12, 4, 2],
    ["gulf", "gulf-work", 10, 4, 2],
    ["msa", "A1", 12, 4, 2],
  ] as const)("includes generated %s %s dialogue, vocabulary and signs", (variety, level, count, linesPerUnit, wordsPerUnit) => {
    const files = new Set<string>();
    const units = speakCourses[variety][level];
    expect(units).toHaveLength(count);
    for (const [index, unit] of units.entries()) {
      const { lines, words, clips } = speakLessonContent(unit);
      expect(unit.variety).toBe(variety);
      expect(speakUnitNumber(unit)).toBe(index + 1);
      expect(lines).toHaveLength(linesPerUnit);
      expect(words).toHaveLength(wordsPerUnit);
      for (const href of Object.values(clips)) {
        const path = href.slice(asset("").length);
        expect(files.has(path), path).toBe(false);
        files.add(path);
        const clip = readFileSync(new URL(`../../public/${path}`, import.meta.url));
        expect(clip.length, path).toBeGreaterThan(500);
        expect(clip.subarray(0, 4).toString()).toBe("OggS");
        expect(clip.subarray(0, 95).includes("OpusHead")).toBe(true);
      }
    }
    expect(files.size).toBe(count * (linesPerUnit + wordsPerUnit + 1));
  });

  it("uses the same Saudi phrases and recordings in Speak and Ask in Arabic", () => {
    const shared = new Set(sharedSpeakClips);
    const packPaths = new Set(askPackPaths());
    for (const id of placementSpeakPhraseIds) {
      expect(hasSharedSpeakAudio([id], "saudi", "female")).toBe(true);
      const path = askClipPath("saudi", "female", id);
      expect(shared.has(path)).toBe(true);
      expect(packPaths.has(path)).toBe(true);
    }
    for (const unit of speakCourses["saudi-hijazi"]["umrah-hajj"]) {
      const { lines } = speakLessonContent(unit);
      const ids = [lines[0].askId, lines[2].askId];
      expect(hasSharedSpeakAudio(ids, "saudi", "female")).toBe(true);
      expect(hasSharedSpeakAudio(ids, "msa", "female")).toBe(false);
      expect(hasSharedSpeakAudio(ids, "saudi", "male")).toBe(false);
      expect(lines[1].askId).toBeUndefined();
      expect(lines[3].askId).toBeUndefined();
      for (const line of [lines[0], lines[2]]) {
        const phrase = askPhrase(line.askId);
        const { ar, tr, en } = renderAsk(phrase, "saudi");
        expect([line.ar, line.tr, ...line.meaning]).toEqual([ar, tr, en, phrase.bn]);
        expect(askClipIds(phrase, { variety: "saudi" })).toEqual([phrase.id]);
        expect(line.clip).toBe(askClipPath("saudi", "female", phrase.id));
        expect(shared.has(line.clip)).toBe(true);
        expect(packPaths.has(line.clip)).toBe(true);
      }
    }
  });
});
