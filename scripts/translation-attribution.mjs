export const present = value => typeof value === "string" && Boolean(value.trim());
export const https = value => present(value) && URL.canParse(value) && new URL(value).protocol === "https:";

export function checkTranslationAttribution(edition) {
  const { credit, source, license, licenseUrl } = edition ?? {};
  if (!present(credit) || !https(source) || !present(license) || !https(licenseUrl)) {
    throw new Error("A translation edition requires a translator credit, source URL, and redistribution terms.");
  }
  return { credit, source, license, licenseUrl };
}
