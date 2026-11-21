import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Compass, Download, Heart, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { DesignIcon } from "@/components/DesignIcon";
import { HaramFocusPanel } from "@/components/HaramFocusPanel";
import { SectionNav } from "@/components/Surface";
import { UmrahNowPanel } from "@/components/UmrahNowPanel";
import { UmrahPreparation } from "@/components/UmrahPreparation";
import { UmrahGuideVoice } from "@/components/UmrahGuideVoice";
import { UmrahRitualDua, UmrahRitualSources, UmrahTawafDiagram } from "@/components/UmrahRitualContent";
import { UmrahSaiGuide } from "@/components/UmrahSaiGuide";
import { UmrahWalkSetup } from "@/components/UmrahWalkSetup";
import { UmrahTripForm, UmrahTripImport } from "@/components/UmrahTripForm";
import { useUmrahVoice } from "@/hooks/use-umrah-voice";
import { dateKey, formatTime } from "@/lib/dates";
import { downloadFile } from "@/lib/download";
import { useCopy } from "@/lib/copy";
import { getRecord, updateRecord } from "@/lib/storageService";
import { advanceSai, distance, initialTrip, makkah, tawafRounds, toggleUmrahDua, type Coord, type UmrahTripUpdater } from "@/lib/umrah";
import { observeHaramGate, type GateWatch } from "@/lib/umrahGateMemory";
import { umrahStepNote, umrahStepTitle } from "@/lib/umrah-step-messages.mjs";
import ritual from "../../docs/content/umrah-steps.json";
import osm from "../../public/data/umrah-osm-v1.json";
import outline from "../../public/data/umrah-haram-outline-v1.json";

const OfflineMap = lazy(() => import("./UmrahMap"));
type Point = { id: string; title: string; point: Coord; zone?: "safa" | "marwah" | "haram" | "mataf" };
const pins = osm.pins as Point[];
const safā = pins.find(item => item.zone === "safa");
const marwah = pins.find(item => item.zone === "marwah");
const saiCourse = safā && marwah ? { safa: safā.point, marwah: marwah.point } : undefined;
const saiStep = ritual.steps.findIndex(step => step.id === "sai");
const mataf = pins.find(item => item.zone === "mataf");
const haram = pins.find(item => item.zone === "haram");
const gates = pins.filter(item => item.id.startsWith("gate-"));
const gateNames = gates.map(gate => gate.title);
const gateTitle = (id?: string) => gates.find(gate => gate.id === id)?.title;
type Trip = typeof initialTrip;
interface UmrahContext { trip: Trip; now: Date; point?: Coord; saiPoint?: Coord; locationError?: string; save: UmrahTripUpdater }
const useTrip = () => useOutletContext<UmrahContext>();

export function UmrahShell({ now, desktop }: { now: Date; desktop: boolean }) {
  const { t, locale } = useCopy();
  const { pathname } = useLocation();
  const ask = pathname === "/umrah/ask" || pathname.startsWith("/umrah/ask/");
  const walkSetup = pathname === "/umrah/location";
  const mapView = pathname === "/umrah/map";
  const focusView = pathname === "/umrah/focus";
  const nowView = pathname === "/umrah";
  const showTabs = !walkSetup && !focusView && (!ask || pathname === "/umrah/ask");
  const trip = useLiveQuery(() => getRecord("umrah", initialTrip));
  const [mapFix, setMapFix] = useState<{ point: Coord; at: number }>();
  const [saiFix, setSaiFix] = useState<{ point: Coord; at: number }>();
  const [locationError, setLocationError] = useState("");
  async function save(update: Parameters<UmrahTripUpdater>[0]) {
    try {
      await updateRecord("umrah", initialTrip, update);
      return true;
    } catch {
      toast.error(t("umrahTripSaveError"));
      return false;
    }
  }
  useEffect(() => {
    if (desktop || !trip?.gps) return;
    if (!navigator.geolocation) { setLocationError("umrahLocationUnavailable"); return; }
    let last: { point: Coord; at: number } | undefined;
    let traveled = 0;
    let previousLapAt: number | undefined;
    let wasNearHaram: boolean | undefined;
    let wasNearHotel: boolean | undefined;
    let gateWatch: GateWatch = {};
    const watch = navigator.geolocation.watchPosition(position => {
      setLocationError("");
      const location = { lat: position.coords.latitude, lon: position.coords.longitude };
      const precise = position.coords.accuracy <= 45;
      setSaiFix(precise ? { point: location, at: position.timestamp } : undefined);
      setMapFix(position.coords.accuracy <= 120 ? { point: location, at: position.timestamp } : undefined);
      if (!precise || (last && position.timestamp - last.at < 2500)) return;
      if (last) {
        const seconds = (position.timestamp - last.at) / 1000;
        const segment = distance(last.point, location);
        if (seconds <= 30 && segment >= 5 && segment <= seconds * 4) traveled += segment;
      }
      last = { point: location, at: position.timestamp };
      const near = (pin: Point | undefined, radius: number) => pin ? distance(pin.point, location) <= radius : false;
      const zone = near(safā, 52) ? "safa" : near(marwah, 52) ? "marwah" : undefined;
      const closeToHaram = near(haram, wasNearHaram ? 250 : 220);
      const enteredHaram = closeToHaram && !wasNearHaram;
      const exitedHaram = !closeToHaram && wasNearHaram;
      wasNearHaram = closeToHaram;
      void updateRecord("umrah", initialTrip, saved => {
        if (!saved.gps) return saved;
        const closeToHotel = Boolean(saved.hotel.point && distance(saved.hotel.point, location) < (wasNearHotel ? 90 : 70));
        const enteredHotel = closeToHotel && !wasNearHotel;
        wasNearHotel = closeToHotel;
        const tracking = saved.auto && saved.step === saiStep && !saved.saiPaused && saiCourse;
        if (!tracking || previousLapAt !== saved.sai.lastAt) traveled = 0;
        const sai = tracking ? advanceSai(saved.sai, zone, position.timestamp, traveled) : saved.sai;
        if (sai.lastAt !== saved.sai.lastAt) traveled = 0;
        previousLapAt = sai.lastAt;
        const step = saved.step === 1 && near(mataf, 55) ? 2
          : saved.step === saiStep - 1 && zone === "safa" ? saiStep
          : saved.step === saiStep && sai.count === 7 && sai.count > saved.sai.count ? saiStep + 1 : saved.step;
        const state = enteredHaram && saved.state !== "Doing Umrah" ? "In the Haram"
          : enteredHotel ? "At the hotel"
            : exitedHaram && saved.state === "In the Haram" ? "Walking" : saved.state;
        let gateMemory = saved.gateMemory;
        if (saved.walkOptions?.remember) {
          const observed = observeHaramGate(gateWatch, { point: location, accuracy: position.coords.accuracy, at: position.timestamp },
            outline.rings, gates, gateMemory);
          gateWatch = observed.watch;
          gateMemory = observed.memory;
        } else gateWatch = {};
        return state === saved.state && step === saved.step && sai === saved.sai && gateMemory === saved.gateMemory
          ? saved
          : { ...saved, state, step, sai, gateMemory };
      }).catch(() => setLocationError("umrahLocationProgressError"));
    }, error => {
      setMapFix(undefined);
      setSaiFix(undefined);
      setLocationError(error.code === error.PERMISSION_DENIED ? "umrahWalkPermissionDenied" : "umrahLocationSignal");
    },
    { enableHighAccuracy: true, maximumAge: 8000, timeout: 18000 });
    return () => { navigator.geolocation.clearWatch(watch); setMapFix(undefined); setSaiFix(undefined); setLocationError(""); };
  }, [desktop, trip?.gps, trip?.walkOptions?.remember]);

  if (!trip) return null;
  if (desktop) return <UmrahPreparation trip={trip} gates={gateNames} />;

  const configured = Boolean(trip.start && trip.end);
  const saiGuide = pathname === "/umrah/rituals" && trip.step === saiStep;
  const saiPoint = trip.gps && saiFix && Date.now() - saiFix.at < 30_000 ? saiFix.point : undefined;
  const mapPoint = trip.gps && mapFix && Date.now() - mapFix.at < 30_000 ? mapFix.point : undefined;
  const tabs = [
    { name: "askNow", path: "/umrah", icon: nowView ? "umrah-now-clock" : "ask-icon-clock" },
    { name: "askRituals", path: "/umrah/rituals", icon: saiGuide ? "umrah-live-rituals" : "ask-icon-cube" },
    { name: "askMap", path: "/umrah/map", icon: "ask-icon-pin" },
    { name: "askTab", path: "/umrah/ask", icon: nowView || saiGuide ? "umrah-live-ask" : "ask-speech" },
    { name: "askDuas", path: "/umrah/duas", icon: nowView ? "umrah-now-hand" : "ask-icon-hand" },
  ];
  const shell = ask ? "umrah-shell umrah-ask-shell" : [
    "stack umrah-shell", saiGuide && "umrah-sai-shell", mapView && "umrah-map-shell", focusView && "haram-focus-shell", nowView && "umrah-now-shell",
  ].filter(Boolean).join(" ");
  return <div className={shell}>
    {!ask && !saiGuide && !walkSetup && !mapView && !focusView && !nowView && <><header className="row-between"><Link to="/plan" className="icon-button" aria-label={t("umrahBackToPlan")}><ArrowLeft className="icon-dir" size={20} /></Link>
      <div><p className="caption">{t("umrahPrepMakkah")} · {formatTime(now, makkah.timeZone, locale)}</p><h1>{t("umrah")}</h1></div>
      <Link className="icon-button" to="/umrah/location" state={{ from: pathname === "/umrah/rituals" ? "rituals" : undefined }}
        aria-label={t("umrahLocationOptions")}><Compass size={19} /></Link>
    </header>
    {!configured && <div className="card tint row-between"><p>{t("umrahSetTripHint")}</p><Link to="/umrah/plan" className="action soft">{t("umrahPlanTrip")}</Link></div>}
    {locationError && trip.gps && <p className="card tint small" role="status">{t(locationError)}</p>}</>}
    <Outlet context={{ trip, now, point: mapPoint, saiPoint, locationError, save }} />
    {showTabs && <nav className="umrah-tabs" aria-label={t("askNav")}>
      {tabs.map(item => <NavLink key={item.path} to={item.path} end={item.path === "/umrah"}>
        <span><DesignIcon name={item.icon} size={22} /></span>{t(item.name)}
      </NavLink>)}
    </nav>}
  </div>;
}

export function UmrahNow() {
  const { trip, now, save, saiPoint, locationError } = useTrip();
  const gate = gateTitle(trip.gateMemory?.entry) ?? trip.gate;
  const detected = Boolean(saiPoint && (
    (trip.state === "In the Haram" && haram && distance(saiPoint, haram.point) <= 250)
    || (trip.state === "At the hotel" && trip.hotel.point && distance(saiPoint, trip.hotel.point) < 70)
  ));
  return <UmrahNowPanel trip={trip} now={now} save={save} gate={gate} detected={detected} locationError={locationError} />;
}

export function HaramFocus() {
  const { trip, point, save } = useTrip();
  return <HaramFocusPanel trip={trip} point={point} gate={gateTitle(trip.gateMemory?.entry) ?? trip.gate} save={save} />;
}

export function UmrahRituals() {
  const { t, locale, language } = useCopy();
  const { trip, save, saiPoint, locationError } = useTrip();
  const step = ritual.steps[trip.step] ?? ritual.steps[0];
  const title = t(umrahStepTitle(step.id));
  const total = ritual.steps.length;
  const number = new Intl.NumberFormat(locale);
  const isTawaf = step.id === "tawaf";
  const isSai = step.id === "sai";
  const count = trip.tawaf;
  useEffect(() => { window.scrollTo(0, 0); }, [step.id]);
  const narration = useUmrahVoice(step.id, Boolean(trip.walkOptions?.voice), isSai && trip.saiPaused);
  const voice = <UmrahGuideVoice key={`${language}:${step.id}`} step={step} title={title} voice={narration} embedded={isSai} />;
  const stepList = <div className="compact-stack">
    {ritual.steps.map((item, i) => <button className="list-row" key={item.id} aria-current={trip.step === i} onClick={() => void save(old => ({ ...old, step: i }))}>
      <span className="icon-box">{number.format(i + 1)}</span><span><strong>{t(umrahStepTitle(item.id))}</strong></span>
    </button>)}
  </div>;
  return <>
    <audio ref={narration.player.element} className="umrah-ritual-player" preload="none" hidden {...narration.player.events} />
    {isSai ? <UmrahSaiGuide trip={trip} step={saiStep} total={total} course={saiCourse} point={saiPoint}
      save={save} note={t(umrahStepNote(step.id, 0))} locationError={locationError}>
      {voice}
    </UmrahSaiGuide> : <>
      <section className="card night stack">
        <p className="caption">{t("umrahGuideStep", { step: trip.step + 1, total })}</p><h2>{title}</h2>
        {step.notes?.map((_, index) => {
          const key = umrahStepNote(step.id, index);
          return <p className="muted reading-copy" key={key}>{t(key)}</p>;
        })}
        {isTawaf && <UmrahTawafDiagram />}
        {isTawaf && <>
          <div className="row-between"><strong className="numeral">{t("umrahGuideCount", { count, total: 7 })}</strong>
            <span>{t("umrahGuideRounds")}</span></div>
          <div className="equal-row">
            <button className="action light" disabled={count <= 0} onClick={() => void save(old =>
              ({ ...old, tawaf: tawafRounds(old.tawaf, -1) }))}>{t("umrahGuideCorrect", { count: 1 })}</button>
            <button className="action gold" disabled={count >= 7} onClick={() => void save(old =>
              ({ ...old, tawaf: tawafRounds(old.tawaf, 1) }))}>{t("umrahGuideCountLap", { count: 1 })}</button>
          </div>
        </>}
        <div className="equal-row">
          <button className="action light" disabled={trip.step < 1} onClick={() => void save(old => ({ ...old, step: Math.max(0, old.step - 1) }))}>{t("umrahGuidePrevious")}</button>
          <button className="action soft" disabled={trip.step >= total - 1} onClick={() => void save(old => ({ ...old, step: Math.min(total - 1, old.step + 1) }))}>{t("umrahGuideNext")}</button>
        </div>
        <p className="muted small"><UmrahRitualSources sources={step.sources} /></p>
      </section>
      {step.id === "talbiyah" && <UmrahRitualDua kind="talbiyah" />}
      {isTawaf && <UmrahRitualDua kind="good" />}
      {voice}
    </>}
    {isSai ? <details className="umrah-sai-steps">
      <summary>{t("umrahGuideSteps")}</summary>{stepList}
    </details> : <section className="compact-stack"><h2>{t("umrahGuideSteps")}</h2>{stepList}</section>}
    <p className="card tint muted reading-copy">{t("umrahGuideScholars")}</p>
    {isSai ? <div className="equal-row">
      <Link to="/plan" className="action light">{t("umrahBackToPlan")}</Link>
      <Link to="/print/umrah-guide" className="action soft">{t("umrahGuidePrint")}</Link>
    </div> : <Link to="/print/umrah-guide" className="action soft">{t("umrahGuidePrint")}</Link>}
    {isSai && <p className="small"><UmrahRitualSources sources={step.sources} /> · <a href={osm.license} rel="noreferrer">{osm.attribution}</a></p>}
  </>;
}

export function UmrahDuas() {
  const { t } = useCopy();
  const { trip, save, now } = useTrip();
  const day = dateKey(now, makkah.timeZone);
  const { hash } = useLocation();
  const requestsSection = useRef<HTMLElement>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (hash !== "#requests") return;
    const frame = requestAnimationFrame(() => requestsSection.current?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [hash]);
  return <>
    <UmrahRitualDua kind="good" />
    <UmrahRitualDua kind="talbiyah" />
    <section className="card stack" ref={requestsSection} id="requests">
      <h2>{t("umrahFocusRequestTitle")}</h2>
      <form className="compact-stack" onSubmit={async event => {
        event.preventDefault();
        if (saving) return;
        const form = event.currentTarget;
        const values = new FormData(form);
        const name = String(values.get("name")).trim();
        const request = String(values.get("request")).trim();
        if (!name || !request) return;
        setSaving(true);
        if (await save(old => ({ ...old, requests: [...old.requests, { id: crypto.randomUUID(), name, for: request, done: [] }] }))) form.reset();
        setSaving(false);
      }}>
        <label className="field">{t("umrahDuasName")}<input name="name" dir="auto" required maxLength={100} /></label>
        <label className="field">{t("umrahDuasRequest")}<input name="request" dir="auto" required maxLength={500} /></label>
        <button className="action soft" disabled={saving}><Plus size={17} />{t("umrahFocusAddRequest")}</button>
      </form>
      {trip.requests.map(item => <div className="list-row" key={item.id}>
        <span className="icon-box"><Heart size={19} /></span><span><strong><bdi>{item.name}</bdi></strong><small><bdi>{item.for}</bdi></small></span>
        <button className="action light" aria-pressed={item.done.includes(day)} onClick={() => void save(old => ({
          ...old, requests: toggleUmrahDua(old.requests, item.id, day),
        }))}>{t("umrahDuasPrayed")}{item.done.includes(day) && <DesignIcon name="onboarding-mode-check" size={14} />}</button>
      </div>)}
    </section>
  </>;
}

export function UmrahPlan() {
  const { t } = useCopy();
  const { trip } = useTrip();
  const navigate = useNavigate();
  return <>
    <SectionNav title={t("umrahPrepTrip")} back="/umrah" />
    <UmrahTripForm trip={trip} gates={gateNames} />
    <UmrahTripImport onImported={() => navigate("/umrah")} />
    <Link className="action soft" to="/umrah/location" state={{ from: "plan" }}>{t("umrahWalkLink")}</Link>
  </>;
}

export function WalkWithMe() {
  const { trip, save, locationError } = useTrip();
  const from = useLocation().state?.from;
  const back = from === "rituals" || from === "plan" || from === "map" ? `/umrah/${from}` : "/umrah";
  return <UmrahWalkSetup trip={trip} save={save} back={back} hasAuto={Boolean(saiCourse)} locationError={locationError} />;
}

export function UmrahMapPage() {
  const { t } = useCopy();
  const { trip, point, locationError, save } = useTrip();
  return <Suspense fallback={<p className="card small" role="status">{t("umrahMapOpening")}</p>}>
    <OfflineMap trip={trip} point={point} points={pins} locationError={locationError} save={save} />
  </Suspense>;
}
