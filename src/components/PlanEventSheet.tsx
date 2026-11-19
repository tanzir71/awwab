import { useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCopy } from "@/lib/copy";
import { addDays, formatDay } from "@/lib/dates";
import { eventMoonReminder, monthStart, moonWatchDay, type CalendarEvent, type CalendarSettings } from "@/lib/hijri";
import { planAuthorities, planEventLabels, planMonth } from "@/lib/plan-copy";
import { mosqueDefaults, type Mosque, type MosquePlan } from "@/lib/mosques";
import { type Settings, updateRecord } from "@/lib/storageService";

export function SightingOptions({ source, setSource, district }: { source: string; setSource: (source: string) => void; district: boolean }) {
  const { t } = useCopy();
  return <div className="plan-segmented" role="group" aria-label={t("planSighting")}>
    {planAuthorities.map((authority, i) => <button type="button" aria-pressed={source === authority.value} key={authority.value}
      onClick={() => setSource(authority.value)}>{t(i === 0 && district ? "planNationalBd" : authority.label)}</button>)}
  </div>;
}

function PlanSwitch({ checked, onChange, title, children, disabled }: {
  checked: boolean; onChange: (checked: boolean) => void; title: string; children: ReactNode; disabled?: boolean;
}) {
  return <label className="plan-switch">
    <span><strong>{title}</strong><small className="muted">{children}</small></span>
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
    <span className="plan-switch-track" aria-hidden="true" />
  </label>;
}

function EidJamaat({ event, mosques, city }: { event: CalendarEvent; mosques: MosquePlan; city: string }) {
  const { t, language } = useCopy();
  const [location, setLocation] = useState<"home" | "hometown">("home");
  const [editor, setEditor] = useState<{ mosque: Mosque; times: string[] }>();
  const [saving, setSaving] = useState(false);
  const type = event.title === "Eid al-Fitr" ? "eid_fitr" : "eid_adha";
  const year = Number(event.dates[0].slice(0, 4));
  const matching = mosques.mosques.filter(mosque => location === "hometown" ? mosque.role === "hometown" : mosque.role !== "hometown");
  const editingId = editor?.mosque.id;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;
    const raw = String(new FormData(event.currentTarget).get("times") ?? "")
      .replace(/[০-৯]/g, digit => String(digit.charCodeAt(0) - 0x09e6));
    const times = raw.split(/[,،]/).map(time => time.trim());
    if (!times.every(time => /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(time))) {
      toast.error(t("planEidTimesInvalid"));
      return;
    }
    const normalized = [...new Set(times.map(time => time.padStart(5, "0")))].sort();
    const entry: Mosque["occasional"][number] = { type, year, times: normalized };
    setSaving(true);
    try {
      await updateRecord("mosques", mosqueDefaults, old => ({
        ...old, mosques: old.mosques.map(mosque => mosque.id === editor.mosque.id
          ? { ...mosque, occasional: [...mosque.occasional.filter(item => item.type !== type || item.year !== year), entry] }
          : mosque),
      }));
      setEditor(undefined);
    } catch {
      toast.error(t("planSaveError"));
    } finally {
      setSaving(false);
    }
  }

  return <section className="plan-eid-jamaat">
    <h3>{t("planEidWhere")}</h3>
    <div className="plan-segmented" role="group" aria-label={t("planEidWhere")}>
      <button type="button" aria-pressed={location === "home"} onClick={() => { setLocation("home"); setEditor(undefined); }}>
        <strong>{city}</strong><small>{t("planEidHome")}</small>
      </button>
      <button type="button" aria-pressed={location === "hometown"} onClick={() => { setLocation("hometown"); setEditor(undefined); }}>
        <strong>{t("planEidHometown")}</strong>
      </button>
    </div>
    {matching.map(mosque => {
      const current = mosque.occasional.find(item => item.type === type && item.year === year);
      const previous = mosque.occasional.find(item => item.type === type && item.year === year - 1);
      const times = current?.times ?? previous?.times ?? [];
      const number = new Intl.NumberFormat(language, { useGrouping: false });
      const visibleTimes = times.map(time => time.replace(/^0/, "").replace(/\d/g, digit => number.format(Number(digit))));
      return <div className="card plan-eid-mosque" key={mosque.id}>
        <div className="row-between"><strong>{mosque.name}</strong>{visibleTimes.length > 0 && <b>{visibleTimes.join(" · ")}</b>}</div>
        <div className="row-between"><small className="muted">{t(current ? "planEidThisYear" : previous ? "planEidLastYear" : "planEidUnrecorded")}</small>
          <button className="text-button" onClick={() => setEditor({ mosque, times })} aria-expanded={editingId === mosque.id}>{t(current ? "qadaEdit" : "planEidConfirmTime")}</button>
        </div>
        {editingId === mosque.id && <form className="compact-stack" onSubmit={save}>
          <label className="field">{t("planEidTimes")}<input type="text" name="times" defaultValue={editor?.times.join(", ")} placeholder="08:00, 09:30" required /></label>
          <p className="muted small">{t("planEidTimesHelp")}</p>
          <div className="equal-row"><button className="action light" type="button" disabled={saving} onClick={() => setEditor(undefined)}>{t("planClose")}</button>
            <button className="action" disabled={saving}>{t("planEidSaveTime")}</button></div>
        </form>}
      </div>;
    })}
    {matching.length === 0 && <Link className="action light" to="/plan/mosques">{t("planEidEmpty")}</Link>}
  </section>;
}

export function EventSheet({ event, settings, config, mosques, onConfirm, onMoonReminder, onClose, onRestoreFocus, presentation = "dialog", initialDate, initialSource }: {
  event: CalendarEvent; settings: Settings; config: CalendarSettings; mosques: MosquePlan;
  onConfirm: (date: string, source: string, moveAfter: boolean) => Promise<boolean>;
  onMoonReminder: (enabled: boolean) => Promise<boolean>;
  onClose: () => void; onRestoreFocus: () => void;
  presentation?: "dialog" | "panel"; initialDate?: string; initialSource?: string;
}) {
  const { t, language } = useCopy();
  const [choice, setChoice] = useState(initialDate ?? event.dates[0]);
  const [source, setSource] = useState(initialSource ?? config.sightingSource ?? planAuthorities[0].value);
  const [moveAfter, setMoveAfter] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingReminder, setPendingReminder] = useState<boolean>();
  const startOfMonth = event.hijriDay === 1;
  const moon = moonWatchDay(event.year, event.month, settings.hijriAdjust, config.anchors);
  const offset = config.overrides[event.id]?.adjust ?? 0;
  const estimatedStart = monthStart(event.year, event.month, settings.hijriAdjust, config.anchors).date;
  const estimatedDate = addDays(estimatedStart, event.hijriDay - 1 + offset);
  const previousMonth = planMonth(event.month === 1 ? 12 : event.month - 1, language);
  const selected = event.dates.includes(choice) ? choice : event.dates[0];
  const dateLabel = (date: string) => formatDay(date, { weekday: "short", day: "numeric", month: "short" }, language);
  const [title, detail] = planEventLabels(event, language);
  const number = new Intl.NumberFormat(language, { useGrouping: false });
  const district = settings.city.timeZone === "Asia/Dhaka";
  const announcedBy = planAuthorities.find(authority => authority.value === event.source);
  const sourceText = announcedBy ? t(announcedBy === planAuthorities[0] && district ? "planNationalBd" : announcedBy.label) : event.source;

  const closeButton = <button type="button" className="icon-button" disabled={saving}
    onClick={presentation === "panel" ? onClose : undefined} aria-label={t("planClose")}><X size={18} aria-hidden="true" /></button>;
  const body = <>
      <header className="plan-sheet-heading">
        <div>
          <p className="caption">{number.format(event.hijriDay)} {planMonth(event.month, language)} {number.format(event.year)}</p>
          {presentation === "panel" ? <h2 data-plan-panel-heading tabIndex={-1}>{title}</h2> : <DialogTitle>{title}</DialogTitle>}
        </div>
        <div className="plan-sheet-actions">
          <span className="plan-event-badge caption" data-kind={event.confirmed ? "confirmedDate" : "expectedDate"}>{t(event.confirmed ? "confirmedDate" : "expectedDate")}</span>
          {presentation === "panel" ? closeButton : <DialogClose asChild>{closeButton}</DialogClose>}
        </div>
      </header>
      <section className="plan-event-dates compact-stack">
        <h3>{t("planWhichDay")}</h3>
        <div className="equal-row plan-date-choices" role="group" aria-label={t("planWhichDay")}>
          {event.dates.map((date, index) => {
            const description = !event.confirmed && startOfMonth && !offset
              ? index === 0 ? t("planSeenBy", { date: dateLabel(moon), month: previousMonth }) : t("planThirtyDays", { month: previousMonth })
              : offset ? t("planOffsetDate", { offset }) : detail;
            return <button className="plan-date-choice" aria-pressed={selected === date} key={date} onClick={() => setChoice(date)} disabled={event.confirmed || saving}>
              <strong>{dateLabel(date)}</strong><small className="muted">{description}</small>
              {!event.confirmed && date === estimatedDate && <span className="plan-date-estimate caption">{t("planCalendarEstimate")}</span>}
            </button>;
          })}
        </div>
      </section>
      {event.confirmed ? sourceText && <p className="card soft small" role="status">{t("planConfirmedBy", { source: sourceText })}</p> :
        <section className="card plan-announcement">
          <h3 className="caption">{t("planWhenAnnounced")}</h3>
          <SightingOptions source={source} setSource={setSource} district={district} />
          <div className="equal-row">
            <button className="action" disabled={saving} onClick={async () => {
              setSaving(true);
              await onConfirm(selected, source, moveAfter);
              setSaving(false);
            }}>{t("planConfirm")}</button>
            <a className="action light" href={`https://wa.me/?text=${encodeURIComponent(t("planAskText", { event: title }))}`} target="_blank" rel="noopener noreferrer">{t("planAsk")}</a>
          </div>
          {startOfMonth && <>
            <PlanSwitch title={t("planMoveAfter")} checked={moveAfter} onChange={setMoveAfter} disabled={saving}>{t("planMoveDetail")}</PlanSwitch>
            <PlanSwitch title={t("planMoonAlarm")} checked={pendingReminder ?? eventMoonReminder(event, config)} onChange={async enabled => {
              setPendingReminder(enabled);
              setSaving(true);
              await onMoonReminder(enabled);
              setPendingReminder(undefined);
              setSaving(false);
            }} disabled={saving}>{t("planMoonAlarmHint", { date: dateLabel(moon) })}</PlanSwitch>
          </>}
        </section>}
      {event.title.startsWith("Eid") && <EidJamaat event={event} mosques={mosques} city={settings.city.name} />}
      {event.title === "Eid al-Fitr" && <section className="card plan-eid-note">
        <h3>{t("planBeforeEid")}</h3><p className="muted small">{t("planBeforeFitr")}</p>
        <p className="small"><a href="https://sunnah.com/bukhari:1503">Bukhari 1503 · Sahih</a> · <a href="https://sunnah.com/bukhari:953">Bukhari 953 · Sahih</a></p>
      </section>}
  </>;
  if (presentation === "panel") return <section className="card plan-event-panel compact-stack" aria-label={title}
    onKeyDown={key => { if (saving && key.key === "Escape") key.preventDefault(); }}>{body}</section>;
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="awwab-dialog plan-event-sheet" overlayClassName="plan-event-overlay" showCloseButton={false} aria-describedby={undefined}
      onCloseAutoFocus={event => { event.preventDefault(); onRestoreFocus(); }}>{body}</DialogContent>
  </Dialog>;
}
