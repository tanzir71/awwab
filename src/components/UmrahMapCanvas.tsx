import { useEffect, useRef, useState } from "react";
import { GeoJSONSource, LngLatBounds, Map as MapLibre, Marker, NavigationControl, addProtocol, removeProtocol, setWorkerUrl } from "maplibre-gl";
import type { StyleSpecification, VectorSourceSpecification } from "maplibre-gl";
import { FileSource, PMTiles } from "pmtiles";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { asset } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { mapPinIcon, type UmrahPin } from "@/lib/umrahMapPlaces";
import type { MapRegion } from "@/lib/umrahMapPack";
import type { Coord } from "@/lib/umrah";
import outline from "../../public/data/umrah-haram-outline-v1.json";

setWorkerUrl(mapWorkerUrl);

const coordinates = ({ lat, lon }: Coord): [number, number] => [lon, lat];
const emptyLine: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const footprint: GeoJSON.MultiPolygon = {
  type: "MultiPolygon", coordinates: outline.rings.map(ring => [ring.map(([lat, lon]) => [lon, lat])]),
};
const protocol = "awwabtiles";
const labelOrder = ["hotel", "meeting", "marwah", "safa", "zamzam", "clock-tower", "kaaba"];

type PinLabel = { pin: UmrahPin; marker: Marker; button: HTMLButtonElement; width: number };

function placeLabels(map: MapLibre, labels: PinLabel[]) {
  const container = map.getContainer();
  const width = container.clientWidth;
  const height = container.clientHeight;
  const overlay = container.parentElement?.querySelector(".umrah-map-controls");
  const top = overlay ? overlay.getBoundingClientRect().bottom - container.getBoundingClientRect().top + 8 : 126;
  const bottom = height - 72;
  const used: { left: number; right: number; top: number; bottom: number }[] = [];

  for (const { pin, marker, button, width: labelWidth } of labels) {
    const point = map.project(coordinates(pin.point));
    const inView = point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
    button.hidden = !inView;
    if (!inView) continue;

    for (const compact of pin.id === "my-location" ? [true] : [false, true]) {
      const size = compact ? 44 : Math.min(labelWidth, width - 16);
      const x = Math.min(width - size / 2 - 8, Math.max(size / 2 + 8, point.x));
      const offsets = pin.id === "my-location" ? [22] : [0, 44, -44, 88, -88];
      const offset = offsets.find(y => {
        const rect = { left: x - size / 2, right: x + size / 2, top: point.y + y - 44, bottom: point.y + y };
        if (pin.id !== "my-location" && (rect.top < top || rect.bottom > bottom)) return false;
        if (used.some(other => rect.left < other.right + 3 && rect.right + 3 > other.left &&
          rect.top < other.bottom && rect.bottom > other.top)) return false;
        used.push(rect);
        return true;
      });
      if (offset === undefined) { button.hidden = true; continue; }
      button.hidden = false;
      button.dataset.compact = String(compact);
      marker.setOffset([x - point.x, offset]);
      break;
    }
  }
}

function mapStyle(region: MapRegion, vector?: VectorSourceSpecification): StyleSpecification {
  const theme = getComputedStyle(document.documentElement);
  const color = (token: string) => theme.getPropertyValue(`--c-${token}`).trim();
  return {
    version: 8,
    sources: {
      ...(vector ? { base: vector } : {}),
      ...(region === "makkah" ? { haram: { type: "geojson", data: footprint } } : {}),
      hotel: { type: "geojson", data: emptyLine },
    },
    layers: [
      { id: "paper", type: "background", paint: { "background-color": color("surface-alt") } },
      ...(vector ? [
        { id: "landuse", type: "fill", source: "base", "source-layer": "landuse", paint: { "fill-color": color("surface-alt") } },
        { id: "water", type: "fill", source: "base", "source-layer": "water", paint: { "fill-color": color("tint") } },
        { id: "buildings", type: "fill", source: "base", "source-layer": "buildings", paint: { "fill-color": color("line") } },
        { id: "roads", type: "line", source: "base", "source-layer": "roads", paint: {
          "line-color": color("surface"),
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.5, 16, 4, 19, 12],
        } },
      ] satisfies StyleSpecification["layers"] : []),
      ...(region === "makkah" ? [
        { id: "haram", type: "fill", source: "haram", paint: { "fill-color": color("tint"), "fill-opacity": .8 } },
      ] satisfies StyleSpecification["layers"] : []),
      { id: "hotel-bearing", type: "line", source: "hotel", layout: { "line-cap": "round" },
        paint: { "line-color": color("primary"), "line-width": 3, "line-dasharray": [1, 2.5] } },
    ],
  };
}

export function UmrahMapCanvas({ region, file, pins, entry, center, camera, guide, label, onSelect }: {
  region: MapRegion; file?: File; pins: UmrahPin[]; entry?: string; center: Coord; camera?: Coord[];
  guide?: [Coord, Coord]; label: string; onSelect: (point: Coord) => void;
}) {
  const { t } = useCopy();
  const target = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  const [map, setMap] = useState<MapLibre>();
  const [issue, setIssue] = useState("");
  useEffect(() => { select.current = onSelect; }, [onSelect]);

  useEffect(() => {
    let active = true;
    let instance: MapLibre | undefined;
    const archive = file ? new PMTiles(new FileSource(file)) : undefined;
    setMap(undefined);
    setIssue("");
    if (archive) addProtocol(protocol, async (request, abort) => {
      const key = request.url.match(/\/(\d+)\/(\d+)\/(\d+)$/);
      if (!key) return { data: new ArrayBuffer(0) };
      const [z, x, y] = key.slice(1).map(Number);
      const tile = await archive.getZxy(z, x, y, abort.signal);
      return { data: tile?.data ?? new ArrayBuffer(0) };
    });

    void (async () => {
      let vector: VectorSourceSpecification | undefined;
      try {
        const header = await archive?.getHeader();
        if (header) vector = {
          type: "vector", tiles: [`${protocol}://local/{z}/{x}/{y}`],
          minzoom: header.minZoom, maxzoom: header.maxZoom,
          bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
        };
      } catch {
        if (active) setIssue("umrahMapTileError");
      }
      if (!active || !target.current) return;
      try {
        instance = new MapLibre({
          container: target.current, center: coordinates(center), zoom: 16,
          style: mapStyle(region, vector), attributionControl: false, dragRotate: false, maxPitch: 0,
          locale: { "Map.Title": t("umrahMapTitle"), "NavigationControl.ZoomIn": t("umrahMapZoomIn"),
            "NavigationControl.ZoomOut": t("umrahMapZoomOut") },
        });
        instance.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
        instance.on("click", event => select.current({ lat: event.lngLat.lat, lon: event.lngLat.lng }));
        instance.on("error", event => {
          if (!active) return;
          console.warn("An offline map detail could not be rendered", event.error);
          setIssue("umrahMapTileError");
        });
        setMap(instance);
      } catch {
        setIssue("umrahMapRenderError");
      }
    })();
    return () => {
      active = false;
      instance?.remove();
      if (archive) removeProtocol(protocol);
    };
  }, [center, file, region, t]);

  useEffect(() => {
    if (!map) return;
    const rank = (id: string) => {
      if (id === entry) return -2;
      if (id === "my-location") return -1;
      const index = labelOrder.indexOf(id);
      return index < 0 ? labelOrder.length : index;
    };
    const labels = [...pins].sort((a, b) => rank(a.id) - rank(b.id)).map(pin => {
      const remembered = pin.id === entry;
      const button = document.createElement("button");
      button.type = "button";
      button.className = remembered ? "umrah-map-marker map-pin-entry" : "umrah-map-marker";
      button.dataset.pin = pin.id;
      const icon = document.createElement("img");
      icon.src = asset(`design/${remembered ? "umrah-map-entry" : mapPinIcon(pin.id)}.svg`);
      icon.alt = "";
      icon.width = icon.height = 14;
      const badge = document.createElement("span");
      badge.className = "umrah-map-marker-icon";
      badge.append(icon);
      const label = document.createElement("span");
      label.dir = "auto";
      label.textContent = pin.title;
      button.append(badge, label);
      button.addEventListener("click", event => {
        event.stopPropagation();
        select.current(pin.point);
      });
      const marker = new Marker({ element: button, anchor: "bottom" }).setLngLat(coordinates(pin.point)).addTo(map);
      return { marker, pin, button, width: button.offsetWidth };
    });
    const layout = () => placeLabels(map, labels);
    map.on("move", layout);
    map.on("resize", layout);
    layout();
    return () => {
      map.off("move", layout);
      map.off("resize", layout);
      labels.forEach(({ marker }) => marker.remove());
    };
  }, [entry, map, pins]);

  useEffect(() => {
    if (!map || !camera?.length) return;
    if (camera.length === 1) {
      map.jumpTo({ center: coordinates(camera[0]), zoom: Math.max(17, map.getZoom()) });
      return;
    }
    const bounds = camera.reduce((area, point) => area.extend(coordinates(point)), new LngLatBounds());
    map.fitBounds(bounds, { padding: { top: 126, bottom: 48, left: 48, right: 48 }, duration: 0, maxZoom: 17.5 });
  }, [camera, map]);

  useEffect(() => {
    if (!map) return;
    const update = () => {
      const source = map.getSource<GeoJSONSource>("hotel");
      source?.setData(guide ? { type: "LineString", coordinates: guide.map(coordinates) } : emptyLine);
    };
    if (map.isStyleLoaded()) update();
    else map.once("load", update);
    return () => { map.off("load", update); };
  }, [guide, map]);

  return <>
    <div className="umrah-map-canvas" ref={target} role="region" aria-label={label} />
    {issue && <p className="umrah-map-error card small" role="status">{t(issue)}</p>}
  </>;
}
