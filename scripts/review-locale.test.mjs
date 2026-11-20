import { createHash } from "node:crypto";
import { mkdtempSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { reviewLocale } from "./review-locale.mjs";
import { fingerprint } from "./ui-catalogue.mjs";

const directory = mkdtempSync(join(tmpdir(), "awwab-review-"));
const path = join(directory, "review.json");
afterAll(() => {
  rmSync(path, { force: true });
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
});
