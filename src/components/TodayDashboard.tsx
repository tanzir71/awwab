import { Link } from "react-router-dom";
import { useRecord } from "@/hooks/use-awwab";
import { message, rakatLabel } from "@/lib/copy";
import { duration, formatDay, formatTime } from "@/lib/dates";
import { eventDisplayDates, type CalendarEvent, type CalendarSettings } from "@/lib/hijri";
import { formatLocale } from "@/lib/languagePreferences";
import { jamaatForPrayer, mosqueAdhanOffset, mosqueForPrayer, type MosquePlan } from "@/lib/mosques";
import { planEventLabels } from "@/lib/plan-copy";
import { prayerDay } from "@/lib/prayerServices";
import { guideRakats } from "@/lib/prayerGuide";
import { qadaBalances, qadaDefaults, qadaForecast } from "@/lib/qada";
import { coreWordTotal, countKnownQuranWords } from "@/lib/quran";
import { isDue, type Reviews } from "@/lib/reviews";
import { prayerStatistics, type Settings } from "@/lib/storageService";
import { families } from "@/lib/takhti";
import { zakatHawl, type ZakatProfile } from "@/lib/zakat";
import { prayerIds, type Prayer, type PrayerLog } from "@/types/Prayer";
import { SectionHeading } from "./Surface";
import surahs from "../../docs/content/surahs-for-salah.json";

const practiceSurahs = surahs.surahs.slice(0, 12);
const dayStyle = { weekday: "short", month: "short", day: "numeric" } as const;
const timeAvailable = (stamp: Date) => Number.isFinite(stamp.valueOf());

export type TodayPracticeItem = { to: string; title: string; detail: string; icon: string; minutes: number };

function PrayerTime({ value, settings }: { value: Date; settings: Settings }) {
  const locale = formatLocale(settings);
  return timeAvailable(value) ? <time dateTime={value.toISOString()}>
    <span aria-hidden="true">{formatTime(value, settings.city.timeZone, locale, true)}</span>
    <span className="sr-only">{formatTime(value, settings.city.timeZone, locale)}</span>
  </time> : <span className="muted">—</span>;
}

function ScheduleBar({ prayers, now, settings }: { prayers: Prayer[]; now: Date; settings: Settings }) {
  const scheduled = prayers.filter(prayer => timeAvailable(prayer.starts) && timeAvailable(prayer.ends));
  if (!scheduled.length) return null;
  const begin = scheduled[0].starts.valueOf() - 30 * 60_000;
  const span = scheduled.at(-1).starts.valueOf() + 90 * 60_000 - begin;
  const position = (instant: Date) => Math.max(0, Math.min(100, (instant.valueOf() - begin) * 100 / span));
  return <div className="daily-time-bar" aria-hidden="true">
    <div className="daily-time-track" />
    {scheduled.map(prayer => {
      const left = position(prayer.starts);
      return <div key={prayer.id} className="daily-time-window" data-status={prayer.status} style={{ left: `${left}%`, width: `${position(prayer.ends) - left}%` }}>
        <span>{message(settings, prayer.id)}</span>
      </div>;
    })}
    {now.valueOf() >= begin && now.valueOf() <= begin + span && <div className="daily-time-now" style={{ left: `${position(now)}%` }}>
      <span>{message(settings, "now")} <PrayerTime value={now} settings={settings} /></span>
    </div>}
  </div>;
}

export function TodayDashboard({ settings, now, day, prayers, current, next, logs, mosques, reviews, calendar, events, practice, istighfar, onAction }: {
  settings: Settings; now: Date; day: string; prayers: Prayer[]; current?: Prayer; next: Prayer; logs: PrayerLog[];
  mosques: MosquePlan; reviews: Reviews; calendar: CalendarSettings; events: CalendarEvent[]; practice: TodayPracticeItem[];
  istighfar: number; onAction: (prayer: Prayer) => void;
}) {
  const t = message.bind(null, settings);
  const locale = formatLocale(settings);
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent" });
  const zone = settings.city.timeZone;
  const qaidaComplete = useRecord<number[]>("qaida-complete", []);
  const known = useRecord<string[]>("word-bank-known", []);
  const knownVerses = useRecord<string[]>("words-known", []);
  const takhti = useRecord<string[]>("takhti-practised", []);
  const qada = useRecord("qada", qadaDefaults);
  const zakat = useRecord<ZakatProfile | null>("zakat", null);
  const stats = prayerStatistics(logs, day);
  const balances = qadaBalances(qada, logs);
  const { madeUp, remaining, totalLeft } = balances;
  const { end: finish } = qadaForecast(day, balances, qada);
  const dueCount = Object.values(reviews).filter(review => isDue(review, now)).length;
  const headline = current ?? next;
  const jamaatCopy = { locale, afterAdhan: t("mosqueAdhanFiveLong", mosqueAdhanOffset) };
  const jamaat = jamaatForPrayer(headline, zone, mosques, jamaatCopy);
  const countdown = timeAvailable(headline.starts) ? duration((current ? current.ends : next.starts).valueOf() - now.valueOf(), locale) : undefined;
  const missed = prayers.find(prayer => prayer.status === "missed");
  const history = stats.recent.slice(-7).map(({ day: date }) => ({ day: date, prayers: date === day ? prayers : prayerDay(date, settings.city, settings.method, settings.school, now, logs) }));
  const hawl = zakatHawl(day, zakat, settings.hijriAdjust, calendar.anchors)?.date;
  const progress = [
    { key: "qaidaLessons", count: new Set(qaidaComplete).size, max: 17 },
    { key: "surahsSolid", count: practiceSurahs.filter(surah => reviews[surah.number]?.bucket === "manzil").length, max: practiceSurahs.length },
    { key: "coreQuranWords", count: countKnownQuranWords(knownVerses, known), max: coreWordTotal },
    { key: "takhtiFamilies", count: families.filter(family => takhti.includes(family.id)).length, max: families.length },
  ];

  return <div className="prayer-dashboard">
    <div className="daily-stats" role="group" aria-label={t("prayers")}>
      <section className="card night daily-stat"><h2 className="caption">{t(current ? "now" : "prayerTimes")}</h2>
        <p className="daily-value">{t(headline.id)}{countdown && ` · ${countdown}`}</p>
        <p className="small muted">{t("atAdhan")} <PrayerTime value={headline.starts} settings={settings} />{jamaat && ` · ${t("jamaat", jamaat)}`}</p>
      </section>
      <section className="card daily-stat"><h2 className="caption">{t("today")}</h2><p className="daily-value">{t("prayerCount", { count: stats.recent.at(-1).count, total: prayerIds.length })}</p>
        {missed && <p className="small muted">{t(missed.id)} · {t("missed")}</p>}
      </section>
      <section className="card daily-stat"><h2 className="caption">{t("consistencyThirty")}</h2><p className="daily-value">{percent.format(stats.consistency / 100)}</p>
        <p className="small muted">{t("consistencyExplanation")}</p>
        <div className="consistency-bars" aria-hidden="true">{stats.recent.slice(-14).map(({ day, count }) => <span key={day} data-active={count > 0} style={{ height: `${(count + 1) * 4}px` }} />)}</div>
      </section>
      <section className="card daily-stat"><h2 className="caption">{t("returnsStat")}</h2><p className="daily-value">{number.format(stats.returns)}</p><p className="small muted">{t("returnsExplanation")}</p></section>
      <section className="card daily-stat"><h2 className="caption">{t("dueToReview")}</h2><p className="daily-value">{number.format(dueCount)}</p>
        <Link className="small" to="/learn">{t(dueCount ? "startReview" : "noReviewsDue")}</Link>
      </section>
    </div>
    <div className="daily-data-grid">
      <section className="card daily-schedule">
        <SectionHeading title={t("todayPrayers")} to={`/today/guide/${headline.id}`} label={t("howToPray")} arrow />
        <ScheduleBar prayers={prayers} now={now} settings={settings} />
        <div className="table-scroll" role="region" aria-label={t("todayPrayers")} tabIndex={0}>
          <table className="daily-prayer-table">
            <thead><tr>{["prayer", "atAdhan", "atJamaat", "where", "rakats", "status"].map(label => <th key={label} scope="col">{t(label)}</th>)}<th scope="col"><span className="sr-only">{t("prayerLogActions")}</span></th></tr></thead>
            <tbody>{prayers.map(prayer => {
              const mosque = mosqueForPrayer(day, prayer.id, mosques);
              const time = jamaatForPrayer(prayer, zone, mosques, jamaatCopy)?.time;
              const rakats = guideRakats(prayer.rakats, settings).map(item => {
                const name = rakatLabel(settings, item.type);
                return `${number.format(item.count)}${locale === "en" ? name[0] : ` ${name}`}`;
              }).join(" · ");
              return <tr key={prayer.id}><th scope="row">{t(prayer.id)}</th><td><PrayerTime value={prayer.starts} settings={settings} /></td>
                <td><bdi>{time ?? "—"}</bdi></td><td><bdi>{mosque?.name ?? "—"}</bdi></td><td>{rakats}</td>
                <td><span className="daily-status" data-status={prayer.status}>{t(prayer.status === "missed" ? "prayerNotLogged" : prayer.status)}</span></td>
                <td>{prayer.status !== "upcoming" && <button type="button" className="chip soft daily-log" onClick={() => onAction(prayer)} aria-label={`${t(prayer.status === "missed" ? "makeUp" : "logPrayer")} · ${t(prayer.id)}`}>{t(prayer.status === "missed" ? "makeUp" : "logNow")}</button>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>
      <section className="card daily-history">
        <SectionHeading title={t("lastSevenDays")} to="/today/week" label={t("fullPrayerHistory")} arrow />
        <table className="daily-history-table">
          <thead><tr><td />{prayerIds.map(id => <th key={id} scope="col" aria-label={t(id)}>{t(id === "maghrib" ? "historyMaghribShort" : id)}</th>)}</tr></thead>
          <tbody>{history.map(({ day, prayers }) => <tr key={day}><th scope="row"><time dateTime={day}>{formatDay(day, { weekday: "short", day: "numeric" }, locale)}</time></th>
            {prayers.map(prayer => <td key={prayer.id}><span className="history-cell" data-status={prayer.status} title={t(prayer.status)}><span className="sr-only">{t(prayer.status)}</span></span></td>)}
          </tr>)}</tbody>
        </table>
        <ul className="daily-legend small muted">{[["done", "onTime"], ["late", "late"], ["missed", "prayerNotLogged"], ["qada", "qada"]].map(([status, label]) => <li key={status}><span className="history-cell" data-status={status} />{t(label)}</li>)}</ul>
      </section>
    </div>
    <div className="daily-detail-grid">
      <section className="card compact-stack"><SectionHeading title={t("todayFiveMinutes")} to="/learn" label={t("adjustPractice")} />
        {practice.map(item => <Link key={item.to} className="daily-practice-row" to={item.to}><span><strong>{item.title}</strong><small className="muted">{item.detail}</small></span><span className="chip">{t("studyMinutes", { count: item.minutes })}</span></Link>)}
        <Link className="daily-practice-row" to="/return"><span><strong>{t("todayIstighfar")}</strong><small className="muted">{t("todayIstighfarProgress", { count: istighfar, target: 100 })}</small></span><span className="chip">{t("tapAction")}</span></Link>
      </section>
      <section className="card compact-stack"><SectionHeading title={t("makeUpPrayers")} to="/return/qada" label={t("plan")} arrow />
        <p className="daily-balance"><strong className="daily-value">{number.format(totalLeft)}</strong>{finish && <small className="muted">{t(qada.withEachPrayer ? "qadaProjectedDate" : "qadaTargetDate", { count: qada.dailyGoal, date: formatDay(finish, { month: "short", day: "numeric", year: "numeric" }, locale) })}</small>}</p>
        {prayerIds.map(id => <div className="daily-qada-row" key={id}><b>{t(id)}</b><progress max={Math.max(1, madeUp[id] + remaining[id])} value={madeUp[id]} aria-label={t(id)} /><small className="muted">{t("prayersLeft", { count: remaining[id] })}</small></div>)}
      </section>
      <section className="card compact-stack"><SectionHeading title={t("comingUp")} to="/plan" label={t("calendar")} arrow />
        {events.map(event => <Link className="daily-event-row" to={`/plan?event=${event.id}`} key={event.id}>
          <span><strong>{planEventLabels(event, settings.language, t)[0]}</strong><small className="muted">{eventDisplayDates(event, locale, t("dateOr"))}</small></span>
          <span className={`chip${event.confirmed ? "" : " tint"}`}>{t(event.confirmed ? "confirmedDate" : "expectedDate")}</span>
        </Link>)}
        {hawl && <Link className="daily-event-row" to="/plan/zakat"><span><strong>{t("zakatDate")}</strong><small className="muted">{formatDay(hawl, dayStyle, locale)}</small></span><span className="chip">{t("yours")}</span></Link>}
      </section>
      <section className="card compact-stack"><SectionHeading title={t("learning")} to="/learn" label={t("learn")} arrow />
        {progress.map(item => <div className="daily-learning-row" key={item.key}>
          <div className="row-between"><b>{t(item.key)}</b><small className="muted">{number.format(item.count)} / {number.format(item.max)}</small></div>
          <progress max={item.max} value={Math.min(item.count, item.max)} aria-label={t(item.key)} />
        </div>)}
      </section>
    </div>
  </div>;
}
