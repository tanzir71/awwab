import { asset } from "./config";

type PackAsset = { bytes: number; digest: string };
type PackMessages = Record<string, string | { adult: string; maktab: string }>;
declare const __AWWAB_PUBLISHED_LOCALES__: Record<string, PackAsset>;

const published = typeof __AWWAB_PUBLISHED_LOCALES__ === "undefined" ? {} : __AWWAB_PUBLISHED_LOCALES__;
const messagesByLocale = new Map<string, PackMessages>();
const cacheName = "awwab-locales";

export function localePackAsset(code: string): PackAsset | undefined {
  return Object.prototype.hasOwnProperty.call(published, code) ? published[code] : undefined;
}

export function hasLocaleMessages(code: string) {
  return messagesByLocale.has(code);
}

export function localeMessage(code: string, key: string, mode: "adult" | "maktab") {
  const catalogue = messagesByLocale.get(code);
  if (!catalogue || !Object.prototype.hasOwnProperty.call(catalogue, key)) return undefined;
  const value = catalogue[key];
  return typeof value === "string" ? value : value[mode];
}

function packUrl(code: string, info: PackAsset) {
  return new URL(asset(`locales/${encodeURIComponent(code)}.json?v=${info.digest}`), location.origin).href;
}

async function readPack(response: Response, info: PackAsset) {
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== info.bytes) throw new Error("Locale pack is incomplete");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== info.digest) throw new Error("Locale pack changed");
  return JSON.parse(new TextDecoder().decode(bytes)).messages as PackMessages;
}

export async function installedLocalePacks() {
  if (!Object.keys(published).length || !("caches" in globalThis)) return new Set<string>();
  const cache = await caches.open(cacheName);
  const downloaded = new Set((await cache.keys()).map(request => request.url));
  return new Set(Object.keys(published).filter(code => downloaded.has(packUrl(code, published[code]))));
}

export async function loadLocalePack(code: string, download = false) {
  if (hasLocaleMessages(code)) return true;
  const info = localePackAsset(code);
  if (!info) return false;

  const url = packUrl(code, info);
  const cache = await caches.open(cacheName);
  const stored = await cache.match(url);
  if (stored) {
    try {
      messagesByLocale.set(code, await readPack(stored, info));
      return true;
    } catch {
      await cache.delete(url);
    }
  }
  if (!download) return false;

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("Locale pack is unavailable");
  const catalogue = await readPack(response.clone(), info);
  await cache.put(url, response);
  messagesByLocale.set(code, catalogue);
  return true;
}
