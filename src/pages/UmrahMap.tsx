import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { DesignIcon } from "@/components/DesignIcon";
import { UmrahMapCanvas } from "@/components/UmrahMapCanvas";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SHARE_URL } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { bearing, distance, type Coord, type UmrahTrip, type UmrahTripUpdater } from "@/lib/umrah";
import { cachedMapPack, mapPacks, mapRegions, saveMapPack, type MapRegion } from "@/lib/umrahMapPack";
import { mapPlaceMatches, mapPlaceNames, nearbyMapPoint, placeRegion, type UmrahPin } from "@/lib/umrahMapPlaces";
import madinah from "../../public/data/umrah-madinah-v1.json";

const cityLabels = { makkah: "umrahPrepMakkah", madinah: "umrahPrepMadinah" } as const;
const defaultMakkah = new Set(["kaaba", "safa", "marwah", "zamzam", "clock-tower", "gate-3210622327", "gate-4755914231"]);
type HeadingEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type Orientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

export default function UmrahMap({ trip, point, points, locationError, save }: {
  trip: UmrahTrip; point?: Coord; points: UmrahPin[]; locationError?: string; save: UmrahTripUpdater;
}) {
  const { t, locale } = useCopy();
  const { hash } = useLocation();
  const toHaram = hash === "#to-haram";
  const hotel = trip.hotel.point;
  const hotelRegion = hotel ? placeRegion(hotel) : "makkah";
  const [region, setRegion] = useState<MapRegion>(toHaram ? "makkah" : hotelRegion);
  const [packs, setPacks] = useState<Partial<Record<MapRegion, File>>>({});
  const [loading, setLoading] = useState(false);
  const [savingPlace, setSavingPlace] = useState(false);
  const [dialog, setDialog] = useState<"places" | "packs">();
  const [selection, select] = useState<Coord>();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [shareFallback, setShareFallback] = useState("");
  const [camera, setCamera] = useState<Coord[]>();
  const [walking, setWalking] = useState(false);
  const [heading, setHeading] = useState<number>();
  const [compassDenied, setCompassDenied] = useState(false);
  const placesButton = useRef<HTMLButtonElement>(null);
  const packButton = useRef<HTMLButtonElement>(null);
  const anchor = useRef<HTMLElement>(null);
  const dialogContent = useRef<"places" | "packs">("places");
  const city = t(cityLabels[region]);
  const file = packs[region];
  const user = nearbyMapPoint(point, region);
  const activeHotel = hotelRegion === region ? hotel : undefined;
  const meeting = trip.meeting && placeRegion(trip.meeting) === region ? trip.meeting : undefined;
  const landmarks = region === "makkah" ? points : madinah.pins;
  const entry = region === "makkah" ? points.find(pin => pin.id === trip.gateMemory?.entry)
    ?? points.find(pin => pin.title === trip.gate) : undefined;
  const exit = region === "makkah" ? points.find(pin => pin.id === trip.gateMemory?.exit) : undefined;
  const destination = toHaram && region === "makkah"
    ? entry ?? points.find(pin => pin.id === "haram") : undefined;
  const entryLabel = region === "makkah" ? entry?.title || trip.gate : "";
  const center = landmarks[0].point;

  const places = useMemo(() => {
    const list: UmrahPin[] = landmarks.map(pin => ({
      ...pin, title: mapPlaceNames[pin.id] ? t(mapPlaceNames[pin.id]) : pin.title,
    }));
    if (activeHotel) list.push({ id: "hotel", title: trip.hotel.name
      ? t("umrahMapHotelNamed", { name: trip.hotel.name }) : t("umrahMapHotel"), point: activeHotel });
    if (meeting) list.push({ id: "meeting", title: t("umrahMapMeeting"), point: meeting });
    return list;
  }, [activeHotel, landmarks, meeting, t, trip.hotel.name]);
  const curated = useMemo(() => places.filter(pin => region === "madinah" || pin.id === "hotel" || pin.id === "meeting"
    || pin.id === entry?.id || pin.id === exit?.id || defaultMakkah.has(pin.id)), [entry, exit, places, region]);
  const markerPins = useMemo(() => {
    const list = curated.map(pin => pin.id === entry?.id
      ? { ...pin, title: t("umrahMapYouEntered", { gate: pin.title }) } : pin);
    const selected = places.find(pin => pin.point === selection);
    if (selected && !list.some(pin => pin.id === selected.id)) list.push(selected);
    if (destination && !list.some(pin => pin.id === destination.id)) list.push(destination);
    if (user) list.push({ id: "my-location", title: t("umrahMapHere"), point: user });
    return list;
  }, [curated, destination, entry, places, selection, t, user]);
  const overview = useMemo(() => curated.map(pin => pin.point).filter(pin => distance(pin, center) < 2300), [center, curated]);
  const guide = useMemo<[Coord, Coord] | undefined>(() => {
    if (destination && !walking) {
      const origin = user ?? nearbyMapPoint(activeHotel, "makkah");
      return origin ? [origin, destination.point] : undefined;
    }
    const origin = user ?? entry?.point;
    return origin && activeHotel ? [origin, activeHotel] : undefined;
  }, [activeHotel, destination, entry, user, walking]);
  const haramCamera = useMemo(() => destination ? guide ?? [destination.point] : undefined, [destination, guide]);
  const matches = query.trim() ? places.filter(pin => {
    const original = landmarks.find(item => item.id === pin.id) ?? pin;
    const keywords = pin.id.startsWith("gate-") ? t("umrahMapGateKeyword")
      : pin.id.startsWith("toilet-") ? t("umrahMapToiletKeyword") : "";
    return mapPlaceMatches(original, query, [pin.title, keywords]);
  }) : [];
  const direction = user && activeHotel ? bearing(user, activeHotel) : undefined;
  const meters = user && activeHotel ? distance(user, activeHotel) : undefined;
  const distanceLabel = meters === undefined ? "" : meters < 1000 ? t("umrahMapDistanceM", { meters: Math.round(meters) })
    : t("umrahMapDistanceKm", { kilometers: meters / 1000 });
  const coordinates = new Intl.NumberFormat(locale, { maximumFractionDigits: 5, useGrouping: false });

  useEffect(() => {
    let active = true;
    for (const city of mapRegions) {
      void cachedMapPack(city).then(cached => {
        if (active && cached) setPacks(current => ({ ...current, [city]: current[city] ?? cached }));
      }).catch(() => {});
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (hash !== "#back-to-hotel") return;
    const frame = requestAnimationFrame(() => anchor.current?.scrollIntoView({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  useEffect(() => {
    if (!walking) return;
    const update = (event: HeadingEvent) => {
      if (Number.isFinite(event.webkitCompassHeading) && event.webkitCompassHeading >= 0) setHeading(event.webkitCompassHeading);
      else if (event.absolute && Number.isFinite(event.alpha)) setHeading((360 - event.alpha) % 360);
    };
    window.addEventListener("deviceorientationabsolute", update);
    window.addEventListener("deviceorientation", update);
    return () => {
      window.removeEventListener("deviceorientationabsolute", update);
      window.removeEventListener("deviceorientation", update);
    };
  }, [walking]);

  function changeCity(city: MapRegion) {
    setRegion(city);
    select(undefined);
    setQuery("");
    setNotice("");
    setCamera(undefined);
    setWalking(false);
    setHeading(undefined);
    setCompassDenied(false);
  }

  function choose(point?: Coord) {
    select(point);
    if (point) setCamera([point]);
    setQuery("");
    dialogContent.current = "places";
    setDialog("places");
  }

  async function loadPack(imported?: File) {
    setLoading(true);
    setNotice("");
    try {
      const file = await saveMapPack(region, imported);
      setPacks(current => ({ ...current, [region]: file }));
      setNotice(t("umrahMapPackSaved"));
      setDialog(undefined);
    } catch {
      setNotice(t("umrahMapPackError"));
    } finally {
      setLoading(false);
    }
  }

  async function toggleWalking() {
    setWalking(!walking);
    setHeading(undefined);
    setCompassDenied(false);
    if (walking) return;
    if (user && activeHotel) setCamera([user, activeHotel]);
    try {
      const api = window.DeviceOrientationEvent as Orientation | undefined;
      if (!api || (api.requestPermission && await api.requestPermission() !== "granted")) setCompassDenied(true);
    } catch { setCompassDenied(true); }
  }

  function saveCoordinates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pin = { lat: Number(form.get("lat")), lon: Number(form.get("lon")) };
    if (Number.isFinite(pin.lat) && Number.isFinite(pin.lon)) select(pin);
  }

  async function remember(kind: "hotel" | "meeting") {
    if (!selection || savingPlace) return;
    setSavingPlace(true);
    const ok = await save(old => kind === "hotel" ? { ...old, hotel: { ...old.hotel, point: selection } } : { ...old, meeting: selection });
    setSavingPlace(false);
    if (!ok) return;
    const city = placeRegion(selection);
    if (city !== region) changeCity(city);
    setCamera([selection]);
    setDialog(undefined);
    setNotice(t(kind === "hotel" ? "umrahMapHotelSaved" : "umrahMapMeetingSaved"));
  }

  async function shareHotel() {
    if (!hotel) return;
    setShareFallback("");
    const pin = `https://www.openstreetmap.org/?mlat=${hotel.lat}&mlon=${hotel.lon}#map=18/${hotel.lat}/${hotel.lon}`;
    const title = trip.hotel.name || t("umrahMapHotel");
    const text = `${title} · ${pin}\n${SHARE_URL}`;
    try {
      if (navigator.share) await navigator.share({ title, text, url: SHARE_URL });
      else { await navigator.clipboard.writeText(text); setNotice(t("umrahMapCopied")); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setShareFallback(pin);
    }
  }

  return <article className="umrah-map-view">
    <h1 className="sr-only">{t("umrahMapTitle")}</h1>
    <div className="umrah-map-stage">
      <UmrahMapCanvas region={region} file={file} pins={markerPins} center={center} entry={entry?.id}
        guide={guide} camera={camera ?? haramCamera ?? overview} label={t("umrahMapArea", { city })} onSelect={choose} />
      <div className="umrah-map-overlay">
        <div className="umrah-map-search">
          <DesignIcon name="umrah-map-search" size={18} />
          <input aria-label={t("umrahMapSearch")} placeholder={t("umrahMapSearch")} type="search" value={query}
            onChange={event => setQuery(event.currentTarget.value)} onKeyDown={event => {
              if (event.key === "Escape") setQuery("");
              if (event.key === "Enter" && matches[0]) choose(matches[0].point);
            }} />
        </div>
        <div className="umrah-map-controls">
          <div className="umrah-map-cities" role="group" aria-label={t("umrahMapCities")}>
            {mapRegions.map(id => <button type="button" key={id} aria-pressed={id === region} disabled={loading}
              onClick={() => changeCity(id)}>{t(cityLabels[id])}</button>)}
          </div>
          <button ref={packButton} type="button" className="umrah-map-pack-status" aria-haspopup="dialog" onClick={() => {
            setNotice("");
            dialogContent.current = "packs";
            setDialog("packs");
          }}>{file ? <><span aria-hidden="true">✓</span>{t("umrahMapOffline", { size: t("fileSizeMB", { size: file.size / 1_000_000 }) })}</> : t("umrahMapPacks")}</button>
        </div>
        {query.trim() && <section className="umrah-map-results card" aria-label={t("umrahMapResults")}>
          {matches.map(pin => <button type="button" key={pin.id} onClick={() => choose(pin.point)}>{pin.title}</button>)}
          {!matches.length && <p role="status" className="small muted">{t("umrahMapNoResults")}</p>}
        </section>}
        {destination && !walking && !query.trim() && <p className="umrah-map-direction caption">
          {t(guide ? "umrahNowMapDirection" : "umrahNowMapDestination", {
            place: mapPlaceNames[destination.id] ? t(mapPlaceNames[destination.id]) : destination.title,
          })}
        </p>}
      </div>
      <button ref={placesButton} type="button" className="umrah-map-place-button action light" aria-haspopup="dialog"
        onClick={() => choose()}>{t("umrahMapPlaces")}</button>
      <p className="umrah-map-attribution"><a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>
        {file && <> · <a href="https://protomaps.com/">Protomaps</a></>}
      </p>
    </div>
    <section className="umrah-map-hotel-sheet" id="back-to-hotel" ref={anchor}>
      <span className="umrah-map-handle" aria-hidden="true" />
      <div className="umrah-map-hotel-summary"
        style={direction === undefined ? undefined : { "--hotel-bearing": `${direction - (heading ?? 0)}deg` } as CSSProperties}>
        <div className="umrah-map-compass">
          <DesignIcon name="umrah-map-arrow" size={30} className="umrah-map-compass-arrow" />
        </div>
        <div>
          <h2 className="caption">{t("umrahWalkHotel")}</h2>
          {direction !== undefined && <p className="umrah-map-bearing">{t("umrahMapBearing", { distance: distanceLabel, bearing: Math.round(direction) % 360 })}</p>}
          {entryLabel && <p className="small muted">{t("umrahWalkEntryGate", { gate: entryLabel })}</p>}
          {exit && <p className="small muted">{t("umrahWalkExitGate", { gate: exit.title })}</p>}
          <p className="small muted">{!hotel ? t("umrahMapFindHotel") : !activeHotel ? t("umrahMapShowCity", { city: t(cityLabels[hotelRegion]) })
            : direction !== undefined ? t("umrahMapDirect") : t(trip.gps ? (locationError || "umrahMapWaiting") : "umrahMapLocationHint")}</p>
        </div>
      </div>
      {compassDenied && walking && <p className="small muted" role="status">{t("umrahMapCompassError")}</p>}
      <div className="equal-row umrah-map-hotel-actions">
        {!hotel ? <button type="button" className="action" onClick={() => choose()}>{t("umrahMapEdit")}</button>
          : hotelRegion !== region ? <button type="button" className="action" onClick={() => changeCity(hotelRegion)}>
            {t("umrahMapShowCity", { city: t(cityLabels[hotelRegion]) })}
          </button> : !trip.gps ? <Link className="action" to="/umrah/location" state={{ from: "map" }}>{t("umrahLocationOptions")}</Link>
            : <button type="button" className="action" disabled={direction === undefined && !walking} onClick={() => void toggleWalking()}>
              {t(walking ? "umrahMapStopWalking" : "umrahMapStartWalking")}
            </button>}
        <button type="button" className="action light" disabled={!hotel} onClick={() => void shareHotel()}>{t("umrahMapShareHotel")}</button>
      </div>
      {shareFallback && <p className="small"><a href={shareFallback}>{t("umrahMapShareHotel")}</a></p>}
      {notice && dialog !== "packs" && <p className="small muted" role="status">{notice}</p>}
    </section>
    <Dialog open={Boolean(dialog)} onOpenChange={open => { if (!open && !loading && !savingPlace) setDialog(undefined); }}>
      <DialogContent className="umrah-map-dialog card" showCloseButton={false} onCloseAutoFocus={event => {
        event.preventDefault();
        const element = dialogContent.current === "packs" ? packButton.current : placesButton.current;
        element?.focus({ preventScroll: true });
      }}>
        {dialogContent.current === "packs" ? <>
          <DialogTitle>{t("umrahMapPacks")} · {city}</DialogTitle>
          <DialogDescription className="small muted">{t("umrahMapPackHint")}</DialogDescription>
          {file ? <p className="small">{t("umrahMapOffline", { size: t("fileSizeMB", { size: file.size / 1_000_000 }) })}</p>
            : <button type="button" className="action" disabled={loading} onClick={() => void loadPack()}>
              {loading ? t("umrahPrepDownloading") : t("umrahPrepDownloadMaps", { size: t("fileSizeMB", { size: mapPacks[region] / 1_000_000 }) })}
            </button>}
          <label className="field">{t("umrahMapImport")}<input type="file" accept=".pmtiles" disabled={loading} onChange={event => {
            const chosen = event.currentTarget.files?.[0];
            if (chosen) void loadPack(chosen);
          }} /></label>
          {notice && <p className="small muted" role="status">{notice}</p>}
        </> : <>
          <DialogTitle>{t("umrahMapEdit")}</DialogTitle>
          <DialogDescription className="small muted">{t("umrahMapEditHint")}</DialogDescription>
          {!selection && <div className="umrah-map-place-list">
            {curated.map(pin => <button type="button" key={pin.id} className="action light" onClick={() => select(pin.point)}>{pin.title}</button>)}
          </div>}
          {user ? <button type="button" className="action light" disabled={savingPlace} onClick={() => select(user)}>{t("umrahMapUsePosition")}</button>
            : !trip.gps && <Link className="action light" to="/umrah/location" state={{ from: "map" }}>{t("umrahLocationOptions")}</Link>}
          <form className="compact-stack" onSubmit={saveCoordinates}>
            <div className="equal-row">
              <label className="field">{t("umrahMapLatitude")}<input name="lat" type="number" step="any" min="-90" max="90" required /></label>
              <label className="field">{t("umrahMapLongitude")}<input name="lon" type="number" step="any" min="-180" max="180" required /></label>
            </div>
            <button type="submit" className="action light">{t("umrahMapSelectCoords")}</button>
          </form>
          {selection && <p className="small" role="status">{t("umrahMapSelected", {
            latitude: coordinates.format(selection.lat), longitude: coordinates.format(selection.lon),
          })}</p>}
          <div className="equal-row">
            <button type="button" className="action" disabled={!selection || savingPlace} onClick={() => void remember("hotel")}>{t("umrahMapSaveHotel")}</button>
            <button type="button" className="action soft" disabled={!selection || savingPlace} onClick={() => void remember("meeting")}>{t("umrahMapSaveMeeting")}</button>
          </div>
          <Link className="text-button" to="/umrah/ask?category=directions">{t("askEntry")}</Link>
        </>}
        <DialogClose className="action light" disabled={loading || savingPlace}>{t("umrahSaiCancel")}</DialogClose>
      </DialogContent>
    </Dialog>
  </article>;
}
