import { useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { DesignIcon } from "@/components/DesignIcon";
import { PracticeHeader } from "@/components/PracticeHeader";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { addDays, dateKey, formatDay } from "@/lib/dates";
import { calendarDefaults, calendarEvents } from "@/lib/hijri";
import { estimateQada, qadaBalances, qadaDefaults, qadaForecast } from "@/lib/qada";
import { type Settings, updateRecord } from "@/lib/storageService";
import { prayerIds } from "@/types/Prayer";

type QadaPlan = typeof qadaDefaults;
type QadaPanel = "edit" | "estimate" | "fasts";
const panelTitles = { edit: "qadaEditTitle", estimate: "qadaEstimateTitle", fasts: "qadaFasts" };
const panelHints = { edit: "qadaEditHint", estimate: "qadaEstimateHint", fasts: "qadaFastHint" };

export function Qada({ settings, now }: { settings: Settings; now: Date }) {
  const { language, t } = useCopy();
  const number = new Intl.NumberFormat(language);
  const plan = useRecord("qada", qadaDefaults);
  const calendar = useRecord("calendar", calendarDefaults);
  const logs = usePrayerLogs();
  const [editor, setEditor] = useState<{ panel: QadaPanel; initial: QadaPlan }>();
  const [saving, setSaving] = useState(false);
  const panel = editor?.panel;
  const trigger = useRef<HTMLButtonElement>();
  const today = dateKey(now, settings.city.timeZone);
  const balances = qadaBalances(plan, logs);
  const { madeUp, remaining, totalLeft } = balances;
  const totalMade = Object.values(madeUp).reduce((total, count) => total + count, 0);
  const { days, end } = qadaForecast(today, balances, plan);
  const unit = days < 60 ? "day" : "month";
  const duration = new Intl.NumberFormat(language, { style: "unit", unit, unitDisplay: "long" })
    .format(unit === "day" ? days : Math.round(days / 30.4375));
  const fastsLeft = Math.max(0, plan.fasts - plan.fastsMadeUp);
  const ramadan = useMemo(() => calendarEvents(today, addDays(today, 370), settings.hijriAdjust, calendar)
    .find(event => event.title === "Ramadan begins"), [today, settings.hijriAdjust, calendar]);
  const daysToRamadan = ramadan ? Math.max(0, Math.round((Date.parse(ramadan.dates[0]) - Date.parse(today)) / 86400000)) : undefined;
  const maktab = settings.mode === "maktab";
  const chevron = maktab ? "return-maktab-chevron" : "return-chevron";

  async function save(update: (previous: QadaPlan) => QadaPlan) {
    try {
      await updateRecord("qada", qadaDefaults, update);
      return true;
    } catch {
      toast.error(t("qadaSaveError"));
      return false;
    }
  }

  function open(event: MouseEvent<HTMLButtonElement>, next: QadaPanel) {
    trigger.current = event.currentTarget;
    setEditor({ panel: next, initial: plan });
  }

  async function savePanel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving) return;
    const values = new FormData(event.currentTarget);
    setSaving(true);
    const saved = await save(old => {
      switch (editor.panel) {
        case "edit": {
          const estimated = { ...old.estimated };
          const madeUp = { ...old.madeUp };
          for (const id of prayerIds) {
            const enteredEstimate = Number(values.get("estimated-" + id));
            if (enteredEstimate !== editor.initial.estimated[id]) estimated[id] = enteredEstimate;
            const correction = Number(values.get("made-" + id)) - editor.initial.madeUp[id];
            madeUp[id] = Math.max(0, madeUp[id] + correction);
          }
          return { ...old, estimated, madeUp };
        }
        case "estimate":
          return { ...old, estimated: estimateQada(Number(values.get("years")), Number(values.get("prayed"))) };
        case "fasts":
          return { ...old, fasts: Number(values.get("fasts")) };
      }
    });
    setSaving(false);
    if (saved) setEditor(undefined);
  }

  return <div className="qada-page">
    <PracticeHeader title={t("qadaTitle")} back="/return" maktab={maktab} settingsTo="/you/prayer" />
    <div className="qada-content">
      <section className="card qada-summary">
        <h2 className="caption">{t("qadaLeftTitle")}</h2>
        <div className="qada-balance"><strong>{number.format(totalLeft)}</strong><span className="muted">{t("qadaUnit", { count: totalLeft })}</span></div>
        <progress value={totalMade} max={totalLeft + totalMade || 1} aria-label={t("qadaBalanceProgress")} />
        <p className="muted" aria-live="polite">{t("qadaMadeSoFar", { count: totalMade })} {end && t(plan.withEachPrayer ? "qadaProjected" : "qadaProjectedPace", { duration, count: plan.dailyGoal })}</p>
        {end && <small><time dateTime={end}>{t("qadaProjectedDate", { date: formatDay(end, { month: "short", day: "numeric", year: "numeric" }, language) })}</time></small>}
      </section>
      <div className="qada-goals" role="group" aria-label={t("qadaDailyGoals")}>
        {[1, 3, 5].map(goal => <button className="qada-goal" key={goal} aria-pressed={!plan.withEachPrayer && plan.dailyGoal === goal}
          onClick={() => void save(old => ({ ...old, dailyGoal: goal, withEachPrayer: false }))}>{t("qadaGoal", { count: goal })}</button>)}
        <button className="qada-goal" aria-pressed={!!plan.withEachPrayer}
          onClick={() => void save(old => ({ ...old, withEachPrayer: true }))}>{t("qadaEach")}</button>
      </div>
      <section className="qada-by-prayer">
        <div className="row-between"><h2>{t("qadaByPrayer")}</h2><button className="text-button" onClick={event => open(event, "edit")} aria-haspopup="dialog">{t("qadaEdit")}</button></div>
        <ul className="compact-stack">
          {prayerIds.map(id => <li className="list-row qada-prayer" key={id}>
            <div><strong>{t(id)}</strong><small>{t("qadaMade", { count: madeUp[id] })}</small></div>
            <span className="qada-prayer-left">{t("qadaLeft", { count: remaining[id] })}</span>
            <button className="action" onClick={() => void save(old => ({ ...old, madeUp: { ...old.madeUp, [id]: old.madeUp[id] + 1 } }))}>
              + {number.format(1)}<span className="sr-only"> {t("qadaAdd", { prayer: t(id) })}</span>
            </button>
          </li>)}
        </ul>
      </section>
      <button className="list-row return-list-link" onClick={event => open(event, "estimate")} aria-haspopup="dialog">
        <span className="icon-box"><DesignIcon name="qada-list" size={22} /></span>
        <span><strong>{t("qadaEstimateTitle")}</strong><small>{t("qadaEstimateHint")}</small></span>
        <DesignIcon name={chevron} size={20} />
      </button>
      <button className="list-row return-list-link" onClick={event => open(event, "fasts")} aria-haspopup="dialog">
        <span className="icon-box"><DesignIcon name="qada-moon" size={22} /></span>
        <span><strong>{t("qadaFasts")} · {number.format(fastsLeft)}</strong>
          <small>{daysToRamadan === undefined ? t("qadaFastHint") : t(ramadan?.confirmed ? "qadaRamadan" : "qadaRamadanEstimate", { count: daysToRamadan })}</small></span>
        <DesignIcon name={chevron} size={20} />
      </button>
      <section className="qada-note">
        <p>{t("qadaEncourage")}</p>
        <p className="muted small">{t("qadaScholars")}</p>
      </section>
    </div>

    <Dialog open={!!editor} onOpenChange={open => { if (!open && !saving) setEditor(undefined); }}>
      {editor && panel && <DialogContent className="awwab-dialog qada-dialog" showCloseButton={false}
        onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
        <div className="row-between">
          <DialogTitle>{t(panelTitles[panel])}</DialogTitle>
          <DialogClose asChild><button type="button" className="icon-button" aria-label={t("qadaClose")} disabled={saving}><X size={20} /></button></DialogClose>
        </div>
        <DialogDescription className="muted">{t(panelHints[panel])}</DialogDescription>
        <form className="stack" key={panel} onSubmit={savePanel}>
          {panel === "edit" && prayerIds.map(id => <fieldset className="card compact-stack qada-adjust" key={id}>
            <legend>{t(id)}</legend>
            <div className="equal-row">
              <label className="field">{t("qadaEstimated")}<input type="number" name={"estimated-" + id} min="0" defaultValue={editor.initial.estimated[id]} required /></label>
              <label className="field">{t("qadaManual")}<input type="number" name={"made-" + id} min="0" defaultValue={editor.initial.madeUp[id]} required /></label>
            </div>
          </fieldset>)}
          {panel === "estimate" && <>
            <label className="field">{t("qadaYears")}<input type="number" name="years" min="0" max="150" step=".01" required /></label>
            <label className="field">{t("qadaPrayed")}<input type="number" name="prayed" min="0" max="300000" defaultValue="0" required /></label>
          </>}
          {panel === "fasts" && <>
            <p aria-live="polite">{t("qadaLeft", { count: fastsLeft })} · {t("qadaMade", { count: plan.fastsMadeUp })}</p>
            <label className="field">{t("qadaFastsTotal")}<input type="number" name="fasts" min="0" defaultValue={plan.fasts} required /></label>
          </>}
          <button className="action" disabled={saving}>{t("qadaSave")}</button>
        </form>
        {panel === "fasts" && <button className="action soft qada-add-fast" disabled={saving || fastsLeft === 0}
          onClick={() => void save(old => old.fastsMadeUp >= old.fasts ? old : { ...old, fastsMadeUp: old.fastsMadeUp + 1 })}>{t("qadaFastsAdd")}</button>}
      </DialogContent>}
    </Dialog>
  </div>;
}
