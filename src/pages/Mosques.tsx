import { useMemo, useRef, useState, type MouseEvent } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { DesignIcon } from "@/components/DesignIcon";
import { MosqueTime, OccasionEditor, PhotoEditor, TimetableEditor, WeekEditor } from "@/components/MosqueEditors";
import { SectionNav } from "@/components/Surface";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { addDays, dateKey, formatDay } from "@/lib/dates";
import { calendarDefaults, calendarEvents, hijriOn } from "@/lib/hijri";
import { mosqueOccasionLabel, mosqueRoleLabel, mosqueSourceLabel } from "@/lib/mosque-copy";
import { assignedMosque, mapMosque, mosqueClock, mosqueDefaults, mosqueOccasions, mosqueWeek, mosqueWeekday, timetableNotice, weeklyMosque,
  type Mosque, type MosqueOccasion, type MosquePlan } from "@/lib/mosques";
import { type Settings, updateRecord } from "@/lib/storageService";
import { distance, type Coord } from "@/lib/umrah";
import { prayerIds, type PrayerId } from "@/types/Prayer";

type MosquePanel = { kind: "timetable"; mosque: Mosque }
  | { kind: "photo"; id: string }
  | { kind: "mapping"; id: PrayerId }
  | { kind: "occasion"; id?: string; occasion?: MosqueOccasion["type"] };

const calendarTitles = { eid_fitr: "Eid al-Fitr", eid_adha: "Eid al-Adha", tarawih: "Ramadan begins" };
const noticeMessage = { seasonal: "mosqueSeasonal", ramadan: "mosqueRamadan", eid: "mosqueBeforeEid", older: "mosqueStale" };

function newMosque(now: Date): Mosque {
  return { id: crypto.randomUUID(), name: "", role: "home", jamaat: {}, occasional: [], source: "visited", updatedAt: now.toISOString() };
}

export function Mosques({ settings, now }: { settings: Settings; now: Date }) {
  const { t, language } = useCopy();
  const plan = useRecord("mosques", mosqueDefaults);
  const config = useRecord("calendar", calendarDefaults);
  const day = dateKey(now, settings.city.timeZone);
  const [group, setGroup] = useState<0 | 1>(() => mosqueWeekday(day) < 5 ? 0 : 1);
  const [panel, setPanel] = useState<MosquePanel>();
  const [position, setPosition] = useState<Coord>();
  const [locating, setLocating] = useState(false);
  const opener = useRef<HTMLElement>();
  const hijri = hijriOn(day, settings.hijriAdjust, config.anchors);
  const annual = useMemo(() => calendarEvents(day, addDays(day, 370), settings.hijriAdjust, config)
    .filter(event => Object.values(calendarTitles).includes(event.title)), [day, settings.hijriAdjust, config]);
  const soon = addDays(day, 14);
  const season = annual.some(event => event.title.startsWith("Eid") && event.dates[0] <= soon) ? "eid"
    : hijri.month === 9 || annual.some(event => event.title === calendarTitles.tarawih && event.dates[0] <= soon) ? "ramadan" : undefined;
  const year = Number(day.slice(0, 4));
  const week = mosqueWeek[group];
  const groupLabel = t("mosqueGroup" + group);
  const weekendSwitches = new Map<string, PrayerId[]>();
  for (const id of prayerIds) {
    const weekday = weeklyMosque(mosqueWeek[0], id, plan).mosque;
    const weekend = weeklyMosque(mosqueWeek[1], id, plan).mosque;
    if (weekday && weekend && weekday.id !== weekend.id) weekendSwitches.set(weekend.name, [...(weekendSwitches.get(weekend.name) ?? []), id]);
  }
  const friday = assignedMosque(5, "dhuhr", plan)?.jumuah;
  const located = plan.mosques.filter(mosque => mosque.location);
  const nearest = position ? located.map(mosque => ({ mosque, meters: distance(position, mosque.location) })).sort((a, b) => a.meters - b.meters)[0] : undefined;
  const occasional = mosqueOccasions.flatMap(type => {
    const target = Number(annual.find(item => item.title === calendarTitles[type])?.dates[0].slice(0, 4) ?? year);
    return plan.mosques.flatMap(mosque => {
      const entries = mosque.occasional.filter(item => item.type === type && item.times.length).sort((a, b) => b.year - a.year);
      const entry = entries.find(item => item.year <= target) ?? entries[0];
      return entry ? [{ mosque, entry, target }] : [];
    });
  });
  const inquiry = occasional[0];
  const contact = inquiry?.mosque ?? plan.mosques[0];
  const prompt = contact && (inquiry
    ? t("mosqueAskEid", { occasion: t(mosqueOccasionLabel[inquiry.entry.type]), mosque: contact.name })
    : t("mosqueAskGeneral", { mosque: contact.name }));
  const number = new Intl.NumberFormat(language, { useGrouping: false });

  function open(event: MouseEvent<HTMLElement>, next: MosquePanel) {
    opener.current = event.currentTarget;
    setPanel(next);
  }

  async function save(change: (old: MosquePlan) => MosquePlan) {
    try { await updateRecord("mosques", mosqueDefaults, change); return true; }
    catch { toast.error(t("mosqueSaveError")); return false; }
  }

  function update(id: string, change: (mosque: Mosque) => Mosque) {
    return save(old => ({ ...old, mosques: old.mosques.map(mosque => mosque.id === id ? change(mosque) : mosque) }));
  }

  async function saveTimetable(mosque: Mosque) {
    const saved = await save(old => {
      const current = old.mosques.find(item => item.id === mosque.id);
      return { ...old, mosques: current
        ? old.mosques.map(item => item.id === mosque.id ? { ...mosque, photo: current.photo, occasional: current.occasional } : item)
        : [...old.mosques, mosque] };
    });
    if (saved) setPanel(undefined);
    return saved;
  }

  async function savePhoto(id: string, picture: Blob) {
    const saved = await update(id, current => ({ ...current, photo: picture }));
    if (saved) setPanel(undefined);
    return saved;
  }

  function findLocation() {
    if (!navigator.geolocation) { toast.error(t("mosqueLocationError")); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(result => {
      setPosition({ lat: result.coords.latitude, lon: result.coords.longitude });
      setLocating(false);
    }, () => {
      toast.error(t("mosqueLocationError"));
      setLocating(false);
    }, { timeout: 12000 });
  }

  const photoMosque = panel?.kind === "photo" ? plan.mosques.find(mosque => mosque.id === panel.id) : undefined;
  const title = panel?.kind === "timetable" ? t(panel.mosque.name ? "mosqueUpdateTimes" : "mosqueAddFull")
    : panel?.kind === "photo" ? t("mosquePhoto") : panel?.kind === "mapping" ? t("mosqueMappingTitle", { prayer: t(panel.id) }) : t("mosqueOccasional");

  return <div className="mosques-page">
    <SectionNav title={t("mosques")} back="/plan" backIcon={<DesignIcon name={settings.mode === "maktab" ? "qaida-maktab-chevl" : "surah-mobile-chevl"} size={24} />}
      action={<button className="icon-button" type="button" aria-label={t("mosqueAddFull")} aria-haspopup="dialog"
        onClick={event => open(event, { kind: "timetable", mosque: newMosque(now) })}><DesignIcon name="mosques-add" size={22} /></button>} />
    <p className="muted">{t("mosqueIntro")}</p>

    <section className="card mosque-week">
      <div className="row-between">
        <h2>{t("mosqueWeek")}</h2>
        <div className="mosque-week-toggle" role="group" aria-label={t("mosqueWeek")}>
          {([0, 1] as const).map(index => <button type="button" key={index} aria-pressed={group === index} onClick={() => setGroup(index)}>{t("mosqueGroup" + index)}</button>)}
        </div>
      </div>
      <ul>
        {prayerIds.map(id => {
          const { mosque, time, differentMosques, differentTimes } = weeklyMosque(week, id, plan);
          return <li key={id}><button className="mosque-week-row" aria-haspopup="dialog"
            onClick={event => open(event, plan.mosques.length ? { kind: "mapping", id } : { kind: "timetable", mosque: newMosque(now) })}>
            <strong>{t(id)}</strong>
            <span className="mosque-week-place">
              {mosque && <span className="mosque-role caption" data-role={mosque.role}>{t(mosqueRoleLabel[mosque.role])}</span>}
              <small className="muted">{mosque?.name ?? t(differentMosques ? "mosqueVaries" : "mosqueChoose")}</small>
            </span>
            {differentTimes ? <small className="muted">{t("mosqueVaries")}</small> : <MosqueTime time={time} />}
            <span className="sr-only"> · {t("mosqueMapping")}</span>
          </button></li>;
        })}
      </ul>
      <div className="mosque-week-details muted small">
        {[...weekendSwitches].map(([name, prayers]) => <p key={name}>{t("mosqueWeekSwitch", { prayers: prayers.map(id => t(id)).join(", "), mosque: name })}</p>)}
        {friday?.prayer && <p>{t(friday.khutbah ? "mosqueFriday" : "mosqueFridayPrayer", {
          khutbah: friday.khutbah ? mosqueClock(friday.khutbah, language, true) : "", prayer: mosqueClock(friday.prayer, language, true),
        })}</p>}
        {!weekendSwitches.size && !friday?.prayer && <p>{t("mosqueWeekHint")}</p>}
      </div>
    </section>

    <section className="mosque-saved">
      <div className="row-between">
        <h2>{t("mosqueSaved")}</h2>
        <button className="text-button" aria-haspopup="dialog" onClick={event => open(event, { kind: "timetable", mosque: newMosque(now) })}>
          {t("mosqueAdd")}<span className="sr-only"> · {t("mosqueAddFull")}</span>
        </button>
      </div>
      {plan.mosques.map(mosque => {
        const checked = dateKey(new Date(mosque.updatedAt), settings.city.timeZone);
        const notice = timetableNotice(day, checked, mosque.refreshMonth, season);
        return <article className="card mosque-card" key={mosque.id}>
          <div className="row-between">
            <div><h3>{mosque.name}</h3><p className="muted small">{t(mosqueSourceLabel[mosque.source])} · {formatDay(checked, { month: "short", day: "numeric" }, language)}</p></div>
            <span className="mosque-role caption" data-role={mosque.role}>{t(mosqueRoleLabel[mosque.role])}</span>
          </div>
          <dl className="mosque-times equal-row">
            {prayerIds.map(id => <div key={id}>
              <dt className="caption">{t(id === "maghrib" ? "mosqueMaghShort" : id)}</dt>
              <dd>{mosque.jamaat[id] === "adhan+5"
                ? <abbr title={t("mosqueAdhanFiveLong")}>+{number.format(5)}</abbr>
                : <MosqueTime time={mosque.jamaat[id]} />}
              </dd>
            </div>)}
          </dl>
          {notice && <div className="mosque-nudge small"><DesignIcon name="mosques-refresh" size={18} /><p>
            {t(noticeMessage[notice], { month: formatDay(day, { month: "long" }, language) })}
          </p></div>}
          <div className="equal-row mosque-card-actions">
            <button className="action soft" aria-haspopup="dialog" onClick={event => open(event, { kind: "timetable", mosque })}>{t("mosqueUpdateTimes")}</button>
            <button className="action light" aria-haspopup="dialog" onClick={event => open(event, { kind: "photo", id: mosque.id })}>{t("mosquePhoto")}</button>
          </div>
        </article>;
      })}
      {plan.mosques.length === 0 && <p className="card soft">{t("mosqueEmpty")}</p>}
    </section>

    {plan.mosques.length > 0 && <section className="mosque-occasional">
      <div className="row-between">
        <h2>{t("mosqueOccasional")}</h2>
        <button className="text-button" onClick={event => open(event, { kind: "occasion" })} aria-haspopup="dialog">
          {t("mosqueAdd")}<span className="sr-only"> · {t("mosqueOccasional")}</span>
        </button>
      </div>
      {occasional.map(({ mosque, entry, target }) => {
        const history = entry.year === target ? t("planEidThisYear") : entry.year === target - 1 ? t("planEidLastYear") : number.format(entry.year);
        return <button key={mosque.id + entry.type} className="list-row mosque-occasion" aria-haspopup="dialog"
          onClick={event => open(event, { kind: "occasion", id: mosque.id, occasion: entry.type })}>
          <span className="icon-box"><DesignIcon name={entry.type === "tarawih" ? "qada-moon" : "mosques-star"} size={22} /></span>
          <span><strong>{t(mosqueOccasionLabel[entry.type])} · {mosque.name}</strong>
            <small>{t(mosqueRoleLabel[mosque.role])} · {history} · {entry.times.map(time => mosqueClock(time, language)).join(" · ")}</small></span>
          <DesignIcon name={settings.mode === "maktab" ? "return-maktab-chevron" : "return-chevron"} />
        </button>;
      })}
      {occasional.length === 0 && <p className="card small muted">{t("mosqueOccasionalEmpty")}</p>}
    </section>}

    {contact && prompt && <section className="mosque-inquiry">
      <h2>{t("mosqueAskTitle")}</h2>
      <p>{prompt}</p>
      <a className="action" href={`https://wa.me/${contact.contact ?? ""}?text=${encodeURIComponent(prompt)}`} target="_blank" rel="noopener noreferrer">{t("mosqueWhatsapp")}</a>
    </section>}

    {located.length > 0 && <section className="card mosque-nearest compact-stack">
      <h2>{t("mosqueNearest")}</h2>
      {nearest && <p role="status">{nearest.mosque.name} · {t(nearest.meters < 1000 ? "mosqueMeters" : "mosqueKm", {
        distance: nearest.meters < 1000 ? Math.round(nearest.meters) : Number((nearest.meters / 1000).toFixed(1)),
      })}</p>}
      <p className="muted small">{t("mosqueLocationHint")}</p>
      <button className="action soft" disabled={locating} onClick={findLocation}>{t(locating ? "mosqueFinding" : "mosqueUseLocation")}</button>
    </section>}

    <Dialog open={!!panel} onOpenChange={open => { if (!open) setPanel(undefined); }}>
      {panel && <DialogContent className="awwab-dialog mosque-dialog" showCloseButton={false} aria-describedby={undefined}
        onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}>
        <div className="row-between"><DialogTitle>{title}</DialogTitle>
          <DialogClose asChild><button className="icon-button" aria-label={t("planClose")}><X size={18} aria-hidden="true" /></button></DialogClose>
        </div>
        {panel.kind === "timetable" && <TimetableEditor mosque={panel.mosque} save={saveTimetable} cancel={() => setPanel(undefined)} />}
        {panel.kind === "mapping" && <WeekEditor prayer={panel.id} plan={plan} week={week} group={groupLabel} cancel={() => setPanel(undefined)}
          save={async (days, mosqueId) => {
            const saved = await save(old => mapMosque(old, days, panel.id, mosqueId));
            if (saved) setPanel(undefined);
            return saved;
          }} />}
        {photoMosque && <PhotoEditor mosque={photoMosque} save={photo => savePhoto(photoMosque.id, photo)} />}
        {panel.kind === "occasion" && <OccasionEditor mosques={plan.mosques} initialMosque={panel.id} initialType={panel.occasion} yearNow={year} update={update} />}
      </DialogContent>}
    </Dialog>
  </div>;
}
