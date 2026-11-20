import { asset } from "./config";
import type { HadithCollection } from "./hadith-catalogue";
import { indopakSplitVerses } from "./quranWordPositions";

type CheckedAsset = { bytes: number; digest: string };
type PackFont = CheckedAsset & { path: string; family: string; unicodeRange: string; weight: string };
type PackAsset = CheckedAsset & { fonts: PackFont[]; readingFont?: PackFont };
type PackMessages = Record<string, string | { adult: string; maktab: string }>;
type TranslationAttribution = { credit: string; source: string; license: string; licenseUrl: string };
type WordScript = "uthmani" | "indopak";
export type WordGloss = { gloss: string; glossLanguage: string;
  glossCredit?: Pick<TranslationAttribution, "credit" | "source"> & { location: string; script: WordScript } };
type QuranMeaningEdition = TranslationAttribution & { verses: Record<string, string> };
type QuranWordEdition = TranslationAttribution & { words: Record<string, string>; indopak?: Record<string, string> };
type HadithMeaningEdition = TranslationAttribution & { narrations: Record<string, { book: number; inBook: number; text: string }> };
type LocalePack = { messages: PackMessages; quran?: QuranMeaningEdition; quranWords?: QuranWordEdition; hadith?: Partial<Record<HadithCollection, HadithMeaningEdition>> };
declare const __AWWAB_PUBLISHED_LOCALES__: Record<string, PackAsset>;

const published = typeof __AWWAB_PUBLISHED_LOCALES__ === "undefined" ? {} : __AWWAB_PUBLISHED_LOCALES__;
const packsByLocale = new Map<string, LocalePack>();
const activeFonts = new Set<string>();
const cacheName = "awwab-locales";

export function localePackAsset(code: string): PackAsset | undefined {
  return Object.prototype.hasOwnProperty.call(published, code) ? published[code] : undefined;
}

export function hasLocaleMessages(code: string) {
  return packsByLocale.has(code);
}

export function hasLoadedLocalePack(code: string) {
  return hasLocaleMessages(code) && localePackAsset(code)?.fonts.every(font => activeFonts.has(checkedUrl(font.path, font)));
}

export function localeMessage(code: string, key: string, mode: "adult" | "maktab") {
  const catalogue = packsByLocale.get(code)?.messages;
  if (!catalogue || !Object.prototype.hasOwnProperty.call(catalogue, key)) return undefined;
  const value = catalogue[key];
  return typeof value === "string" ? value : value[mode];
}

export function localeQuranEdition(code: string) {
  return packsByLocale.get(code)?.quran;
}

export function localeQuranWordEdition(code: string) {
  return packsByLocale.get(code)?.quranWords;
}

export function localeQuranWordGloss(code: string, verse: string, position: number, script: WordScript): WordGloss | undefined {
  const edition = localeQuranWordEdition(code);
  const location = `${verse}:${position}`;
  const words = script === "indopak" && indopakSplitVerses.has(verse) ? edition?.indopak : edition?.words;
  const gloss = words?.[location];
  if (gloss) return { gloss, glossLanguage: code, glossCredit: { credit: edition.credit, source: edition.source, location, script } };
}

export function localeHadithEditions(code: string) {
  return packsByLocale.get(code)?.hadith;
}

function checkedUrl(path: string, info: CheckedAsset) {
  return new URL(asset(`${path}?v=${info.digest}`), location.origin).href;
}

function packUrl(code: string, info: PackAsset) {
  return checkedUrl(`locales/${encodeURIComponent(code)}.json`, info);
}

async function checkedBytes(response: Response, info: CheckedAsset) {
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== info.bytes) throw new Error("Locale pack is incomplete");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== info.digest) throw new Error("Locale pack changed");
  return bytes;
}

async function loadAsset(cache: Cache, url: string, info: CheckedAsset, download: boolean) {
  const stored = await cache.match(url);
  if (stored) {
    try { return await checkedBytes(stored, info); }
    catch { await cache.delete(url); }
  }
  if (!download) return;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("Locale pack is unavailable");
  const bytes = await checkedBytes(response.clone(), info);
  await cache.put(url, response);
  return bytes;
}

async function loadFont(cache: Cache, font: PackFont, download: boolean) {
  const url = checkedUrl(font.path, font);
  if (activeFonts.has(url)) return true;
  const bytes = await loadAsset(cache, url, font, download);
  if (!bytes) return false;
  const face = await new FontFace(font.family, bytes, { weight: font.weight, unicodeRange: font.unicodeRange }).load();
  if (!activeFonts.has(url)) {
    document.fonts.add(face);
    activeFonts.add(url);
  }
  return true;
}

export function hasLocaleReadingFont(code: string) {
  const font = localePackAsset(code)?.readingFont;
  return Boolean(font && activeFonts.has(checkedUrl(font.path, font)));
}

export async function loadLocaleReadingFont(code: string, download = false) {
  const font = localePackAsset(code)?.readingFont;
  return font ? loadFont(await caches.open(cacheName), font, download) : false;
}

export async function installedLocalePacks() {
  if (!Object.keys(published).length || !("caches" in globalThis)) return new Set<string>();
  const cache = await caches.open(cacheName);
  const downloaded = new Set((await cache.keys()).map(request => request.url));
  return new Set(Object.entries(published).filter(([code, info]) => downloaded.has(packUrl(code, info))
    && info.fonts.every(font => downloaded.has(checkedUrl(font.path, font)))).map(([code]) => code));
}

export async function loadLocalePack(code: string, download = false) {
  if (download ? hasLoadedLocalePack(code) : hasLocaleMessages(code)) return true;
  const info = localePackAsset(code);
  if (!info) return false;

  const cache = await caches.open(cacheName);
  const catalogue = await loadAsset(cache, packUrl(code, info), info, download);
  if (!catalogue) return false;
  for (const font of info.fonts) {
    await loadFont(cache, font, download);
  }
  packsByLocale.set(code, JSON.parse(new TextDecoder().decode(catalogue)) as LocalePack);
  return true;
}
