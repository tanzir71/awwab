import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useClock, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { dateKey, formatTime } from "@/lib/dates";
import { emptyReadingPractice, practicePage, readingFlowPlaceKey, resumeFlowReading, type ReadingFlowPlace } from "@/lib/readingPractice";
import { studyNames } from "@/lib/study-copy";
import { distance, makkah, tawafRounds, toggleUmrahDua, umrahContext, type Coord, type UmrahTrip, type UmrahTripUpdater } from "@/lib/umrah";
import { nearbyMapPoint } from "@/lib/umrahMapPlaces";
import duas from "../../docs/content/umrah-duas.json";

function FocusClock({ now, trip }: { now: Date; trip: UmrahTrip }) {
  const { t, locale } = useCopy();
  const { current, iqamah, next } = umrahContext(now, trip);
  const seconds = iqamah && iqamah > now ? Math.ceil((iqamah.valueOf() - now.valueOf()) / 1000) : undefined;
  const digits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false });
  const countdown = seconds === undefined ? "" : `${digits.format(Math.floor(seconds / 60))}:${digits.format(seconds % 60)}`;
  return <section className="haram-focus-clock" aria-label={t(seconds === undefined ? "umrahFocusLocalTime" : "umrahFocusApprox")}>
    <p className="muted">{seconds === undefined ? t("umrahFocusNext", { prayer: t(next.id) })
      : t("umrahFocusIqamah", { prayer: t(current?.id ?? next.id) })}</p>
    {seconds === undefined ? <time dateTime={next.starts.toISOString()} className="haram-focus-time" dir="ltr">
      {formatTime(next.starts, makkah.timeZone, locale)}
    </time> : <time className="haram-focus-time" dir="ltr" dateTime={`PT${seconds}S`}>{countdown}</time>}
    <p className="small muted">{t(seconds === undefined ? "umrahFocusLocalTime" : "umrahFocusApprox")}</p>
    <p className="small muted">{t("umrahFocusAnnouncements")}</p>
  </section>;
}

function VoluntaryTawaf({ count, save }: { count: number; save: UmrahTripUpdater }) {
  const { t } = useCopy();
  const number = t("umrahGuideCount", { count, total: 7 });
  return <Dialog>
    <DialogTrigger type="button" className="haram-focus-tile">
      <DesignIcon name="umrah-focus-cube" size={20} />
      <strong>{t("umrahFocusTawaf")}</strong>
      <small>{count ? number : t("umrahFocusCounterReady")}</small>
    </DialogTrigger>
    <DialogContent className="haram-focus-tawaf card" showCloseButton={false}>
      <DialogTitle>{t("umrahFocusTawaf")}</DialogTitle>
      <DialogDescription>{t("umrahGuideRounds")}</DialogDescription>
      <strong className="haram-focus-rounds" aria-live="polite">{number}</strong>
      <div className="equal-row">
        <button type="button" className="action light" disabled={count <= 0}
          onClick={() => void save(old => ({ ...old, voluntaryTawaf: tawafRounds(old.voluntaryTawaf ?? 0, -1) }))}>
          {t("umrahGuideCorrect", { count: 1 })}
        </button>
        <button type="button" className="action" disabled={count >= 7}
          onClick={() => void save(old => ({ ...old, voluntaryTawaf: tawafRounds(old.voluntaryTawaf ?? 0, 1) }))}>
          {t("umrahGuideCountLap", { count: 1 })}
        </button>
      </div>
      {count === 7 && <button className="action soft" type="button" onClick={() => void save(old =>
        old.voluntaryTawaf === 7 ? { ...old, voluntaryTawaf: 0 } : old)}>{t("umrahFocusAnotherTawaf")}</button>}
      <div className="equal-row">
        <Link className="action light" to="/umrah/rituals">{t("umrahFocusRitualGuide")}</Link>
        <DialogClose className="action soft">{t("umrahFocusDone")}</DialogClose>
      </div>
    </DialogContent>
  </Dialog>;
}

export function HaramFocusPanel({ trip, gate, point, save }: { trip: UmrahTrip; gate?: string; point?: Coord; save: UmrahTripUpdater }) {
  const { t, language } = useCopy();
  const now = useClock(1_000);
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const progress = useRecord("reading-practice", emptyReadingPractice);
  const bookmark = useRecord<ReadingFlowPlace | undefined>(readingFlowPlaceKey, undefined);
  const { chapter, ayah } = resumeFlowReading(progress, bookmark);
  const day = dateKey(now, makkah.timeZone);
  const count = trip.dhikr[day] ?? 0;
  const name = t("umrahFocusDhikr");
  const { arabic, source, url, count: target } = duas.subhanallah;
  const remaining = trip.requests.filter(request => !request.done.includes(day)).length;
  const user = nearbyMapPoint(point, "makkah");
  const hotel = nearbyMapPoint(trip.hotel.point, "makkah");
  const meters = user && hotel ? distance(user, hotel) : undefined;
  const distanceLabel = meters === undefined ? "" : meters < 1000 ? t("umrahMapDistanceM", { meters: Math.round(meters) })
    : t("umrahMapDistanceKm", { kilometers: meters / 1000 });

  function countDhikr() {
    const today = dateKey(new Date(), makkah.timeZone);
    void save(old => ({ ...old, dhikr: { ...old.dhikr, [today]: (old.dhikr[today] ?? 0) + 1 } }));
  }

  async function leave() {
    if (leaving) return;
    setLeaving(true);
    const saved = await save(old => old.state === "In the Haram" ? { ...old, state: "Walking" } : old);
    if (saved) navigate("/umrah", { replace: true });
    else setLeaving(false);
  }

  return <article className="haram-focus night">
    <header className="row-between haram-focus-heading">
      <h1 className="caption">{t("umrahFocusTitle")}</h1>
      <button className="haram-focus-leave" type="button" disabled={leaving} onClick={() => void leave()}>{t("umrahFocusLeave")}</button>
    </header>
    <FocusClock now={now} trip={trip} />
    <section className="haram-focus-card haram-focus-dhikr">
      <ArabicText text={arabic} citation={source} words={[{ transliteration: "Subḥāna" }, { transliteration: "llāhi" }]} />
      <div className="haram-focus-dhikr-meta">
        <p className="small muted" aria-live="polite">{count <= target ? t("umrahFocusDhikrTarget", { name, count, target })
          : t("umrahFocusDhikrToday", { name, count })}</p>
        <a className="small haram-focus-source" href={url} rel="noreferrer" aria-label={t("umrahFocusAfterPrayer", { source })}>{source}</a>
      </div>
      <button type="button" className="action gold" onClick={countDhikr}>{t("umrahFocusTap")}</button>
    </section>
    <div className="equal-row">
      <Link className="haram-focus-tile" to={practicePage("flow", chapter.number, ayah)} state={{ from: "haram-focus" }}>
        <DesignIcon name="umrah-focus-book" size={20} />
        <strong>{t("umrahFocusContinue")}</strong>
        <small>{t("umrahFocusReadingPlace", { surah: studyNames.surah(language, chapter.number, chapter.title), ayah })}</small>
      </Link>
      <VoluntaryTawaf count={trip.voluntaryTawaf ?? 0} save={save} />
    </div>
    <section className="haram-focus-card haram-focus-requests">
      <h2>{trip.requests.length
        ? <Link to="/umrah/duas" aria-description={t("umrahFocusAllRequests")}>{t("umrahFocusRequests", { count: remaining })}</Link>
        : t("umrahFocusRequestTitle")}</h2>
      {trip.requests.slice(0, 3).map(request => {
        const done = request.done.includes(day);
        return <button className="haram-focus-request" type="button" aria-pressed={done} key={request.id} onClick={() => {
          const today = dateKey(new Date(), makkah.timeZone);
          void save(old => ({ ...old, requests: toggleUmrahDua(old.requests, request.id, today) }));
        }}>
          <span className="haram-focus-request-check" aria-hidden="true">{done && <DesignIcon name="onboarding-mode-check" size={14} />}</span>
          <bdi>{request.name} · {request.for}</bdi>
        </button>;
      })}
      {!trip.requests.length && <>
        <p className="small muted">{t("umrahFocusNoRequests")}</p>
        <Link to="/umrah/duas" className="text-button">{t("umrahFocusAddRequest")}</Link>
      </>}
    </section>
    {(gate || trip.hotel.point) && <footer className="haram-focus-footer small muted">
      {gate && <span>{t("umrahFocusEntry", { gate })}</span>}
      {trip.hotel.point && <Link to="/umrah/map#back-to-hotel" aria-description={t("umrahWalkHotel")}>
        {distanceLabel ? t("umrahFocusHotelDistance", { distance: distanceLabel }) : t("umrahWalkHotel")}
      </Link>}
    </footer>}
  </article>;
}
