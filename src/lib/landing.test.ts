import { describe, expect, it } from "vitest";
import { applyLandingCopy, landingCopyEntries } from "../../scripts/landing-copy.mjs";

describe("landing translations", () => {
  it("exports the same landing link labels and metadata for the review and page builds", () => {
    const entries = landingCopyEntries();
    expect(entries.get("landingNavOffline")).toMatchObject({ en: "Offline & private", bn: "অফলাইন ও ব্যক্তিগত" });
    expect(entries.get("landingLanguageLabel")?.definition.file).toBe("index.html");
    expect(entries.get("landingMarkSilent")).toMatchObject({ en: "Silent", bn: "উচ্চারিত হয় না" });
  });

  it("renders translations as text and preserves content without a translation", () => {
    const html = '<h1 data-landing-copy="landingTitle">English</h1>'
      + '<img data-landing-alt="landingAlt" alt="English image">'
      + '<blockquote lang="en">Sourced English quote</blockquote>';
    const localized = applyLandingCopy(html, { landingTitle: "<script> & copy", landingAlt: '"Image"' });
    expect(localized).toContain('>&lt;script&gt; &amp; copy</h1>');
    expect(localized).toContain('alt="&quot;Image&quot;"');
    expect(localized).toContain('<blockquote lang="en">Sourced English quote</blockquote>');
  });
});
