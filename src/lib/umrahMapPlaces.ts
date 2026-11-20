import { distance, makkah, madinah, type Coord } from "./umrah";
import type { MapRegion } from "./umrahMapPack";

export type UmrahPin = { id: string; title: string; point: Coord; arabic?: string; number?: string };

const centers: Record<MapRegion, Coord> = {
  makkah: { lat: makkah.latitude, lon: makkah.longitude },
  madinah: { lat: madinah.latitude, lon: madinah.longitude },
};

export function placeRegion(point: Coord): MapRegion {
  return distance(point, centers.makkah) <= distance(point, centers.madinah) ? "makkah" : "madinah";
}

export function nearbyMapPoint(point: Coord | undefined, region: MapRegion) {
  return point && distance(point, centers[region]) < 25_000 ? point : undefined;
}

const digitSets = ["০১২৩৪৫৬৭৮৯", "٠١٢٣٤٥٦٧٨٩", "۰۱۲۳۴۵۶۷۸۹"];
function searchText(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/([a-z])[\u0300-\u036f]+/g, "$1")
    .replace(/[\u064b-\u0652]/g, "").replace(/[০-৯٠-٩۰-۹]/g, digit => {
      return String(digitSets.find(set => set.includes(digit))?.indexOf(digit));
    }).normalize("NFC");
}

export function mapPlaceMatches(pin: UmrahPin, query: string, labels: string[]) {
  const searchable = searchText([pin.title, pin.arabic, pin.number, ...labels].join(" "));
  const numbers: readonly string[] = searchable.match(/[0-9]+/g) ?? [];
  return searchText(query.trim()).split(/\s+/).every(term =>
    /^\d+$/.test(term) ? numbers.includes(term) : searchable.includes(term));
}

export const mapPlaceNames: Readonly<Record<string, string>> = {
  kaaba: "umrahGuideKaaba", haram: "umrahMapHaram", safa: "umrahSaiSafa", marwah: "umrahSaiMarwah",
  zamzam: "umrahMapZamzamPoint", "clock-tower": "umrahMapClockTower", "wudu-women": "umrahMapWuduWomen",
  "wudu-men": "umrahMapWuduMen", "tawaf-line": "umrahMapTawafLine",
  nabawi: "umrahMapNabawi", "gate-4562374597": "umrahMapSalamGate", "gate-4562374598": "umrahMapBaqiGate",
};

export function mapPinIcon(id: string) {
  if (id === "hotel") return "umrah-map-home";
  if (id === "meeting") return "umrah-map-meeting";
  if (id === "safa" || id === "marwah") return "umrah-map-walk";
  if (/^(zamzam|wudu-|toilet-)/.test(id)) return "umrah-map-water";
  return "umrah-map-pin";
}
