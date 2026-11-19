import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import { join } from "node:path";
import { coreVocabulary, coreWordKey, parseCorpus } from "../src/lib/morphology.ts";

const corpus = "https://raw.githubusercontent.com/cltk/arabic_morphology_quranic-corpus/b5abd4d8fadd775f3329f34cbe10531fac71e391/quranic-corpus-morphology-0.4.txt";
const folder = process.env.AWWAB_CONTENT_DIR;
const folderUrl = new URL("../public/data/", import.meta.url);
const bundled = new URL("qac-morphology-0.4.txt.gz", folderUrl);
const fromBundled = process.argv.includes("--from-bundled");
let text: Buffer;
if (fromBundled) text = gunzipSync(await readFile(bundled));
else if (folder) text = await readFile(join(folder, "quranic-corpus-morphology-0.4.txt"));
else {
  const response = await fetch(corpus, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Morphology source returned HTTP ${response.status}`);
  text = Buffer.from(await response.arrayBuffer());
}
const data = text.toString("utf8");
if (!data.includes("Copyright (C) 2011 Kais Dukes") || !data.includes("GNU General Public License") || !data.includes("(114:6:3:")) {
  throw new Error("The morphology file is incomplete or has an unexpected copyright notice.");
}
const parsed = parseCorpus(data);
const vocabulary = coreVocabulary(parsed.vocabulary);
const fatiha = Object.fromEntries([...parsed.positions].filter(([ref]) => ref.startsWith("1:")).map(([ref, word]) => [ref, {
  key: coreWordKey(word), lemma: word.lemma, root: word.root,
}]));
const snapshot = {
  source: "Quranic Arabic Corpus morphology 0.4, Kais Dukes, GNU GPL",
  sourceUrl: "https://corpus.quran.com/download/",
  words: vocabulary.map(item => item.key),
  occurrences: vocabulary.reduce((count, item) => count + item.count, 0),
  corpusWords: parsed.positions.size,
  fatiha,
};
if (!fromBundled) {
  await mkdir(folderUrl, { recursive: true });
  await writeFile(bundled, gzipSync(text));
}
await writeFile(new URL("../docs/content/core-quran-words.json", import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
