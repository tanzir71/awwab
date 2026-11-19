import { useState } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import PrayerTimeline from "@/components/PrayerTimeline";
import { SectionHeading, SectionNav } from "@/components/Surface";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useDesktop, usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { addDays, dateKey, duration, formatDay, formatTime } from "@/lib/dates";
import { calendarDefaults, calendarEvents, hijriLabel } from "@/lib/hijri";
import { currentPrayerSchedule, methodNames, prayerDay, rakatNames } from "@/lib/prayerServices";
import { jamaatForPrayer, mosqueDefaults } from "@/lib/mosques";
import { db, logPrayer, prayerStatistics, type Settings } from "@/lib/storageService";
import { qadaDefaults } from "@/lib/qada";
import { isDue, type Reviews } from "@/lib/reviews";
import { message } from "@/lib/copy";
import { prayerIds, prayerNames, prayerStatusNames, type Prayer, type RakatGroup } from "@/types/Prayer";
import hadith from "../../docs/content/hadith-curated.json";
import rakat from "../../docs/content/rakat-structure.json";
import qaida from "../../docs/content/qaida-lessons.json";
import surahs from "../../docs/content/surahs-for-salah.json";

const prayerArabic = { fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
const statusSaved = ["done", "late", "qada"];
export const istighfar = "أَسْتَغْفِرُ ٱللَّهَ";
const collectionNames = { bukhari: "Bukhari", muslim: "Muslim", tirmidhi: "Tirmidhi" };

export function RakatCards({ groups }: { groups: RakatGroup[] }) {
  return <div className="rakat-grid" data-count={groups.length}>
    {groups.map((group, i) => <div data-fard={group.type === "fard"} key={i}>
      <strong>{group.count} {rakatNames[group.type]}</strong>
      <small>{group.type === "fard" ? "Obligatory" : group.type === "witr" ? "Wājib in Hanafi" : "Optional"}</small>
    </div>)}
  </div>;
}

export default function Today({ settings, now }: { settings: Settings; now: Date }) {
  const logs = usePrayerLogs();
  const desktop = useDesktop();
  const calendar = useRecord("calendar", calendarDefaults);
  const progress = useRecord<Record<string, number>>("istighfar", {});
  const mosques = useRecord("mosques", mosqueDefaults);
  const qada = useRecord("qada", qadaDefaults);
  const reviews = useRecord<Reviews>("reviews", {});
  const lesson = useRecord("qaida-current", 1);
  const { day, current, next, prayers } = currentPrayerSchedule(settings.city, settings.method, settings.school, now, logs);
  const [selected, select] = useState<Prayer>();
  const selectedCurrent = selected && (prayers.find(prayer => prayer.id === selected.id && prayer.date === selected.date) ?? selected);
  const eventRange = calendarEvents(day, addDays(day, 180), settings.hijriAdjust, calendar)
    .filter(item => item.kind !== "weekly").slice(0, 3);
  const daily = hadith.items[Math.floor(Date.parse(day) / 86400000) % hadith.items.length];
  const zone = settings.city.timeZone;
  const mode = settings.mode;
  const group = mode === "maktab" ? "maktab-today" : "today";
  const headline = current ?? next;
  const due = Object.entries(reviews).find(([id, review]) => /^\d+$/.test(id) && isDue(review, now));
  const dueSurah = surahs.surahs.find(item => item.number === Number(due?.[0] ?? 103));
  const qadaLeft = prayerIds.reduce((sum, id) => sum + Math.max(0, qada.estimated[id] - qada.madeUp[id] - logs.filter(log => log.prayer === id && log.status === "qada").length), 0);
  const lastWeek = prayerStatistics(logs, day).recent.slice(-7);
  const jamaat = jamaatForPrayer(headline, zone, mosques);
  const countdown = current ? duration(current.ends.valueOf() - now.valueOf()) : duration(next.starts.valueOf() - now.valueOf());
  const hasTimes = Number.isFinite(headline.starts.valueOf());
  const dateStyle = { weekday: "short", day: "numeric", month: "short" } as const;
  async function record(prayer: Prayer, action: "log" | "late" | "undo") {
    try {
      if (action === "undo") await db.prayers.delete([prayer.date, prayer.id]);
      else if (action === "late") {
        await db.prayers.put({ date: prayer.date, prayer: prayer.id, status: "late", at: new Date().toISOString() });
      } else await logPrayer(prayer, new Date(), jamaatForPrayer(prayer, zone, mosques)?.id);
      select(undefined);
      toast(action === "undo" ? "Prayer log removed." : prayer.status === "missed" ? "Make-up prayer recorded." : "Prayer recorded.");
    } catch {
      toast.error("The prayer log could not be saved. Try again.");
    }
  }

  return <div className="prayer-layout stack">
    <header className="prayer-intro row-between">
      <div>
        <p className="caption">{formatDay(day, dateStyle)} · {hijriLabel(day, settings.hijriAdjust, calendar.anchors)}</p>
        <h1>{message(settings, "greeting")}</h1>
        <Link className="small with-icon muted" to="/you/prayer">
          <DesignIcon size={14} name={`${group}-pin`} />{settings.city.name} · {methodNames[settings.method]} method · {settings.school === "hanafi" ? "Hanafi Asr" : "Standard Asr"}
        </Link>
      </div>
      <Link className="icon-button" to="/you/reminders" aria-label="Reminders"><DesignIcon name={`${group}-bell`} /></Link>
    </header>
    <section className="card night prayer-hero stack">
      <DesignIcon name={`${group}-motifstar8`} size={220} className="hero-motif" />
      <p className="caption">{hasTimes ? current ? `Now · until ${formatTime(current.ends, zone)}` : `Next · ${formatTime(next.starts, zone)}` : "Prayer times"}</p>
      <div className="with-icon"><h2>{headline.name}</h2><ArabicText text={prayerArabic[headline.id]} compact /></div>
      <p className="muted">{hasTimes ? current
        ? `${countdown} left to pray on time. ${mode === "maktab" ? "You still have time." : "Short on time? Start with the Fard."}`
        : `Starts in ${countdown}. You can read through the steps while you wait.`
        : "The selected calculation could not find times for this location today."}</p>
      {jamaat && <Link to="/plan/mosques" className="chip jamaat"><DesignIcon size={16} name={`${group}-pin1`} /> Jamaat {jamaat.time} · {jamaat.mosque}</Link>}
      <RakatCards groups={headline.rakats} />
      <div className="equal-row">
        {current && !statusSaved.includes(current.status)
          ? <button className="action gold" onClick={() => void record(current, "log")}>{message(settings, "iPrayed", { name: current.name })}</button>
          : <Link className="action gold" to="/today/week">Week view</Link>}
        <Link className="action light" to={`/today/guide/${headline.id}`}>How to pray</Link>
      </div>
    </section>
    <section className="compact-stack">
      <SectionHeading title={message(settings, "todayPrayers")} to="/today/week" label="Week view" />
      <PrayerTimeline prayers={prayers} zone={zone} mode={mode} onAction={select} />
    </section>
    <section className="compact-stack">
      <SectionHeading title={message(settings, "todayPractice")} to="/learn" label={message(settings, "learn")} />
      {[{ to: `/learn/surahs/${dueSurah.number}`, title: `Recall ${dueSurah.transliteration}`, detail: `Surah · ${dueSurah.words} words${due ? " · due now" : ""}`, icon: mode === "maktab" ? "book" : "book1" },
        { to: `/learn/qaida/${lesson}`, title: `Qaida · Lesson ${lesson}`, detail: qaida.lessons[lesson - 1]?.title, icon: "pen" }].map(item =>
        <Link key={item.to} className="list-row" to={item.to}>
          <span className="icon-box"><DesignIcon name={`${group}-${item.icon}`} /></span>
          <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          <ChevronRight size={18} />
        </Link>)}
      <div className="card compact-stack">
        <div className="row-between"><Link className="text-button" to="/return">Astaghfirullah · {progress[day] ?? 0} of 100</Link><ArabicText text={istighfar} compact /></div>
        <progress value={Math.min(100, progress[day] ?? 0)} max={100} aria-label="Istighfar progress" />
      </div>
    </section>
    {desktop && <section className="card compact-stack prayer-intro">
      <SectionHeading title="This week" to="/today/week" label="Open week view" />
      <div className="equal-row">
        {lastWeek.map(item => <div className="counter-tile" key={item.day}><strong>{item.count}/5</strong><small>{formatDay(item.day, { weekday: "short" })}</small></div>)}
      </div>
      <Link className="text-button" to="/return/qada">Make-up balance · {qadaLeft} prayers</Link>
    </section>}
    <section className="card soft hadith-quote">
      <a className="caption" href={daily.url}>{daily.grade} · {collectionNames[daily.collection]} {daily.number}</a>
      <blockquote>{daily.summary.replace("He ﷺ", "The Prophet")}</blockquote>
    </section>
    <section className="compact-stack prayer-intro">
      <SectionHeading title={message(settings, "comingUp")} to="/plan" label="Calendar" />
      <div className="chips">
        {eventRange.map(event => <Link className="chip soft" key={event.id} to={`/plan?event=${event.id}`}>
          {event.title} · {event.dates.map(date => formatDay(date, dateStyle)).join(" or ")}
        </Link>)}
      </div>
    </section>
    <Dialog open={Boolean(selectedCurrent)} onOpenChange={open => { if (!open) select(undefined); }}>
      {selectedCurrent && <DialogContent className="awwab-dialog">
        <DialogTitle>{selectedCurrent.name}</DialogTitle>
        <DialogDescription className="muted">{prayerStatusNames[selectedCurrent.status]}</DialogDescription>
        {Number.isFinite(selectedCurrent.starts.valueOf()) && <p className="muted">{formatTime(selectedCurrent.starts, zone)} to {formatTime(selectedCurrent.ends, zone)} · {settings.city.name}</p>}
        <Link className="action soft" to={`/today/guide/${selectedCurrent.id}`} onClick={() => select(undefined)}>How to pray</Link>
        {selectedCurrent.status === "now" && <div className="equal-row">
          <button className="action" onClick={() => void record(selectedCurrent, "log")}>I’ve prayed</button>
          <button className="action light" onClick={() => void record(selectedCurrent, "late")}>Log as late</button>
        </div>}
        {selectedCurrent.status === "missed" && Number.isFinite(selectedCurrent.ends.valueOf()) && <button className="action" onClick={() => void record(selectedCurrent, "log")}>Record make-up prayer</button>}
        {statusSaved.includes(selectedCurrent.status) && <button className="action light" onClick={() => void record(selectedCurrent, "undo")}>Undo prayer log</button>}
      </DialogContent>}
    </Dialog>
  </div>;
}

export function PrayerGuide() {
  const { id } = useParams();
  const reviews = useRecord<Reviews>("reviews", {});
  const prayer = prayerIds.find(item => item === id);
  if (!prayer) return <Link to="/today">Back to Today</Link>;
  const groups = rakat.prayers[prayer];
  const count = groups.find(group => group.type === "fard").count;
  const solid = surahs.surahs.filter(surah => surah.number !== 1 && reviews[surah.number]?.bucket === "manzil");
  return <div className="stack">
    <SectionNav title={`How to pray ${prayerNames[prayer]}`} back="/today" />
    <section className="card night compact-stack">
      <p className="caption">{groups.reduce((total, group) => total + group.count, 0)} rakʿāt in total</p>
      <RakatCards groups={groups} />
      <p>Short on time? Start with the {count} Fard.</p>
    </section>
    <p className="muted"><span className="chip soft">Hanafi reference</span> Scholars differ on details, including Witr.</p>
    <section className="compact-stack">
      <h2>The {count} Fard, rakʿah by rakʿah</h2>
      {Array.from({ length: count }, (_, i) => <div className="list-row" key={i}>
        <span className="icon-box">{i + 1}</span>
        <span><strong>{i < 2 ? "Al-Fātiḥa and a short surah" : "Al-Fātiḥa only"}{i + 1 === count ? ", then final sitting" : i === 1 ? ", then sit" : ""}</strong>
          <small>{i + 1 === count ? "Tashahhud → Ṣalawāt → duʿāʾ → Salām" : i === 1 ? "First sitting: Tashahhud" : i === 0 ? `Try ${solid[0]?.transliteration ?? "Al-Kawthar"}` : "Continue to the next rakʿah"}</small></span>
      </div>)}
    </section>
    <section className="card tint compact-stack">
      <h2>Lost count mid-prayer?</h2>
      <p>If you’re unsure whether you prayed three or four, build on what you’re sure of. The narration describes two prostrations before salām. Scholars differ on how to apply this guidance.</p>
      <a className="small" href="https://sunnah.com/muslim:571a">Ṣaḥīḥ Muslim 571a · Sahih</a>
    </section>
    <div className="equal-row"><Link className="action" to="/learn/surahs/1?mode=listen">Practise with audio</Link><Link className="action soft" to="/learn/salah">Word by word</Link></div>
  </div>;
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
