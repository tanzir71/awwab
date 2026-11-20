import { asset } from "./config";

export const mapPacks = { makkah: 1_746_752, madinah: 1_730_580 } as const;
export type MapRegion = keyof typeof mapPacks;
export const mapRegions = Object.keys(mapPacks) as MapRegion[];

const cacheName = "awwab-packs-v1";
const filename = (region: MapRegion) => `${region}-v1.pmtiles`;
const mapUrl = (region: MapRegion) => new URL(asset(`packs/${filename(region)}`), location.origin).href;

export async function cachedMapPack(region: MapRegion) {
  if (!("caches" in window)) return undefined;
  const response = await (await caches.open(cacheName)).match(mapUrl(region));
  return response?.ok ? new File([await response.blob()], filename(region)) : undefined;
}

export async function saveMapPack(region: MapRegion, imported?: File) {
  const url = mapUrl(region);
  const { FileSource, PMTiles, TileType } = await import("pmtiles");
  const response = imported ? new Response(imported) : await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error("Map pack unavailable");
  const blob = await response.blob();
  const file = new File([blob], filename(region));
  const header = await new PMTiles(new FileSource(file)).getHeader();
  if (header.tileType !== TileType.Mvt) throw new Error("The map requires a vector PMTiles pack");
  await (await caches.open(cacheName)).put(url, new Response(blob, { headers: { "Content-Type": "application/octet-stream" } }));
  return file;
}
