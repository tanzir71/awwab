import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Compass, Download, MapPin, Search, Share2 } from "lucide-react";
import { Map as MapLibre, Marker, NavigationControl, addProtocol, removeProtocol, setWorkerUrl } from "maplibre-gl";
import { FileSource, PMTiles } from "pmtiles";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { SectionNav } from "@/components/Surface";
import { SHARE_URL } from "@/lib/config";
import { bearing, distance, initialTrip, makkah, madinah, type Coord } from "@/lib/umrah";
import { cachedMapPack, saveMapPack, type MapRegion } from "@/lib/umrahMapPack";

type Pin = { id: string; title: string; point: Coord };
type Trip = typeof initialTrip;
type Region = MapRegion;
type HeadingEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type Orientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

setWorkerUrl(mapWorkerUrl);

function MapCanvas({ region, file, pins, user, onPoint }: { region: Region; file?: File; pins: Pin[]; user?: Coord; onPoint: (point: Coord) => void }) {
  const target = useRef<HTMLDivElement>(null);
  const instance = useRef<MapLibre>();
  const callback = useRef(onPoint);
  const [error, setError] = useState("");
  useEffect(() => { callback.current = onPoint; }, [onPoint]);
  useEffect(() => {
    const city = region === "makkah" ? makkah : madinah;
    const root = getComputedStyle(document.documentElement);
    const color = (name: string) => root.getPropertyValue(`--c-${name}`).trim();
    const center: [number, number] = region === "makkah" && pins.length ? [pins[0].point.lon, pins[0].point.lat] : [city.longitude, city.latitude];
    const archive = file ? new PMTiles(new FileSource(file)) : undefined;
    addProtocol("awwabtiles", async (request, abort) => {
      const match = request.url.match(/\/(\d+)\/(\d+)\/(\d+)$/);
      if (!archive || !match) return { data: new ArrayBuffer(0) };
      const [z, x, y] = match.slice(1).map(Number);
      const tile = await archive.getZxy(z, x, y, abort.signal);
      return { data: tile?.data ?? new ArrayBuffer(0) };
    });
    let map: MapLibre;
    try {
      const tileSource = file ? { base: { type: "vector" as const, tiles: ["awwabtiles://local/{z}/{x}/{y}"], maxzoom: 15, attribution: "© OpenStreetMap contributors · Protomaps" } } : {};
      const tiles = [
        { id: "landuse", type: "fill" as const, source: "base", "source-layer": "landuse", paint: { "fill-color": color("primary-soft") } },
        { id: "water", type: "fill" as const, source: "base", "source-layer": "water", paint: { "fill-color": color("tint") } },
        { id: "buildings", type: "fill" as const, source: "base", "source-layer": "buildings", paint: { "fill-color": color("line"), "fill-opacity": .85 } },
        { id: "roads", type: "line" as const, source: "base", "source-layer": "roads", paint: { "line-color": color("surface"), "line-width": 3.5 } },
      ];
      map = new MapLibre({
        container: target.current,
        center, zoom: 16.2, maxZoom: 20,
        style: { version: 8, sources: tileSource, layers: [
          { id: "paper", type: "background", paint: { "background-color": color("bg") } },
          ...(file ? tiles : []),
        ] },
      });
      instance.current = map;
      map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
      map.on("click", event => callback.current({ lat: event.lngLat.lat, lon: event.lngLat.lng }));
      map.on("error", event => {
        if (!file) return;
        console.warn("Awwab offline map could not render a tile.", event.error);
        setError("Some map details could not be shown from this pack.");
      });
    } catch {
      setError("This browser could not start the map. Saved places are listed below.");
    }
    return () => { map?.remove(); instance.current = undefined; removeProtocol("awwabtiles"); };
    // Pins are updated below without recreating the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, file]);

  useEffect(() => {
    const map = instance.current;
    if (!map) return;
    const all = user ? [...pins, { id: "my-location", point: user, title: "Your location" }] : pins;
    const markers = all.map(pin => {
      const element = document.createElement("button");
      element.className = "map-pin";
      element.textContent = pin.title;
      element.setAttribute("aria-label", pin.title);
      element.addEventListener("click", event => { event.stopPropagation(); callback.current(pin.point); });
      return new Marker({ element }).setLngLat([pin.point.lon, pin.point.lat]).addTo(map);
    });
    return () => markers.forEach(marker => marker.remove());
  }, [pins, region, file, user]);

  return <div className="compact-stack"><div className="umrah-map" ref={target} aria-label={`Map of ${region}`} />{error && <p className="muted small" role="status">{error}</p>}</div>;
}

export default function UmrahMap({ trip, point, points, save }: {
  trip: Trip; point?: Coord; points: Pin[]; save: (update: (old: Trip) => Trip) => Promise<void>;
}) {
  const [region, setRegion] = useState<Region>("makkah");
  const [pack, setPack] = useState<{ region: Region; file: File }>();
  const [selection, select] = useState<Coord>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [heading, setHeading] = useState<number>();
  const [compass, setCompass] = useState(false);
  const [query, setQuery] = useState("");
  const file = pack?.region === region ? pack.file : undefined;
  const pins = [
    ...(region === "makkah" ? points : []),
    ...(trip.hotel.point && region === "makkah" ? [{ id: "hotel", title: trip.hotel.name || "Hotel", point: trip.hotel.point }] : []),
    ...(trip.meeting && region === "makkah" ? [{ id: "meeting", title: "Meeting point", point: trip.meeting }] : []),
  ];
  const matches = pins.filter(pin => pin.title.toLowerCase().includes(query.trim().toLowerCase()));
  const primaryPins = query.trim() ? matches : pins.filter(pin =>
    !pin.id.startsWith("gate-") || /fahd|abdul aziz|marwah/i.test(pin.title));
  useEffect(() => {
    let active = true;
    void cachedMapPack(region).then(local => {
      if (local && active) setPack({ region, file: local });
    }).catch(() => {});
    return () => { active = false; };
  }, [region]);
  useEffect(() => {
    if (!compass) return;
    const update = (event: HeadingEvent) => {
      if (Number.isFinite(event.webkitCompassHeading)) setHeading(event.webkitCompassHeading);
      else if (event.absolute && Number.isFinite(event.alpha)) setHeading((360 - event.alpha) % 360);
    };
    window.addEventListener("deviceorientationabsolute", update);
    window.addEventListener("deviceorientation", update);
    return () => {
      window.removeEventListener("deviceorientationabsolute", update);
      window.removeEventListener("deviceorientation", update);
    };
  }, [compass]);
  async function loadPack(imported?: File) {
    setLoading(true);
    setMessage("");
    try {
      const loaded = await saveMapPack(region, imported);
      setPack({ region, file: loaded });
      setMessage("Map pack saved for offline use.");
    } catch {
      setMessage("The map pack could not be loaded. Try again online or import a PMTiles extract.");
    } finally {
      setLoading(false);
    }
  }
  async function allowCompass() {
    try {
      const api = window.DeviceOrientationEvent as Orientation | undefined;
      if (!api || (api.requestPermission && await api.requestPermission() !== "granted")) throw new Error();
      setCompass(true);
    } catch { setMessage("Compass permission is unavailable. You can still use distance and bearing."); }
  }
  function saveCoordinates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pin = { lat: Number(form.get("lat")), lon: Number(form.get("lon")) };
    if (Number.isFinite(pin.lat) && Number.isFinite(pin.lon)) select(pin);
  }
  const hotel = trip.hotel.point;
  const direction = point && hotel ? bearing(point, hotel) : null;
  const meters = point && hotel ? distance(point, hotel) : null;
  async function shareHotel() {
    if (!hotel) return;
    const pin = `https://www.openstreetmap.org/?mlat=${hotel.lat}&mlon=${hotel.lon}#map=18/${hotel.lat}/${hotel.lon}`;
    const text = `${trip.hotel.name || "Our hotel"} · ${pin}\nShared with awwab · ${SHARE_URL}`;
    try {
      if (navigator.share) await navigator.share({ title: trip.hotel.name || "Hotel pin", text, url: SHARE_URL });
      else { await navigator.clipboard.writeText(text); setMessage("Hotel pin copied."); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(pin);
    }
  }
  return <>
    <SectionNav title="Offline map" back="/umrah" />
    {region === "makkah" && <label className="field"><span className="with-icon"><Search size={18} /> Search saved places and gates</span>
      <input type="search" value={query} placeholder="Gate, Zamzam or wudu" onChange={event => setQuery(event.target.value)} /></label>}
    <div className="equal-row">{(["makkah", "madinah"] as const).map(item => <button key={item} className={`action ${item === region ? "" : "light"}`}
      disabled={loading} aria-pressed={item === region} onClick={() => { setRegion(item); select(undefined); setMessage(""); }}>{item === "makkah" ? "Makkah" : "Madinah"}</button>)}</div>
    {!file && <section className="card stack">
      <p>Download a map pack once to use it without a connection.</p>
      <button className="action soft" disabled={loading} onClick={() => void loadPack()}><Download size={17} /> {loading ? "Preparing pack…" : "Download map pack"}</button>
      <label className="field">Import a local PMTiles extract<input type="file" accept=".pmtiles" disabled={loading} onChange={event => {
        const file = event.target.files?.[0];
        if (file) void loadPack(file);
      }} /></label>
    </section>}
    <MapCanvas region={region} file={file} pins={primaryPins} user={point} onPoint={select} />
    <a className="small muted" href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL</a>
    {message && <p role="status" className="card tint">{message}</p>}
    {region === "makkah" && <section className="card stack">
      <h2 className="with-icon"><MapPin size={18} /> Remember a place</h2>
      {matches.length > 0 && <div className="chips">{(query.trim() ? matches : primaryPins).map(pin => <button key={pin.id} className="action light" onClick={() => select(pin.point)}>{pin.title}</button>)}</div>}
      {query && !matches.length && <p className="muted" role="status">No saved places match this search.</p>}
      <p className="muted">Tap a position on your map, use your current position, or enter coordinates.</p>
      {point && <button className="action light" onClick={() => select(point)}>Use current position</button>}
      <form className="stack" onSubmit={saveCoordinates}>
        <div className="equal-row">
          <label className="field">Latitude<input name="lat" type="number" step="any" min="-90" max="90" required /></label>
          <label className="field">Longitude<input name="lon" type="number" step="any" min="-180" max="180" required /></label>
        </div>
        <button className="action light">Select coordinates</button>
      </form>
      {selection && <p className="small muted">Selected · {selection.lat.toFixed(5)}, {selection.lon.toFixed(5)}</p>}
      <div className="equal-row">
        <button className="action" disabled={!selection} onClick={() => void save(old => ({ ...old, hotel: { ...old.hotel, point: selection } }))}>Save hotel pin</button>
        <button className="action soft" disabled={!selection} onClick={() => void save(old => ({ ...old, meeting: selection }))}>Save meeting point</button>
      </div>
    </section>}
    <section className="card stack">
      <h2 className="with-icon"><Compass size={18} /> Back to hotel</h2>
      {direction === null ? <p className="muted">Save your hotel pin and allow location to see direction and distance.</p> : <>
        <p>{meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`} away · bearing {Math.round(direction)}°</p>
        <span className="compass-arrow" aria-hidden="true" style={{ transform: `rotate(${direction - (heading ?? 0)}deg)` }}>↑</span>
        {heading === undefined && <button className="action light" disabled={compass} onClick={() => void allowCompass()}>{compass ? "Waiting for compass…" : "Use device compass"}</button>}
      </>}
      {!trip.gps && <Link className="action soft" to="/umrah/location">Location options</Link>}
      {hotel && <button className="action light" onClick={() => void shareHotel()}><Share2 size={18} /> Share hotel pin</button>}
    </section>
  </>;
}
