import { readFile, writeFile } from "node:fs/promises";

const url = "https://api.openstreetmap.org/api/0.6/map.json?bbox=39.823,21.417,39.832,21.426";
const local = process.argv[2];
const response = local ? null : await fetch(url, { signal: AbortSignal.timeout(60000) });
if (response && !response.ok) throw new Error(`OSM extract returned HTTP ${response.status}`);
const data = local ? JSON.parse(await readFile(local, "utf8")) : await response.json();
const elements = new Map(data.elements.map(item => [`${item.type}/${item.id}`, item]));
const picks = [
  { osm: "way/103914569", id: "kaaba", title: "Kaʿbah", zone: "mataf" },
  { osm: "node/4589923995", id: "safa", title: "Ṣafā", zone: "safa" },
  { osm: "node/4589923996", id: "marwah", title: "Marwah", zone: "marwah" },
  { osm: "node/4582731080", id: "haram", title: "Al Haram", zone: "haram" },
  { osm: "node/7727447429", id: "zamzam", title: "Zamzam filling point" },
  { osm: "node/6289846144", id: "wudu-women", title: "Women’s wudu · ground floor" },
  { osm: "node/6289850856", id: "wudu-men", title: "Men’s wudu · ground floor" },
  { osm: "node/5868939385", id: "tawaf-line", title: "Ṭawāf start line" },
];

for (const [osm, item] of elements) {
  const tags = item.tags;
  if (!tags) continue;
  const name = tags["name:en"] ?? tags.name;
  const namedGate = tags["name:en"] || tags["name:ar"] || tags.name;
  if (item.type === "node" && tags.entrance && tags.ref && namedGate) {
    picks.push({ osm, id: `gate-${item.id}`, title: tags["name:en"] ?? `Gate ${tags.ref}`, arabic: /\p{Script=Arabic}/u.test(namedGate) ? namedGate : undefined });
  }
  if (item.type === "way" && /^(Makkah Royal Clock Tower|Abraj Al Bait Clock Tower|Abraj Al Bait)$/i.test(name ?? "")) {
    picks.push({ osm, id: "clock-tower", title: "Clock Tower" });
  }
}

function center(element) {
  if (!element) return null;
  if (element.type === "node") return { lat: element.lat, lon: element.lon };
  const nodes = [...new Set(element.nodes ?? [])].map(id => elements.get(`node/${id}`)).filter(Boolean);
  if (!nodes.length) return null;
  return {
    lat: nodes.reduce((sum, node) => sum + node.lat, 0) / nodes.length,
    lon: nodes.reduce((sum, node) => sum + node.lon, 0) / nodes.length,
  };
}

const pins = picks.flatMap(pick => {
  const point = center(elements.get(pick.osm));
  return point ? [{ ...pick, point }] : [];
});
if (!["safa", "marwah", "haram", "kaaba"].every(id => pins.some(pin => pin.id === id))) {
  throw new Error("Missing a required Haram feature in the OSM extract.");
}
await writeFile(new URL("../public/data/umrah-osm-v1.json", import.meta.url), JSON.stringify({
  version: 1,
  source: url,
  attribution: "© OpenStreetMap contributors",
  license: "https://www.openstreetmap.org/copyright",
  pins,
}, null, 2) + "\n");
