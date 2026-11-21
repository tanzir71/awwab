import { readFileSync } from "node:fs";
import inventory from "../handovers/H2-languages-paths-arabic-help/data/locales.json" with { type: "json" };
import { validateLocaleMessages } from "./locale-messages.mjs";
import { localePackAsset } from "./published-locales.mjs";
import { checkQuranMeaningEdition } from "./quran-meaning-edition.mjs";
import { https } from "./translation-attribution.mjs";
import { entries, fingerprint } from "./ui-catalogue.mjs";

export function reviewLocale(path, base, quranPath) {
  if (!path) throw new Error("Set AWWAB_REVIEW_CATALOGUE to a draft JSON file from export-locale-review.mjs.");
  const review = JSON.parse(readFileSync(path, "utf8"));
  const locale = inventory.locales.find(item => item.code === review.locale?.code);
  if (review._status !== "draft" || !locale) throw new Error("Choose an exported draft catalogue for a language in the inventory.");
  if (review.sourceFingerprint !== fingerprint) throw new Error("The draft belongs to a different source catalogue. Export a new review file for this checkout.");

  const sourceMessages = Object.fromEntries(entries.map(([key, entry]) => [key, entry.en]));
  const translations = review.messages ?? {};
  validateLocaleMessages(sourceMessages, translations, { allowMissing: true });
  // Omit missing entries so the app uses its usual English and built-in fallbacks.
  const messages = Object.fromEntries(Object.entries(translations).filter(([, text]) => text != null));
  if (!Object.keys(messages).length) throw new Error("Add a translation before building the review preview.");

  const { code, dir } = locale;
  let quran;
  if (quranPath) {
    const draft = JSON.parse(readFileSync(quranPath, "utf8"));
    if (draft?._status !== "draft" || draft.locale !== code || !https(draft.sourceTerms)) {
      throw new Error("Choose a Quran review draft in the catalogue’s language with a publisher terms link.");
    }
    quran = checkQuranMeaningEdition({ ...draft, license: new URL(draft.sourceTerms).hostname, licenseUrl: draft.sourceTerms }, code);
  }
  const pack = { version: 1, locale: code, dir, sourceFingerprint: fingerprint, reviewOnly: true, messages, ...(quran && { quran }) };
  const contents = Buffer.from(JSON.stringify(pack) + "\n");
  const fileName = `locales/${code}.json`;
  return {
    code, pack, asset: localePackAsset(contents, locale),
    plugin: {
      name: "awwab-draft-locale",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const url = request.url?.split("?", 1)[0];
          if (url !== base + fileName && url !== "/" + fileName) return next();
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(contents);
        });
      },
      generateBundle() {
        this.emitFile({ type: "asset", fileName, source: contents });
      },
    },
  };
}
