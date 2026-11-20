import { readFileSync } from "node:fs";
import banglaDraft from "../src/lib/landing-bn.draft.json" with { type: "json" };

const textBindings = /(<([a-z][\w-]*)\b[^<>]* data-landing-copy="(landing\w+)"[^<>]*>)([^<]*)(<\/\2>)/g;
const attributeBindings = /data-landing-(alt|aria-label|content)="(landing\w+)" \1="([^"]*)"/g;
const entities = { amp: "&", quot: '"', "#39": "'", lt: "<", gt: ">" };
const decode = text => text.replace(/&(amp|quot|#39|lt|gt);/g, (_, key) => entities[key]);
export const landingLetterKeys = {
  "Wāw": "landingLetterWaw", "Alif waṣl": "landingLetterAlifWasl", "Lām": "landingLetterLam",
  "ʿAyn": "landingLetterAyn", "Ṣād": "landingLetterSad", "Rāʾ": "landingLetterRa",
  fatha: "landingMarkFatha", Silent: "landingMarkSilent", "sukūn": "landingMarkSukun", kasra: "landingMarkKasra",
};
export const escapeHtml = text => text.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

function visitBindings(html, visit) {
  return html
    .replace(textBindings, (_, start, tag, key, text, end, offset) => start + visit(key, text, offset) + end)
    .replace(attributeBindings, (_, attr, key, text, offset) => `data-landing-${attr}="${key}" ${attr}="${visit(key, text, offset)}"`);
}

export function landingCopyEntries() {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const entries = new Map();
  visitBindings(html, (key, text, offset) => {
    const en = decode(text);
    if (entries.has(key) && entries.get(key).en !== en) throw new Error(`Inconsistent landing copy for ${key}`);
    const line = html.slice(0, offset).split("\n").length;
    const definition = { file: "index.html", line };
    if (!Object.hasOwn(banglaDraft, key)) throw new Error(`Missing Bangla draft for ${key}`);
    if (entries.has(key)) entries.get(key).references.push(definition);
    else entries.set(key, { en, bn: banglaDraft[key], definition, references: [] });
    return text;
  });
  for (const [en, key] of Object.entries(landingLetterKeys)) {
    entries.set(key, { en, bn: banglaDraft[key], definition: { file: "docs/content/word-anatomy.sample.json" }, references: [] });
  }
  for (const key of Object.keys(banglaDraft)) {
    if (!entries.has(key)) throw new Error(`Unused Bangla landing draft ${key}`);
  }
  return entries;
}

export function applyLandingCopy(html, messages) {
  return visitBindings(html, (key, english) => {
    const translated = messages[key];
    return typeof translated === "string" ? escapeHtml(translated) : english;
  });
}

export { banglaDraft };
