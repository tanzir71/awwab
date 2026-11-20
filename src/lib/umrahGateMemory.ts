import { distance, type Coord } from "./umrah";

type Side = "inside" | "outside";
export type HaramOutline = readonly (readonly (readonly number[])[])[];
export type MapGate = { id: string; point: Coord };
export type GateMemory = { entry?: string; exit?: string };
export type GateWatch = {
  side?: { value: Side; at: number };
  gate?: { id: string; at: number };
};

function haramSide(outline: HaramOutline, point: Coord, margin: number): Side | undefined {
  // Work in local meters around the fix. The outline represents the mapped footprint, including courtyards.
  const lonScale = 111_195 * Math.cos(point.lat * Math.PI / 180);
  let inside = false;
  for (const ring of outline) {
    let inRing = false;
    for (let i = 1; i < ring.length; i += 1) {
      const [prevLat, prevLon] = ring[i - 1];
      const [lat, lon] = ring[i];
      const x = (prevLon - point.lon) * lonScale;
      const y = (prevLat - point.lat) * 111_195;
      const dx = (lon - prevLon) * lonScale;
      const dy = (lat - prevLat) * 111_195;
      const segment = dx ** 2 + dy ** 2;
      if (segment === 0) continue;
      const nearest = Math.max(0, Math.min(1, -(x * dx + y * dy) / segment));
      if ((x + nearest * dx) ** 2 + (y + nearest * dy) ** 2 <= margin ** 2) return undefined;
      if ((y > 0) !== (y + dy > 0) && x - y * dx / dy > 0) inRing = !inRing;
    }
    inside ||= inRing;
  }
  return inside ? "inside" : "outside";
}

export function observeHaramGate(previous: GateWatch, fix: { point: Coord; accuracy: number; at: number },
  outline: HaramOutline, gates: readonly MapGate[], memory: GateMemory | undefined) {
  const { point, accuracy, at } = fix;
  if (accuracy > 20) return { watch: previous, memory };
  const value = haramSide(outline, point, Math.max(accuracy, 8));
  const lastSide = previous.side && at - previous.side.at <= 120_000 ? previous.side : undefined;
  const candidates = gates.map(gate => ({ id: gate.id, meters: distance(gate.point, point) }))
    .sort((a, b) => a.meters - b.meters);
  const [nearest, second] = candidates;
  const match = nearest && nearest.meters <= 25 && (!second || second.meters - nearest.meters > accuracy)
    ? { id: nearest.id, at }
    : undefined;
  const gate = match ?? (previous.gate && at - previous.gate.at <= 45_000 ? previous.gate : undefined);
  const side = value ? { value, at } : lastSide;
  if (!value || !lastSide || value === lastSide.value || !gate) return { watch: { side, gate }, memory };
  const kind = value === "inside" ? "entry" : "exit";
  return { watch: { side }, memory: memory?.[kind] === gate.id ? memory : { ...memory, [kind]: gate.id } };
}
