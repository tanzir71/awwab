import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { ArrowLeft, Compass, Download, Heart, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { SectionNav } from "@/components/Surface";
import { ShareLink } from "@/components/ShareLink";
import { UmrahPreparation } from "@/components/UmrahPreparation";
import { UmrahTripForm, UmrahTripImport } from "@/components/UmrahTripForm";
import { VerseAudio } from "@/components/VerseAudio";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useRecord } from "@/hooks/use-awwab";
import { duration, formatTime } from "@/lib/dates";
import { saveCalendar } from "@/lib/calendarFile";
import { downloadFile } from "@/lib/download";
import { useCopy } from "@/lib/copy";
import { updateRecord } from "@/lib/storageService";
import { advanceSai, correctSai, distance, initialTrip, makkah, states, umrahContext, type Coord } from "@/lib/umrah";
import { prayerIds, prayerNames } from "@/types/Prayer";
import ritual from "../../docs/content/umrah-steps.json";
import duas from "../../docs/content/umrah-duas.json";
import osm from "../../public/data/umrah-osm-v1.json";

const OfflineMap = lazy(() => import("./UmrahMap"));
type Point = { id: string; title: string; point: Coord; zone?: "safa" | "marwah" | "haram" | "mataf" };
const pins = osm.pins as Point[];
const safā = pins.find(item => item.zone === "safa");
const marwah = pins.find(item => item.zone === "marwah");
const mataf = pins.find(item => item.zone === "mataf");
const haram = pins.find(item => item.zone === "haram");
const gates = pins.filter(item => item.id.startsWith("gate-"));
const gateNames = gates.map(gate => gate.title);
type Trip = typeof initialTrip;
type TripUpdater = (update: (trip: Trip) => Trip) => Promise<void>;

interface UmrahContext { trip: Trip; now: Date; point?: Coord; save: TripUpdater }
const useTrip = () => useOutletContext<UmrahContext>();
const localTime = (date: Date) => formatTime(date, makkah.timeZone);

export function UmrahShell({ now, desktop }: { now: Date; desktop: boolean }) {
  const { t } = useCopy();
  const { pathname } = useLocation();
  const ask = pathname === "/umrah/ask" || pathname.startsWith("/umrah/ask/");
  const showTabs = !ask || pathname === "/umrah/ask";
  const trip = useRecord("umrah", initialTrip);
  const [point, setPoint] = useState<Coord>();
  const [locationError, setLocationError] = useState("");
  async function save(update: Parameters<TripUpdater>[0]) {
    try { await updateRecord("umrah", initialTrip, update); }
    catch { toast.error("Your trip details could not be saved."); }
  }
  const configured = Boolean(trip.start && trip.end);

  useEffect(() => {
    if (desktop || !trip.gps) return;
    if (!navigator.geolocation) { setLocationError("Location is unavailable on this device."); return; }
    let last: { point: Coord; at: number } | undefined;
    let traveled = 0;
    const watch = navigator.geolocation.watchPosition(position => {
      setLocationError("");
      if (position.coords.accuracy > 120) return;
      const location = { lat: position.coords.latitude, lon: position.coords.longitude };
      setPoint(location);
      const precise = position.coords.accuracy <= 45;
      if (!precise || (last && position.timestamp - last.at < 2500)) return;
      if (last) {
        const seconds = (position.timestamp - last.at) / 1000;
        const segment = distance(last.point, location);
        if (seconds <= 30 && segment >= 5 && segment <= seconds * 4) traveled += segment;
      }
      last = { point: location, at: position.timestamp };
      const near = (pin: Point | undefined, radius: number) => pin ? distance(pin.point, location) <= radius : false;
      const zone = near(safā, 52) ? "safa" : near(marwah, 52) ? "marwah" : undefined;
      void updateRecord("umrah", initialTrip, saved => {
        if (!saved.gps) return saved;
        const sai = saved.auto && saved.step === 5 && safā && marwah
          ? advanceSai(saved.sai, zone, position.timestamp, traveled) : saved.sai;
        if (sai.lastAt !== saved.sai.lastAt) traveled = 0;
        const step = saved.step === 1 && near(mataf, 55) ? 2
          : saved.step === 4 && zone === "safa" ? 5 : saved.step === 5 && sai.count === 7 ? 6 : saved.step;
        const state = near(haram, 220) && saved.state !== "Doing Umrah" ? "In the Haram"
          : saved.hotel.point && distance(saved.hotel.point, location) < 70 ? "At the hotel" : saved.state;
        return state === saved.state && step === saved.step && sai === saved.sai ? saved : { ...saved, state, step, sai };
      }).catch(() => setLocationError("Live progress could not be saved. Manual counting is available."));
    }, () => setLocationError("Location signal unavailable. You can still use the manual guide."),
    { enableHighAccuracy: true, maximumAge: 8000, timeout: 18000 });
    return () => { navigator.geolocation.clearWatch(watch); setPoint(undefined); setLocationError(""); };
  }, [desktop, trip.gps]);

  if (desktop) return <UmrahPreparation trip={trip} gates={gateNames} />;

  const tabs = [
    { name: "askNow", path: "/umrah", icon: "ask-icon-clock" }, { name: "askRituals", path: "/umrah/rituals", icon: "ask-icon-cube" },
    { name: "askMap", path: "/umrah/map", icon: "ask-icon-pin" }, { name: "askTab", path: "/umrah/ask", icon: "ask-speech" },
    { name: "askDuas", path: "/umrah/duas", icon: "ask-icon-hand" },
  ];
  return <div className={ask ? "umrah-shell umrah-ask-shell" : "stack umrah-shell"}>
    {!ask && <><header className="row-between"><Link to="/plan" className="icon-button" aria-label="Back to Plan"><ArrowLeft size={20} /></Link>
      <div><p className="caption">Makkah · {localTime(now)}</p><h1>Umrah mode</h1></div>
      <Link className="icon-button" to="/umrah/location" aria-label="Location options"><Compass size={19} /></Link>
    </header>
    {!configured && <div className="card tint row-between"><p>Set your trip dates and hotel before you go.</p><Link to="/umrah/plan" className="action soft">Plan trip</Link></div>}
    {locationError && trip.gps && <p className="card tint small" role="status">{locationError}</p>}</>}
    <Outlet context={{ trip, now, point: trip.gps ? point : undefined, save }} />
    {showTabs && <nav className="umrah-tabs" aria-label={t("askNav")}>
      {tabs.map(item => <NavLink key={item.path} to={item.path} end={item.path === "/umrah"}>
        <span><DesignIcon name={item.icon} size={22} /></span>{t(item.name)}
      </NavLink>)}
    </nav>}
  </div>;
}

export function UmrahNow() {
  const { t } = useCopy();
  const { trip, now, save } = useTrip();
  const context = umrahContext(now, trip);
  const current = context.current;
  const next = context.next;
  const count = trip.dhikr[context.day] ?? 0;
  const afterFajr = now >= context.duha && now < context.times.dhuhr;
  const midday = now >= context.times.dhuhr && now < context.times.asr;
  return <>
    <ContextMenu><ContextMenuTrigger asChild><section className="card night stack">
      <p className="caption">Next · {context.tripActive ? trip.state : "Outside your trip dates"}</p>
      <h2>{trip.state === "In the Haram" && current && context.iqamah > now ? `Iqāmah in about ${duration(context.iqamah.valueOf() - now.valueOf())}`
        : context.leave > now ? `Leave by ${localTime(context.leave)}` : `${next.name} at ${localTime(next.starts)}`}</h2>
      <p className="muted">{next.name} · {localTime(next.starts)} · Makkah local time</p>
      {trip.state === "In the Haram" ? <p className="muted small">Iqāmah times are approximate. Check announcements in the masjid.</p> : <p className="muted small">Includes {trip.walk} minutes walking and time for the crowd.</p>}
      <label className="field"><span className="muted">Where are you now?</span>
        <select value={trip.state} onChange={event => {
          const state = event.currentTarget.value as Trip["state"];
          void save(old => ({ ...old, state }));
        }}>{states.map(state => <option key={state}>{state}</option>)}</select>
      </label>
      <div className="equal-row"><Link className="action light" to="/umrah/ask">{t("askHome")}</Link>
        <Link className="action light" to="/umrah/plan">{t("umrahPrepTrip")}</Link></div>
    </section></ContextMenuTrigger>
      <ContextMenuContent className="ask-now-menu">
        <ContextMenuItem asChild><Link to="/umrah/ask">{t("askHome")}</Link></ContextMenuItem>
        <ContextMenuItem asChild><Link to="/umrah/plan">{t("umrahPrepTrip")}</Link></ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
    <section className="card stack">
      <h2>Today in Makkah</h2>
      {prayerIds.map(id => <div className="row-between" key={id}><span>{prayerNames[id]}</span><time>{localTime(context.times[id])}</time>
        <button className={`action ${trip.haramPrayers[context.day]?.includes(id) ? "soft" : "light"}`}
          aria-pressed={trip.haramPrayers[context.day]?.includes(id) ?? false} onClick={() => void save(old => {
            const today = old.haramPrayers[context.day] ?? [];
            return { ...old, haramPrayers: { ...old.haramPrayers, [context.day]: today.includes(id) ? today.filter(value => value !== id) : [...today, id] } };
          })}>{trip.haramPrayers[context.day]?.includes(id) ? "Prayed in Haram ✓" : "Log in Haram"}</button>
      </div>)}
      {afterFajr && <p className="muted">After sunrise · leave time for Ḍuḥā if you wish.</p>}
      {midday && <p className="muted">Take a water break before your next walk.</p>}
      {next.id === "fajr" && <button className="action soft" onClick={() => saveCalendar([{ id: `tahajjud-${next.date}`, title: "Tahajjud", start: context.tahajjud, alarm: 0 }], "awwab-tahajjud.ics")}>Add a Tahajjud alarm</button>}
    </section>
    <section className="card compact-stack">
      <h2>{trip.state === "In the Haram" ? "In the Haram" : "Quiet moments"}</h2>
      {trip.gate && <p className="muted">Entry gate · {trip.gate}</p>}
      <div className="equal-row">
        <button className="action soft" onClick={() => void save(old => ({ ...old, dhikr: { ...old.dhikr, [context.day]: (old.dhikr[context.day] ?? 0) + 1 } }))}>Dhikr · {count}</button>
        <Link to="/learn/surahs" className="action light">Continue Quran</Link>
      </div>
      <div className="equal-row">
        <button className="action light" onClick={() => void save(old => ({ ...old, juz: { ...old.juz, [context.day]: (old.juz[context.day] ?? 0) + 1 } }))}>Juz read · {trip.juz[context.day] ?? 0}</button>
        <Link to="/umrah/rituals" className="action light">Ṭawāf counter</Link>
      </div>
      <Link className="action soft" to="/umrah/focus">Open Haram focus</Link>
    </section>
    <ShareLink className="action soft" to="/share?template=umrah&from=umrah">Share an Umrah card</ShareLink>
  </>;
}

export function HaramFocus() {
  const { trip, now, save } = useTrip();
  const { day, current, iqamah, next } = umrahContext(now, trip);
  const count = trip.dhikr[day] ?? 0;
  return <>
    <SectionNav title="In the Haram" back="/umrah" />
    <section className="card night stack">
      <p className="caption">{current?.name ?? next.name} · Makkah time</p>
      <h2>{iqamah && iqamah > now ? `Iqāmah in about ${duration(iqamah.valueOf() - now.valueOf())}` : `Next adhan · ${localTime(next.starts)}`}</h2>
      <p className="muted">Check the masjid announcements for the local iqāmah.</p>
      {trip.gate && <p>Entry gate · {trip.gate}</p>}
    </section>
    <button className="action" onClick={() => void save(old => ({ ...old, dhikr: { ...old.dhikr, [day]: (old.dhikr[day] ?? 0) + 1 } }))}>Count dhikr · {count}</button>
    <div className="equal-row"><Link className="action light" to="/learn/surahs">Continue Quran</Link><Link className="action soft" to="/umrah/duas">Duʿā requests</Link></div>
    <button className="action light" onClick={() => void save(old => ({ ...old, step: 2 }))}>Prepare a manual ṭawāf count</button>
    <Link className="text-button" to="/umrah/rituals">Open ritual guide</Link>
  </>;
}

export function UmrahRituals() {
  const { trip, save } = useTrip();
  const step = ritual.steps[trip.step] ?? ritual.steps[0];
  const isTawaf = step.id === "tawaf";
  const isSai = step.id === "sai";
  const count = isTawaf ? trip.tawaf : trip.sai.count;
  return <>
    <section className="card night stack">
      <p className="caption">Step {trip.step + 1} of 7</p><h2>{step.title}</h2>
      {step.notes?.map(note => <p className="muted" key={note}>{note}</p>)}
      {step.id === "talbiyah" && <><ArabicText text={duas.talbiyah.arabic} citation={duas.talbiyah.source} /><a className="caption" href={duas.talbiyah.url}>{duas.talbiyah.source}</a></>}
      {isTawaf && <div className="tawaf-diagram" aria-label="Diagram of the Kaʿbah and tawaf direction" role="img"><span>Kaʿbah</span><i>↺</i></div>}
      {(isTawaf || isSai) && <>
        <div className="row-between"><strong className="numeral">{count} / 7</strong><span>{isTawaf ? "Rounds · manual" : trip.auto && trip.gps ? "Laps · walk with me" : "Laps · manual"}</span></div>
        <div className="equal-row">
          <button className="action light" disabled={count <= 0} onClick={() => void save(old => isTawaf
            ? { ...old, tawaf: Math.max(0, old.tawaf - 1) }
            : { ...old, sai: correctSai(old.sai, old.sai.count - 1, Date.now()) })}>Correct − 1</button>
          <button className="action gold" disabled={count >= 7} onClick={() => void save(old => isTawaf
            ? { ...old, tawaf: Math.min(7, old.tawaf + 1) }
            : { ...old, sai: correctSai(old.sai, old.sai.count + 1, Date.now()) })}>Count + 1</button>
        </div>
      </>}
      <div className="equal-row">
        <button className="action light" disabled={trip.step < 1} onClick={() => void save(old => ({ ...old, step: Math.max(0, old.step - 1) }))}>Previous step</button>
        <button className="action soft" disabled={trip.step >= 6} onClick={() => void save(old => ({ ...old, step: Math.min(6, old.step + 1) }))}>Next step</button>
      </div>
    </section>
    <section className="compact-stack">
      <h2>Seven steps</h2>
      {ritual.steps.map((item, i) => <button className="list-row" key={item.id} aria-current={trip.step === i} onClick={() => void save(old => ({ ...old, step: i }))}>
        <span className="icon-box">{i + 1}</span><span><strong>{item.title}</strong></span></button>)}
    </section>
    <section className="card compact-stack"><h2>Voice guidance</h2><VerseAudio audioRef={`umrah:${step.id}`} label={step.title} /></section>
    <p className="card tint muted">Scholars differ on some details. Ask your group’s guide or a scholar you trust.</p>
    <Link to="/print/umrah-guide" className="action soft">Print Umrah guide</Link>
  </>;
}

export function UmrahDuas() {
  const { trip, save, now } = useTrip();
  const day = umrahContext(now, trip).day;
  return <>
    <section className="card stack">
      <h2>Between the Yemeni corner and Black Stone</h2>
      <ArabicText text={duas.good.arabic} citation={duas.good.source} />
      <p>{duas.good.meaning}</p>
      <a className="caption" href={duas.good.url}>{duas.good.source}</a>
    </section>
    <section className="card stack">
      <h2>Talbiyah</h2>
      <ArabicText text={duas.talbiyah.arabic} citation={duas.talbiyah.source} />
      <p>{duas.talbiyah.meaning}</p>
      <a className="caption" href={duas.talbiyah.url}>{duas.talbiyah.source}</a>
    </section>
    <section className="card stack">
      <h2>Duʿā requests</h2>
      <form className="compact-stack" onSubmit={event => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = new FormData(form);
        const name = String(values.get("name")).trim();
        const request = String(values.get("request")).trim();
        if (!name || !request) return;
        void save(old => ({ ...old, requests: [...old.requests, { id: crypto.randomUUID(), name, for: request, done: [] }] }));
        form.reset();
      }}>
        <label className="field">Name<input name="name" required maxLength={100} /></label>
        <label className="field">Request<input name="request" required maxLength={500} /></label>
        <button className="action soft"><Plus size={17} /> Add request</button>
      </form>
      {trip.requests.map(item => <div className="list-row" key={item.id}>
        <span className="icon-box"><Heart size={19} /></span><span><strong>{item.name}</strong><small>{item.for}</small></span>
        <button className="action light" aria-pressed={item.done.includes(day)} onClick={() => void save(old => ({
          ...old, requests: old.requests.map(request => request.id === item.id ? {
            ...request, done: request.done.includes(day) ? request.done.filter(date => date !== day) : [...request.done, day],
          } : request),
        }))}>{item.done.includes(day) ? "Prayed ✓" : "Prayed"}</button>
      </div>)}
    </section>
  </>;
}

export function UmrahPlan() {
  const { trip } = useTrip();
  const navigate = useNavigate();
  return <>
    <SectionNav title="Your Umrah trip" back="/umrah" />
    <UmrahTripForm trip={trip} gates={gateNames} />
    <UmrahTripImport onImported={() => navigate("/umrah")} />
    <Link className="action soft" to="/umrah/location">Walk with me</Link>
  </>;
}

export function WalkWithMe() {
  const { trip, save } = useTrip();
  const available = Boolean(safā && marwah);
  return <>
    <SectionNav title="Walk with me" back="/umrah" />
    <section className="card stack">
      <h2>Location stays on this device</h2>
      <p className="muted">Allow location while Umrah mode is open to find your hotel or use the live guide. You can turn it off here any time.</p>
      <button className="action" aria-pressed={trip.gps} onClick={() => void save(old => ({ ...old, gps: !old.gps }))}>{trip.gps ? "Turn off location" : "Allow location"}</button>
      <label className="with-icon"><input type="checkbox" disabled={!trip.gps || !available} checked={trip.auto}
        onChange={event => void save(old => ({ ...old, auto: event.target.checked }))} /> Count saʿy laps automatically (beta)</label>
      {!available && <p className="muted small">Manual lap counting is available while location data for the two ends is being prepared.</p>}
      <p className="muted small">You can correct the lap count at any time. Ṭawāf rounds are counted by hand.</p>
    </section>
  </>;
}

export function UmrahMapPage() {
  const { trip, point, save } = useTrip();
  return <Suspense fallback={<p role="status">Opening the offline map…</p>}>
    <OfflineMap trip={trip} point={point} points={pins} save={save} />
  </Suspense>;
}
