import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import PrayerTimeline, { RakatCards } from "@/components/PrayerTimeline";
import { SectionHeading, SectionNav } from "@/components/Surface";
import { TodayDashboard, type TodayPracticeItem } from "@/components/TodayDashboard";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { addDays, dateKey, duration, formatDay, formatTime } from "@/lib/dates";
import { calendarDefaults, calendarEvents, eventDisplayDates, hijriLabel } from "@/lib/hijri";
import { formatLocale } from "@/lib/languagePreferences";
import { currentPrayerSchedule, methodNames, prayerDay } from "@/lib/prayerServices";
import { jamaatForPrayer, mosqueDefaults } from "@/lib/mosques";
import { db, logPrayer, type Settings } from "@/lib/storageService";
import { isDue, type Reviews } from "@/lib/reviews";
import { message } from "@/lib/copy";
import { guideRakats } from "@/lib/prayerGuide";
import { studyNames } from "@/lib/study-copy";
import { prayerStatusNames, type Prayer } from "@/types/Prayer";
import hadith from "../../docs/content/hadith-curated.json";
import qaida from "../../docs/content/qaida-lessons.json";
import surahs from "../../docs/content/surahs-for-salah.json";

const prayerArabic = { fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
const statusSaved = ["done", "late", "qada"];
export const istighfar = "أَسْتَغْفِرُ ٱللَّهَ";
const collectionNames = { bukhari: "Bukhari", muslim: "Muslim", tirmidhi: "Tirmidhi" };

export default function Today({ settings, now, desktop }: { settings: Settings; now: Date; desktop: boolean }) {
  const logs = usePrayerLogs();
  const calendar = useRecord("calendar", calendarDefaults);
  const progress = useRecord<Record<string, number>>("istighfar", {});
  const mosques = useRecord("mosques", mosqueDefaults);
  const reviews = useRecord<Reviews>("reviews", {});
  const lesson = useRecord("qaida-current", 1);
  const { day, current, next, prayers } = currentPrayerSchedule(settings.city, settings.method, settings.school, now, logs);
  const [search, setSearch] = useSearchParams();
  const [selected, select] = useState<Prayer>();
  const quickLog = search.get("log") === "1";
  const suggested = current?.status === "now" ? current : prayers.find(prayer => prayer.status === "missed") ?? current ?? next;
  const selection = selected ?? (quickLog ? suggested : undefined);
  const selectedCurrent = selection && (prayers.find(prayer => prayer.id === selection.id && prayer.date === selection.date) ?? selection);
  const events = calendarEvents(day, addDays(day, 180), settings.hijriAdjust, calendar).filter(item => item.kind !== "weekly");
  const eventRange = events.filter((item, index) => events.findIndex(event => event.title === item.title) === index).slice(0, 3);
  const daily = hadith.items[Math.floor(Date.parse(day) / 86400000) % hadith.items.length];
  const zone = settings.city.timeZone;
  const language = settings.language;
  const locale = formatLocale(settings);
  const t = message.bind(null, settings);
  const mode = settings.mode;
  const maktabDesktop = mode === "maktab" && desktop;
  const group = mode === "maktab" ? "maktab-today" : "today";
  const headline = current ?? next;
  const due = Object.entries(reviews).find(([id, review]) => /^\d+$/.test(id) && isDue(review, now));
  const dueSurah = surahs.surahs.find(item => item.number === Number(due?.[0])) ?? surahs.surahs.find(item => item.number === 103);
  const currentLesson = qaida.lessons.find(item => item.n === lesson) ?? qaida.lessons[0];
  const jamaat = jamaatForPrayer(headline, zone, mosques);
  const countdown = duration((current ? current.ends : next.starts).valueOf() - now.valueOf(), locale);
  const hasTimes = Number.isFinite(headline.starts.valueOf());
  const fard = headline.rakats.find(rakat => rakat.type === "fard");
  const dateStyle = { weekday: "short", day: "numeric", month: "short" } as const;
  const practiceItems: TodayPracticeItem[] = [
    {
      to: `/learn/surahs/${dueSurah.number}?mode=recall`, icon: mode === "maktab" ? "book" : "book1", minutes: 2,
      title: t("recallSurah", { name: studyNames.surah(language, dueSurah.number, dueSurah.transliteration) }),
      detail: t("todayRecallDetail", { count: dueSurah.words }) + (due ? ` · ${t("dueNow")}` : ""),
    },
    {
      to: `/learn/qaida/${currentLesson.n}`, icon: "pen", minutes: 3,
      title: t("lessonTitle", { number: currentLesson.n, title: studyNames.lesson(language, currentLesson.n, currentLesson.title) }),
      detail: t("todayQaidaDetail", { minutes: 3 }),
    },
  ];
  function closeLog() {
    select(undefined);
    if (quickLog) setSearch(previous => {
      const updated = new URLSearchParams(previous);
      updated.delete("log");
      return updated;
    }, { replace: true });
  }
  async function record(prayer: Prayer, action: "log" | "late" | "undo") {
    try {
      if (action === "undo") await db.prayers.delete([prayer.date, prayer.id]);
      else if (action === "late") {
        await db.prayers.put({ date: prayer.date, prayer: prayer.id, status: "late", at: new Date().toISOString() });
      } else await logPrayer(prayer, new Date(), jamaatForPrayer(prayer, zone, mosques)?.id);
      closeLog();
      toast(t(action === "undo" ? "prayerRemoved" : prayer.status === "missed" ? "qadaRecorded" : "prayerRecorded"));
    } catch {
      toast.error(t("prayerSaveError"));
    }
  }

  const intro = <header className="prayer-intro row-between">
      <div className="today-greeting">
        <p className="caption">{formatDay(day, dateStyle, locale)} · {hijriLabel(day, settings.hijriAdjust, calendar.anchors, locale)}{maktabDesktop && ` · ${settings.city.name}`}</p>
        <h1>{t("greeting")}</h1>
        {!maktabDesktop && <Link className="small with-icon muted today-location" to="/you/prayer">
          <DesignIcon size={14} name={`${group}-pin`} />{settings.city.name} · {methodNames[settings.method]} method · {settings.school === "hanafi" ? "Hanafi Asr" : "Standard Asr"}
        </Link>}
      </div>
      {maktabDesktop ? <div className="equal-row today-print-actions">
        <Link className="action light" to="/print/timetable">{t("printThisMonth")}</Link>
        <Link className="action soft" to="/plan/mosques">{t("mosques")}</Link>
      </div> : <Link className="icon-button" to="/you/reminders" aria-label={t("reminders")}><DesignIcon name={`${group}-bell`} /></Link>}
    </header>;
  const hero = <section className="card night prayer-hero stack">
      {!maktabDesktop && <DesignIcon name={`${group}-motifstar8`} size={220} className="hero-motif" />}
      <p className="caption">{hasTimes ? t(current ? "currentPrayer" : "nextPrayer", { time: formatTime(current ? current.ends : next.starts, zone, locale) }) : t("prayerTimes")}</p>
      <div className="with-icon prayer-hero-title"><h2>{t(headline.id)}</h2><ArabicText text={prayerArabic[headline.id]} /></div>
      {(!maktabDesktop || !hasTimes) && <p className="prayer-remaining">{hasTimes ? t(current ? "prayerRemaining" : "prayerStarts", { time: countdown, count: fard?.count ?? 0 }) : t("prayerUnavailable")}</p>}
      {jamaat && <Link to="/plan/mosques" className="chip jamaat"><DesignIcon size={16} name={`${group}-pin1`} /> <span>{t("jamaat", jamaat)}</span></Link>}
      <RakatCards groups={guideRakats(headline.rakats, settings)} settings={settings} />
      <div className="equal-row">
        {current && !statusSaved.includes(current.status)
          ? <button className="action gold" onClick={() => void record(current, "log")}>{t("iPrayed", { name: t(current.id) })}</button>
          : <Link className="action gold" to="/today/week">{t("weekView")}</Link>}
        <Link className="action light" to={`/today/guide/${headline.id}`}>{t("howToPray")}</Link>
      </div>
    </section>;
  const prayerList = <section className="today-prayers compact-stack">
      <SectionHeading title={t("todayPrayers")} to="/today/week" label={t("weekView")} />
      <PrayerTimeline prayers={prayers} settings={settings} now={now} mosques={maktabDesktop ? mosques : undefined} onAction={select} />
    </section>;
  const practice = <section className="today-practice compact-stack">
      <SectionHeading title={t(maktabDesktop ? "todayFiveMinutes" : "todayPractice")} to="/learn" label={t("adjustPractice")} />
      {practiceItems.map(item =>
        <Link key={item.to} className="list-row" to={item.to}>
          <span className="icon-box"><DesignIcon name={`${group}-${item.icon}`} size={24} /></span>
          <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          <DesignIcon name={`${group}-chevr`} size={24} />
        </Link>)}
      <div className="card compact-stack today-istighfar">
        <div className="row-between"><Link className="with-icon" to="/return">
          {!maktabDesktop && <span className="icon-box"><DesignIcon name={`${group}-${mode === "maktab" ? "ret1" : "ret2"}`} size={20} /></span>}
          <span><strong>Astaghfirullah</strong><small>{t("todayIstighfarProgress", { count: progress[day] ?? 0 })}</small></span>
        </Link><ArabicText text={istighfar} /></div>
        <progress value={Math.min(100, progress[day] ?? 0)} max={100} aria-label={t("istighfarProgress")} />
      </div>
    </section>;
  const hadithCard = <section className="card soft hadith-quote">
      <a className="caption" href={daily.url}>{daily.grade} · {collectionNames[daily.collection]} {daily.number}</a>
      <blockquote>{daily.summary.replace("He ﷺ", "The Prophet")}</blockquote>
      {!maktabDesktop && <p className="small muted">{t("hadithEncouragement")}</p>}
    </section>;
  const upcoming = <section className="today-events compact-stack">
      <SectionHeading title={t("comingUp")} to="/plan" label={t("calendar")} />
      <div className="chips">
        {eventRange.map(event => <Link className="chip soft" key={event.id} to={`/plan?event=${event.id}`}>
          {event.title} · {eventDisplayDates(event, language, t("dateOr"))}
        </Link>)}
      </div>
    </section>;
  const printCard = <section className="card tint today-print compact-stack">
      <h2>{t("printableThisMonth")}</h2>
      <p className="small muted">{t("printablePrayerDescription")}</p>
      <Link className="action light" to="/print/timetable">{t("previewA4")}</Link>
    </section>;
  return <>
    {desktop && mode === "adult" ? <TodayDashboard settings={settings} now={now} day={day} prayers={prayers} current={current} next={next}
      logs={logs} mosques={mosques} reviews={reviews} calendar={calendar} events={eventRange} practice={practiceItems}
      istighfar={progress[day] ?? 0} onAction={select} /> : <div className="prayer-layout stack" data-desktop-maktab={maktabDesktop}>
      {intro}
      {maktabDesktop ? <div className="maktab-prayer-columns">
        <div className="stack">{hero}{hadithCard}</div>
        <div className="stack">{prayerList}{upcoming}</div>
        <div className="stack">{practice}{printCard}</div>
      </div> : <>{hero}{prayerList}{practice}{hadithCard}{upcoming}</>}
    </div>}
    <Dialog open={Boolean(selectedCurrent)} onOpenChange={open => { if (!open) closeLog(); }}>
      {selectedCurrent && <DialogContent className="awwab-dialog">
        <DialogTitle>{t(selectedCurrent.id)}</DialogTitle>
        <DialogDescription className="muted">{t(selectedCurrent.status)}</DialogDescription>
        {Number.isFinite(selectedCurrent.starts.valueOf()) && <p className="muted">{formatTime(selectedCurrent.starts, zone, locale)} – {formatTime(selectedCurrent.ends, zone, locale)} · {settings.city.name}</p>}
        <Link className="action soft" to={`/today/guide/${selectedCurrent.id}`}>{t("howToPray")}</Link>
        {selectedCurrent.status === "now" && <div className="equal-row">
          <button className="action" onClick={() => void record(selectedCurrent, "log")}>{t("iPrayedShort")}</button>
          <button className="action light" onClick={() => void record(selectedCurrent, "late")}>{t("logLate")}</button>
        </div>}
        {selectedCurrent.status === "missed" && Number.isFinite(selectedCurrent.ends.valueOf()) && <button className="action" onClick={() => void record(selectedCurrent, "log")}>{t("logQada")}</button>}
        {statusSaved.includes(selectedCurrent.status) && <button className="action light" onClick={() => void record(selectedCurrent, "undo")}>{t("undoPrayer")}</button>}
      </DialogContent>}
    </Dialog>
  </>;
}

export function PrayerWeek({ settings, now }: { settings: Settings; now: Date }) {
  const logs = usePrayerLogs();
  const today = dateKey(now, settings.city.timeZone);
  const [offset, setOffset] = useState(0);
  return <div className="stack">
    <SectionNav title="Week view" back="/today" />
    <div className="equal-row">
      <button className="action soft" onClick={() => setOffset(value => value - 7)}>Previous week</button>
      <button className="action soft" disabled={offset >= 0} onClick={() => setOffset(value => value + 7)}>Next week</button>
    </div>
    {Array.from({ length: 7 }, (_, index) => addDays(today, offset + index - 6)).map(day => <section className="card compact-stack" key={day}>
      <h2 className="with-icon"><CalendarDays size={20} />{formatDay(day)}</h2>
      <div className="chips">{prayerDay(day, settings.city, settings.method, settings.school, now, logs).map(prayer =>
        <span key={prayer.id} className="chip" title={prayerStatusNames[prayer.status]}>{prayer.name} · {prayerStatusNames[prayer.status]}</span>)}</div>
    </section>)}
  </div>;
}
