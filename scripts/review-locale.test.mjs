import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { reviewLocale } from "./review-locale.mjs";
import { fingerprint } from "./ui-catalogue.mjs";

const directory = mkdtempSync(join(tmpdir(), "awwab-review-"));
const path = join(directory, "review.json");
const quranPath = join(directory, "quran.json");
afterAll(() => {
  rmSync(path, { force: true });
  rmSync(quranPath, { force: true });
  rmdirSync(directory);
});

function draft(fields) {
  writeFileSync(path, JSON.stringify({
    _status: "draft", locale: { code: "id" }, sourceFingerprint: fingerprint, ...fields,
  }));
  return path;
}

describe("local locale review builds", () => {
  it("emits translated messages with verifiable metadata and keeps missing strings out of the pack", () => {
    const review = reviewLocale(draft({ messages: { settingsLanguageTitle: "Bahasa", aboutAwwab: null } }), "/awwab/");
    const emitFile = vi.fn();
    review.plugin.generateBundle.call({ emitFile });
    const [file] = emitFile.mock.calls[0];
    expect(file.fileName).toBe("locales/id.json");
    expect(JSON.parse(file.source)).toMatchObject({ locale: "id", reviewOnly: true, messages: { settingsLanguageTitle: "Bahasa" } });
    expect(review.pack.messages).not.toHaveProperty("aboutAwwab");
    expect(review.asset.bytes).toBe(file.source.length);
    expect(review.asset.digest).toBe(createHash("sha256").update(file.source).digest("hex"));
  });

  it("rejects a draft from a different source catalogue", () => {
    const path = draft({ sourceFingerprint: "old", messages: { aboutAwwab: "Tentang Awwab" } });
    expect(() => reviewLocale(path, "/awwab/")).toThrow("different source catalogue");
  });

  it("checks the ICU arguments in translated entries", () => {
    const path = draft({ messages: { settingsLanguageSearch: "Cari bahasa" } });
    expect(() => reviewLocale(path, "/awwab/")).toThrow("settingsLanguageSearch: Keep the required ICU arguments");
  });

  it("validates and packs a matching Quran draft with its source material for local review", () => {
    const ui = draft({ messages: { aboutAwwab: "Tentang Awwab" } });
    const { chapters } = JSON.parse(readFileSync(new URL("../public/data/quran-study-index-v1.json", import.meta.url), "utf8"));
    const verses = Object.fromEntries(chapters.flatMap(({ number, ayahs }) =>
      Array.from({ length: ayahs }, (_, i) => [`${number}:${i + 1}`, "Draft meaning"])));
    const edition = { _status: "draft", locale: "id", credit: "Candidate edition", source: "https://example.com/quran",
      sourceTerms: "https://example.com/terms", verses, footnotes: { "1:1": "First line\nSecond line" },
      sourceNotice: "Publisher notice", sourceVersion: "v1.0.1-csv.1" };
    writeFileSync(quranPath, JSON.stringify(edition));
    const { pack } = reviewLocale(ui, "/awwab/", quranPath);
    expect(pack).toMatchObject({ reviewOnly: true, quran: { verses, footnotes: edition.footnotes, sourceNotice: edition.sourceNotice,
      sourceVersion: edition.sourceVersion, licenseUrl: edition.sourceTerms } });

    writeFileSync(quranPath, JSON.stringify({ ...edition, locale: "ur" }));
    expect(() => reviewLocale(ui, "/awwab/", quranPath)).toThrow("in the catalogue’s language");
  });
});
