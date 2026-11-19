import { db } from "./storageService";
import { asset } from "./config";

export interface AudioEntry {
  ref: string;
  path: string;
}
export interface AudioPack {
  id: string;
  name: string;
  speaker: string;
  attribution: string;
  source: string;
  licenseUrl: string;
  bytes: number;
  items: AudioEntry[];
}

export const audioCache = "awwab-packs-v1";

export async function listAudioPacks(signal?: AbortSignal) {
  const response = await fetch(asset("packs/audio/index.json"), { signal });
  if (!response.ok) throw new Error("Audio pack index unavailable");
  return (await response.json()).packs as AudioPack[];
}

export async function downloadAudioPack(pack: AudioPack, onProgress: (done: number, total: number) => void) {
  const cache = await caches.open(audioCache);
  const files: { ref: string; url: string }[] = [];
  for (const item of pack.items) {
    if (!/^packs\/audio\/[\w./-]+\.(mp3|m4a|ogg|wav|webm)$/i.test(item.path) || item.path.includes("..")) {
      throw new Error("Audio pack path is invalid");
    }
    const url = new URL(asset(item.path), location.origin).href;
    const existing = await cache.match(url);
    if (!existing) {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("audio/")) throw new Error("Audio file is unavailable");
      await cache.put(url, response);
    }
    files.push({ ref: item.ref, url });
    onProgress(files.length, pack.items.length);
  }
  const clips = await Promise.all(files.map(async file => {
    const response = await cache.match(file.url);
    if (!response) throw new Error("Audio was not saved");
    const blob = await response.blob();
    return { ref: file.ref, blob, title: pack.speaker, attribution: pack.attribution };
  }));
  await db.transaction("rw", db.audio, async () => {
    const saved = await db.audio.bulkGet(clips.map(clip => clip.ref));
    await db.audio.bulkAdd(clips.filter((_clip, index) => !saved[index]));
  });
}
