import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const corpus = "https://raw.githubusercontent.com/cltk/arabic_morphology_quranic-corpus/b5abd4d8fadd775f3329f34cbe10531fac71e391/quranic-corpus-morphology-0.4.txt";
const folder = process.env.AWWAB_CONTENT_DIR;
let text: Buffer;
if (folder) text = await readFile(join(folder, "quranic-corpus-morphology-0.4.txt"));
else {
  const response = await fetch(corpus, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Morphology source returned HTTP ${response.status}`);
  text = Buffer.from(await response.arrayBuffer());
}
const data = text.toString("utf8");
if (!data.includes("Copyright (C) 2011 Kais Dukes") || !data.includes("GNU General Public License") || !data.includes("(114:6:3:")) {
  throw new Error("The morphology file is incomplete or has an unexpected copyright notice.");
}
const folderUrl = new URL("../public/data/", import.meta.url);
await mkdir(folderUrl, { recursive: true });
await writeFile(new URL("qac-morphology-0.4.txt.gz", folderUrl), gzipSync(text));
