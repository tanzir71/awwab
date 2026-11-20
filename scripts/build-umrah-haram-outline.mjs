import { readFile, writeFile } from "node:fs/promises";

const relationId = 1472531;
const source = `https://api.openstreetmap.org/api/0.6/relation/${relationId}/full.json`;
const local = process.argv[2];
const response = local ? null : await fetch(source, { signal: AbortSignal.timeout(30_000) });
if (response && !response.ok) throw new Error(`OSM relation returned HTTP ${response.status}`);
const data = local ? JSON.parse(await readFile(local, "utf8")) : await response.json();
const relation = data.elements.find(item => item.type === "relation" && item.id === relationId);
if (!relation) throw new Error("The Haram relation is missing from the extract");

const ways = new Map(data.elements.filter(item => item.type === "way").map(item => [item.id, item.nodes]));
const nodes = new Map(data.elements.filter(item => item.type === "node").map(item => [item.id, [item.lat, item.lon]]));
const outer = relation.members.filter(member => member.type === "way" && member.role === "outer")
  .map(member => {
    const way = ways.get(member.ref);
    if (!way?.length || way.some(id => !nodes.has(id))) throw new Error(`Incomplete outer way ${member.ref}`);
    return way;
  });
const rings = [];
while (outer.length) {
  const ring = [...outer.shift()];
  while (ring[0] !== ring.at(-1)) {
    const end = ring.at(-1);
    const neighbor = outer.findIndex(way => way[0] === end || way.at(-1) === end);
    if (neighbor < 0) throw new Error("The Haram outline has an unclosed ring");
    const [way] = outer.splice(neighbor, 1);
    const forward = way[0] === end ? way : [...way].reverse();
    ring.push(...forward.slice(1));
  }
  rings.push(ring.map(id => nodes.get(id)));
}
if (!rings.length) throw new Error("The Haram relation has no outer rings");

const compactRings = rings.map(ring => `    ${JSON.stringify(ring)}`).join(",\n");
await writeFile(new URL("../public/data/umrah-haram-outline-v1.json", import.meta.url),
  `{\n  "source": "${source}",\n  "relationVersion": ${relation.version},\n  "licence": "https://www.openstreetmap.org/copyright",\n  "rings": [\n${compactRings}\n  ]\n}\n`);
