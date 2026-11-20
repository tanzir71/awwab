import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { entries, fingerprint, root } from "./ui-catalogue.mjs";

export function publishedLocales() {
  const directory = resolve(root, "public/locales");
  if (!existsSync(directory)) return {};

  const { locales } = JSON.parse(readFileSync(resolve(root, "handovers/H2-languages-paths-arabic-help/data/locales.json"), "utf8"));
  const published = [];
  for (const file of readdirSync(directory).filter(name => name.endsWith(".json")).sort()) {
    const locale = locales.find(item => `${item.code}.json` === file);
    const bytes = readFileSync(resolve(directory, file));
    const pack = JSON.parse(bytes.toString("utf8"));
    if (!locale || pack.version !== 1 || pack.locale !== locale.code || pack.dir !== locale.dir || pack.sourceFingerprint !== fingerprint
      || Object.keys(pack.messages ?? {}).length !== entries.length || entries.some(([key]) => !Object.hasOwn(pack.messages, key))) {
      throw new Error(`${file} does not match the current UI catalogue. Compile the matching reviewed locale before publishing it.`);
    }
    published.push([locale.code, { bytes: bytes.length, digest: createHash("sha256").update(bytes).digest("hex") }]);
  }
  return Object.fromEntries(published);
}
