import { readFileSync } from "node:fs";
import { verifyQuranEncEdition } from "./quran-meaning-edition.mjs";

const [editionPath, sourcePath, cataloguePath] = process.argv.slice(2);
if (process.argv.length !== 5) {
  throw new Error("Usage: node scripts/check-quranenc-edition.mjs <edition.json> <original.csv> <publisher-catalogue.json>");
}

const read = path => JSON.parse(readFileSync(path, "utf8"));
const { key, version, sha256 } = verifyQuranEncEdition(read(editionPath), readFileSync(sourcePath), read(cataloguePath));
console.log(`${key} ${version} matches the supplied publisher catalogue and the original CSV (${sha256}).`);
