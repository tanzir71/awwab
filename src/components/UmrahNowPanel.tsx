import { Link } from "react-router-dom";
import { DesignIcon } from "@/components/DesignIcon";
import { ShareLink } from "@/components/ShareLink";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCopy } from "@/lib/copy";
import { saveCalendar } from "@/lib/calendarFile";
import { duration, formatTime } from "@/lib/dates";
import { dayDifference } from "@/lib/hijri";
import { makkah, states, umrahContext, type UmrahTrip, type UmrahTripUpdater } from "@/lib/umrah";
import { nowStateLabels } from "@/lib/umrah-now-copy";
import { prayerIds, type PrayerId } from "@/types/Prayer";

type NowProps = {
  trip: UmrahTrip; now: Date; save: UmrahTripUpdater; gate?: string; detected: boolean; locationError?: string;
};
type TimelineEvent = {
  time: Date; title: string; note: string; label?: string; path?: string; action?: () => void;
  source?: { text: string; url: string }; highlight?: boolean;
};
const haramMap = "/umrah/map#to-haram";
const duhaSource = { text: "Muslim 720 · Sahih", url: "https://sunnah.com/muslim:720" };
const tahajjudSource = { text: "Bukhari 1145 · Sahih", url: "https://sunnah.com/bukhari:1145" };

function NowProgress({ trip, day, times, save }: {
  trip: UmrahTrip; day: string; times: Record<PrayerId, Date>; save: UmrahTripUpdater;
}) {
  const { t, locale } = useCopy();
  const numbers = new Intl.NumberFormat(locale);
  const withinTrip = (date: string) => (!trip.start || date >= trip.start) && (!trip.end || date <= trip.end);
  const prayers = Object.entries(trip.haramPrayers).reduce((total, [date, ids]) =>
    total + (withinTrip(date) ? prayerIds.filter(id => ids.includes(id)).length : 0), 0);
  const juz = Object.entries(trip.juz).reduce((total, [date, read]) => total + (withinTrip(date) ? read : 0), 0);
  const requested = trip.requests.filter(request => request.done.some(withinTrip)).length;
  const todayJuz = trip.juz[day] ?? 0;

  function logPrayer(id: PrayerId) {
    void save(old => {
      const today = old.haramPrayers[day] ?? [];
      const next = today.includes(id) ? today.filter(value => value !== id) : [...today, id];
      return { ...old, haramPrayers: { ...old.haramPrayers, [day]: next } };
    });
  }

  function changeJuz(change: number) {
    void save(old => ({ ...old, juz: { ...old.juz, [day]: Math.max(0, (old.juz[day] ?? 0) + change) } }));
  }

  return <div className="umrah-now-progress">
    <Dialog>
      <DialogTrigger className="umrah-now-stat" aria-haspopup="dialog">
        <strong>{numbers.format(prayers)}</strong><small>{t("umrahNowPrayersTotal")}</small>
      </DialogTrigger>
      <DialogContent className="card umrah-now-dialog" showCloseButton={false}>
        <div className="row-between">
          <DialogTitle>{t("umrahNowPrayerLog")}</DialogTitle>
          <DialogClose className="action light">{t("umrahFocusDone")}</DialogClose>
        </div>
        <DialogDescription>{t("umrahNowAdhanNote")}</DialogDescription>
        {prayerIds.map(id => {
          const logged = trip.haramPrayers[day]?.includes(id) ?? false;
          return <div className="umrah-now-log-row" key={id}>
            <span><strong>{t(id)}</strong><small>{formatTime(times[id], makkah.timeZone, locale)}</small></span>
            <button type="button" className={`action ${logged ? "soft" : "light"}`} aria-pressed={logged}
              onClick={() => logPrayer(id)}>{t(logged ? "umrahNowLoggedHaram" : "umrahNowLogHaram")}</button>
          </div>;
        })}
      </DialogContent>
    </Dialog>
    <Dialog>
      <DialogTrigger className="umrah-now-stat" aria-haspopup="dialog">
        <strong>{numbers.format(juz)}</strong><small>{t("umrahNowJuzTotal")}</small>
      </DialogTrigger>
      <DialogContent className="card umrah-now-dialog" showCloseButton={false}>
        <div className="row-between">
          <DialogTitle>{t("umrahNowJuzLog")}</DialogTitle>
          <DialogClose className="action light">{t("umrahFocusDone")}</DialogClose>
        </div>
        <DialogDescription aria-live="polite">{t("umrahNowJuzToday", { count: todayJuz })}</DialogDescription>
        <div className="equal-row">
          <button type="button" className="action soft" disabled={!todayJuz} onClick={() => changeJuz(-1)}>{t("umrahNowJuzRemove")}</button>
          <button type="button" className="action" onClick={() => changeJuz(1)}>{t("umrahNowJuzAdd")}</button>
        </div>
        <DialogClose asChild><Link to="/learn/surahs" className="action light">{t("umrahFocusContinue")}</Link></DialogClose>
      </DialogContent>
    </Dialog>
    <Link className="umrah-now-stat" to="/umrah/duas#requests">
      <strong>{numbers.format(requested)} / {numbers.format(trip.requests.length)}</strong>
      <small>{t("umrahFocusRequestTitle")}</small>
    </Link>
  </div>;
}

export function UmrahNowPanel({ trip, now, save, gate, detected, locationError }: NowProps) {
  const { t, locale } = useCopy();
  const { day, current, next, leave, leaveForDhuhr, iqamah, duha, tripActive, tahajjud, alarmDay, times, crowd } = umrahContext(now, trip);
  const at = (date: Date) => formatTime(date, makkah.timeZone, locale);
  const atHaram = trip.state === "In the Haram" || trip.state === "Doing Umrah";
  const walking = trip.state === "Walking";
  const staying = trip.hotelPrayer?.date === next.date && trip.hotelPrayer.id === next.id;
  const waiting = atHaram && current && iqamah && iqamah > now;
  const prayer = waiting ? current : next;
  const showWalk = tripActive && !atHaram && !staying && !walking && leave > now;
  const countdown = (waiting ? iqamah : showWalk ? leave : now).valueOf() - now.valueOf();
  const countdownText = countdown < 3_600_000 ? new Intl.NumberFormat(locale, {
    style: "unit", unit: "minute", unitDisplay: "short",
  }).format(Math.ceil(countdown / 60_000)) : duration(countdown, locale);
  const nextIqamah = new Date(next.starts.valueOf() + trip.iqamah * 60_000);
  const title = waiting ? t("umrahNowIqamah", { time: at(iqamah) })
    : showWalk ? t("umrahNowLeaveBy", { time: at(leave) })
    : !tripActive || atHaram || staying ? t("umrahNowAt", { prayer: t(next.id), time: at(next.starts) })
    : t(walking ? "umrahNowOnTheWay" : "umrahNowLeaveNow");
  const tripDay = tripActive && trip.start && trip.end
    ? t("askTripDay", { day: dayDifference(day, trip.start) + 1, total: dayDifference(trip.end, trip.start) + 1 }) : "";
  const tabCaption = [t("umrah"), tripDay].filter(Boolean).join(" · ");
  const timelineTime = next.date === day || showWalk ? next.starts : times.fajr;
  const timelinePrayer = next.date === day || showWalk ? next.id : "fajr";
  const todayHotel = staying && timelineTime === next.starts;
  const upcoming = [...(!showWalk ? [] : [{
    time: leave, title: t("umrahNowWalk"), note: t(next.id === "dhuhr" ? "umrahNowWater" : "umrahNowShoeBag"), path: haramMap, highlight: true,
  }]), {
    time: timelineTime, title: t(todayHotel ? "umrahNowHotelPrayer" : "umrahNowHaramPrayer", { prayer: t(timelinePrayer) }),
    note: t(now >= times.dhuhr && now < times.asr ? "umrahNowWater" : "umrahNowAdhanNote"),
  }, {
    time: duha, title: t("umrahNowDuha"), note: t("umrahNowSunrise", { time: at(times.sunrise) }), source: duhaSource,
  }, ...(!tripActive || atHaram || leaveForDhuhr <= now || (next.id === "dhuhr" && (showWalk || staying)) ? [] : [{
    time: leaveForDhuhr, title: t("umrahNowBeforeDhuhr"), note: t("umrahNowWater"), path: haramMap,
  }]), {
    time: times.asr, label: t("umrahNowAfterAsr"), title: t("umrahFocusTawaf"), note: t("umrahNowTawafNote"), path: "/umrah/focus",
  }].sort((first, second) => first.time.valueOf() - second.time.valueOf());
  const events: TimelineEvent[] = [...upcoming, {
    time: tahajjud, title: t("umrahNowTahajjud"), note: t("umrahNowLastThird"), source: tahajjudSource,
    action: () => saveCalendar([{ id: `tahajjud-${alarmDay}`, title: t("umrahNowTahajjud"), start: tahajjud, alarm: 0 }], "awwab-tahajjud.ics"),
  }];
  const requests = trip.requests.filter(request => !request.done.includes(day));

  function chooseHotel() {
    void save(old => ({
      ...old, hotelPrayer: old.hotelPrayer?.date === next.date && old.hotelPrayer.id === next.id
        ? undefined : { date: next.date, id: next.id },
    }));
  }

  return <article className="umrah-now">
    <header className="umrah-now-header night">
      <div>
        <p className="caption">{tabCaption}</p>
        <h1>{t("umrahNowLocal", { time: at(now) })}</h1>
      </div>
      <Link to="/plan">{t("umrahNowExit")}</Link>
    </header>
    <div className="umrah-now-body">
      <section className="umrah-now-state" aria-labelledby="umrah-now-state-label">
        <h2 id="umrah-now-state-label">{t("umrahNowStatus")}</h2>
        <Link className="umrah-now-location with-icon" to="/umrah/location">
          <DesignIcon name="umrah-map-pin" size={14} />
          {t(detected ? "umrahNowLocationDetected" : trip.gps ? "umrahLocationOptions" : "umrahNowLocationEnable")}
        </Link>
        {locationError && trip.gps && <p className="small muted" role="status">{t(locationError)}</p>}
        <div className="umrah-now-states" role="group" aria-labelledby="umrah-now-state-label">
          {states.map(state => <button key={state} type="button" aria-pressed={trip.state === state}
            onClick={() => void save(old => old.state === state ? old : { ...old, state })}>
            <span>{t(nowStateLabels[state])}</span>
          </button>)}
        </div>
      </section>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <section className="umrah-now-next night" aria-label={t("askNow")}>
            <p className="caption">{waiting ? t("umrahNowHaramPrayer", { prayer: t(prayer.id) })
              : t(!tripActive ? "umrahNowOutsideDates" : staying ? "umrahNowNextHotel" : "umrahNowNextHaram", { prayer: t(next.id) })}</p>
            <div className="umrah-now-title">
              <h2>{title}</h2>
              {countdown > 0 && <span className="small">{t("umrahNowIn", { duration: countdownText })}</span>}
            </div>
            <p className="small muted">{waiting ? t("umrahFocusAnnouncements")
              : <>{staying ? t("umrahNowAdhanNote") : t("umrahNowTimes", { adhan: at(next.starts), iqamah: at(nextIqamah) })}
                {tripActive && !atHaram && !staying && !walking && <> {t(gate ? "umrahNowWalkGate" : "umrahNowWalkNote", { walk: trip.walk, crowd, gate })}</>}</>}</p>
            <div className="equal-row">
              {!tripActive ? <Link className="action gold" to="/umrah/plan">{t("umrahPlanTrip")}</Link>
                : atHaram ? <Link className="action gold" to={trip.state === "Doing Umrah" ? "/umrah/rituals" : "/umrah/focus"}>
                  {t(trip.state === "Doing Umrah" ? "umrahFocusRitualGuide" : "umrahFocusOpen")}
                </Link> : <Link className="action gold" to={haramMap}>{t("umrahNowRoute")}</Link>}
              {!tripActive ? <Link className="action light" to="/umrah/ask">{t("askHome")}</Link>
                : atHaram ? <Link className="action light" to={trip.hotel.point ? "/umrah/map#back-to-hotel" : "/umrah/ask"}>
                  {t(trip.hotel.point ? "umrahWalkHotel" : "askHome")}
                </Link> : <button className="action light" type="button" aria-pressed={staying} onClick={chooseHotel}>
                  {t(staying ? "umrahNowHotelSelected" : "umrahNowPrayHotel")}
                </button>}
            </div>
          </section>
        </ContextMenuTrigger>
        <ContextMenuContent className="ask-now-menu">
          <ContextMenuItem asChild><Link to="/umrah/ask">{t("askHome")}</Link></ContextMenuItem>
          <ContextMenuItem asChild><Link to="/umrah/plan">{t("umrahPrepTrip")}</Link></ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <section className="umrah-now-plan">
        <header className="row-between">
          <h2>{t("umrahNowPlan")}</h2><Link to="/umrah/plan" className="text-button">{t("umrahNowEdit")}</Link>
        </header>
        <ol className="umrah-now-timeline">
          {events.map(event => <li key={event.title}>
            <time dateTime={event.time.toISOString()} title={at(event.time)}>
              {event.label ?? <bdi>
                <span aria-hidden="true">{formatTime(event.time, makkah.timeZone, locale, true)}</span>
                <span className="sr-only">{at(event.time)}</span>
              </bdi>}
            </time>
            <div className="umrah-now-event" data-highlight={event.highlight || undefined}>
              {event.path ? <Link to={event.path}>{event.title}</Link>
                : event.action ? <button type="button" onClick={event.action}>{event.title}</button>
                : <strong>{event.title}</strong>}
              <small>{event.note}{event.source && <> · <a href={event.source.url}>{event.source.text}</a></>}</small>
            </div>
          </li>)}
        </ol>
      </section>
      <NowProgress trip={trip} day={day} times={times} save={save} />
      <section className="umrah-now-requests">
        <h2>{t("umrahNowPeople")}</h2>
        <p className="small muted">{requests.length ? <>
          {requests.slice(0, 3).map((request, index) => <span key={request.id}>
            {index > 0 && " · "}<bdi>{request.name}</bdi> (<bdi>{request.for}</bdi>)
          </span>)}{requests.length > 3 && <> · {t("umrahNowMore", { count: requests.length - 3 })}</>}
        </> : t(trip.requests.length ? "umrahFocusRequests" : "umrahFocusNoRequests", { count: 0 })}</p>
        <Link className="action light" to="/umrah/duas#requests">{t(requests.length ? "umrahNowPrayForPeople"
          : trip.requests.length ? "umrahFocusAllRequests" : "umrahFocusAddRequest")}</Link>
      </section>
      <ShareLink className="action soft" to="/share?template=umrah&from=umrah">{t("umrahNowShare")}</ShareLink>
    </div>
  </article>;
}
