import { useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { DesignIcon } from "@/components/DesignIcon";
import { PracticeHeader } from "@/components/PracticeHeader";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { addDays, dateKey, formatDay } from "@/lib/dates";
import { calendarDefaults, calendarEvents } from "@/lib/hijri";
import { readLocalizedNumber } from "@/lib/localeNumbers";
import { calendarWeekStart } from "@/lib/plan-calendar";
import { adjustQadaTotals, estimateQada, qadaBalances, qadaCountBetween, qadaDefaults, qadaForecast, recordQada, type QadaPlan } from "@/lib/qada";
import { type Settings, updateRecord } from "@/lib/storageService";
import { prayerIds } from "@/types/Prayer";

type QadaPanel = "edit" | "estimate" | "fasts" | "pace";
const panelTitles = { edit: "qadaEditTitle", estimate: "qadaEstimateTitle", fasts: "qadaFasts", pace: "qadaDailyGoals" };
const panelHints = { edit: "qadaEditHint", estimate: "qadaEstimateHint", fasts: "qadaFastHint", pace: "qadaDeskPaceHint" };
const totalOf = (values: QadaPlan["madeUp"]) => Object.values(values).reduce((total, count) => total + count, 0);

function QadaNumber({ name, defaultValue, decimals = 0, max = Number.MAX_SAFE_INTEGER }: {
  name: string; defaultValue?: number; decimals?: number; max?: number;
}) {
  const { language, locale, t } = useCopy();
  const native = language === "en";
  const display = native || defaultValue === undefined ? defaultValue
    : new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: decimals }).format(defaultValue);
  return <input type={native ? "number" : "text"} name={name} dir="ltr" defaultValue={display}
    inputMode={decimals ? "decimal" : "numeric"} min={native ? 0 : undefined} max={native ? max : undefined}
    step={native ? 10 ** -decimals : undefined} data-qada-decimals={decimals} data-qada-max={max} required
    onInput={event => event.currentTarget.setCustomValidity("")}
    onInvalid={event => {
      if (event.currentTarget.validity.valueMissing) event.currentTarget.setCustomValidity(t("qadaEnterNumber"));
    }} />;
}

export function Qada({ settings, now, desktop = false, embedded = false }: {
  settings: Settings; now: Date; desktop?: boolean; embedded?: boolean;
}) {
  const { language, locale, t } = useCopy();
  const number = new Intl.NumberFormat(locale);
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
  const totalMade = totalOf(madeUp);
  const { days, end } = qadaForecast(today, balances, plan);
  const unit = days < 60 ? "day" : "month";
  const duration = new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" })
    .format(unit === "day" ? days : Math.round(days / 30.4375));
  const fastsLeft = Math.max(0, plan.fasts - plan.fastsMadeUp);
  const ramadan = useMemo(() => calendarEvents(today, addDays(today, 370), settings.hijriAdjust, calendar)
    .find(event => event.title === "Ramadan begins"), [today, settings.hijriAdjust, calendar]);
  const daysToRamadan = ramadan ? Math.max(0, Math.round((Date.parse(ramadan.dates[0]) - Date.parse(today)) / 86400000)) : undefined;
  const maktab = settings.mode === "maktab";
  const chevron = maktab ? "return-maktab-chevron" : "return-chevron";
  const eachPrayer = t("qadaEach", { count: 1 });
  const pace = plan.withEachPrayer ? eachPrayer : t("qadaPace", { count: plan.dailyGoal });

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
    const form = event.currentTarget;
    const values = new FormData(form);
    const numbers: Record<string, number> = {};
    for (const input of form.querySelectorAll<HTMLInputElement>("input[data-qada-decimals]")) {
      const decimals = Number(input.dataset.qadaDecimals);
      const max = Number(input.dataset.qadaMax);
      const value = readLocalizedNumber(input.value, locale, decimals);
      if (value === undefined || value > max) {
        input.setCustomValidity(value === undefined
          ? t(decimals ? "qadaEnterDecimal" : "qadaEnterWhole", { decimals })
          : t("qadaNumberLimit", { max }));
        input.reportValidity();
        return;
      }
      numbers[input.name] = value;
    }
    setSaving(true);
    const saved = await save(old => {
      switch (editor.panel) {
        case "edit": {
          const estimated = { ...old.estimated };
          const madeUp = { ...old.madeUp };
          for (const id of prayerIds) {
            const enteredEstimate = numbers["estimated-" + id];
            if (enteredEstimate !== editor.initial.estimated[id]) estimated[id] = enteredEstimate;
            const correction = numbers["made-" + id] - editor.initial.madeUp[id];
            madeUp[id] = Math.max(0, madeUp[id] + correction);
          }
          return adjustQadaTotals(old, estimated, madeUp);
        }
        case "estimate":
          return { ...old, estimated: estimateQada(numbers.years, numbers.prayed) };
        case "fasts":
          return { ...old, fasts: numbers.fasts };
        case "pace": {
          const pace = values.get("pace");
          return pace === "each" ? { ...old, withEachPrayer: true }
            : { ...old, dailyGoal: Number(pace), withEachPrayer: false };
        }
      }
    });
    setSaving(false);
    if (saved) setEditor(undefined);
  }

  const logPrayer = (id: typeof prayerIds[number]) =>
    save(old => recordQada(old, id, dateKey(new Date(), settings.city.timeZone)));
  const logFast = () => save(old => old.fastsMadeUp >= old.fasts ? old : { ...old, fastsMadeUp: old.fastsMadeUp + 1 });
  let desktopContent;
  if (desktop) {
    const first = calendarWeekStart(language, settings.city.timeZone, navigator.languages);
    const weekday = new Date(today + "T12:00:00Z").getUTCDay();
    const weekStart = addDays(today, -((weekday + 7 - first) % 7));
    const thisWeek = qadaCountBetween(plan, logs, weekStart, today, settings.city.timeZone);
    desktopContent = <section className="card qada-desk-summary" aria-label={t("qadaDeskTitle")}>
      <header className="row-between">
        <h2>{t("qadaDeskTitle")}</h2>
        <button type="button" className="text-button" onClick={event => open(event, "estimate")} aria-haspopup="dialog">{t("qadaDeskEstimate")}</button>
      </header>
      <div className="qada-desk-metrics equal-row">
        <button type="button" onClick={event => open(event, "edit")} aria-haspopup="dialog" title={t("qadaEditTitle")}>
          <span className="caption">{t("qadaDeskLeft")}</span><strong aria-live="polite">{number.format(totalLeft)}</strong>
          <small>{t("qadaDeskEstimated", { count: totalOf(plan.estimated) })}</small>
        </button>
        <button type="button" onClick={event => open(event, "pace")} aria-haspopup="dialog" title={t("qadaDailyGoals")}>
          <span className="caption">{t("qadaDeskWeek")}</span><strong aria-live="polite">{t("qadaDeskCount", { count: thisWeek })}</strong><small>{pace}</small>
        </button>
        <div><span className="caption">{t("qadaDeskFinish")}</span><strong>{end
          ? <time dateTime={end}>~{formatDay(end, { month: "short", year: "numeric" }, locale)}</time> : "—"}</strong>
          <small>{t("qadaDeskAtPace")}</small>
        </div>
      </div>
      <table className="qada-desk-table" aria-label={t("qadaByPrayer")}>
        <thead><tr>
          <th scope="col">{t("qadaDeskPrayer")}</th><th scope="col">{t("qadaDeskLeft")}</th><th scope="col">{t("qadaDeskMadeUp")}</th>
          <th scope="col">{t("qadaDeskProgress")}</th><th scope="col">{t("today")}</th>
        </tr></thead>
        <tbody>{prayerIds.map(id => {
          const total = plan.estimated[id];
          return <tr key={id}>
            <th scope="row">{t(id)}</th><td>{number.format(remaining[id])}</td><td>{number.format(madeUp[id])}</td>
            <td><progress value={Math.min(madeUp[id], total)} max={total || 1} aria-label={t("qadaBalanceProgress") + " · " + t(id)} /></td>
            <td><button className="action soft qada-desk-log" type="button" onClick={() => void logPrayer(id)}>{t("qadaDeskLog", { count: 1 })}
              <span className="sr-only"> · {t("qadaAdd", { prayer: t(id) })}</span></button></td>
          </tr>;
        })}</tbody>
      </table>
      <div className="qada-desk-fasts">
        <button type="button" className="text-button" onClick={event => open(event, "fasts")} aria-haspopup="dialog">{t("qadaDeskFasts", { count: fastsLeft })}</button>
        {fastsLeft > 0 && <button type="button" className="text-button" onClick={() => void logFast()}>{t("qadaDeskLogFast")}</button>}
      </div>
      <p className="small muted">{t("qadaScholars")}</p>
    </section>;
  }

  return <div className={desktop ? "qada-desk" : "qada-page"} data-embedded={embedded}>
    {!embedded && (desktop
      ? <Link className="text-button qada-desk-back" to="/return">{t("back")} · {t("return")}</Link>
      : <PracticeHeader title={t("qadaTitle")} back="/return" maktab={maktab} settingsTo="/you/prayer" />)}
    {desktopContent ?? <div className="qada-content">
      <section className="card qada-summary">
        <h2 className="caption">{t("qadaLeftTitle")}</h2>
        <div className="qada-balance"><strong>{number.format(totalLeft)}</strong><span className="muted">{t("qadaUnit", { count: totalLeft })}</span></div>
        <progress value={totalMade} max={totalLeft + totalMade || 1} aria-label={t("qadaBalanceProgress")} />
        <p className="muted" aria-live="polite">{t("qadaMadeSoFar", { count: totalMade })} {end && t(plan.withEachPrayer ? "qadaProjected" : "qadaProjectedPace", { duration, count: plan.dailyGoal })}</p>
        {end && <small><time dateTime={end}>{t("qadaProjectedDate", { date: formatDay(end, { month: "short", day: "numeric", year: "numeric" }, locale) })}</time></small>}
      </section>
      <div className="qada-goals" role="group" aria-label={t("qadaDailyGoals")}>
        {[1, 3, 5].map(goal => <button className="qada-goal" key={goal} aria-pressed={!plan.withEachPrayer && plan.dailyGoal === goal}
          onClick={() => void save(old => ({ ...old, dailyGoal: goal, withEachPrayer: false }))}>{t("qadaGoal", { count: goal })}</button>)}
        <button className="qada-goal" aria-pressed={!!plan.withEachPrayer}
          onClick={() => void save(old => ({ ...old, withEachPrayer: true }))}>{eachPrayer}</button>
      </div>
      <section className="qada-by-prayer">
        <div className="row-between"><h2>{t("qadaByPrayer")}</h2><button className="text-button" onClick={event => open(event, "edit")} aria-haspopup="dialog">{t("qadaEdit")}</button></div>
        <ul className="compact-stack">
          {prayerIds.map(id => <li className="list-row qada-prayer" key={id}>
            <div><strong>{t(id)}</strong><small>{t("qadaMade", { count: madeUp[id] })}</small></div>
            <span className="qada-prayer-left">{t("qadaLeft", { count: remaining[id] })}</span>
            <button className="action" onClick={() => void logPrayer(id)}>
              + {number.format(1)}<span className="sr-only"> {t("qadaAdd", { prayer: t(id) })}</span>
            </button>
          </li>)}
        </ul>
      </section>
      <button className="list-row return-list-link" onClick={event => open(event, "estimate")} aria-haspopup="dialog">
        <span className="icon-box"><DesignIcon name="qada-list" size={22} /></span>
        <span><strong>{t("qadaEstimateTitle")}</strong><small>{t("qadaEstimateHint")}</small></span>
        <DesignIcon name={chevron} className="icon-dir" size={20} />
      </button>
      <button className="list-row return-list-link" onClick={event => open(event, "fasts")} aria-haspopup="dialog">
        <span className="icon-box"><DesignIcon name="qada-moon" size={22} /></span>
        <span><strong>{t("qadaFasts")} · {number.format(fastsLeft)}</strong>
          <small>{daysToRamadan === undefined ? t("qadaFastHint") : t(ramadan?.confirmed ? "qadaRamadan" : "qadaRamadanEstimate", { count: daysToRamadan })}</small></span>
        <DesignIcon name={chevron} className="icon-dir" size={20} />
      </button>
      <section className="qada-note">
        <p>{t("qadaEncourage")}</p>
        <p className="muted small">{t("qadaScholars")}</p>
      </section>
    </div>}

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
              <label className="field">{t("qadaEstimated")}<QadaNumber name={"estimated-" + id} defaultValue={editor.initial.estimated[id]} /></label>
              <label className="field">{t("qadaManual")}<QadaNumber name={"made-" + id} defaultValue={editor.initial.madeUp[id]} /></label>
            </div>
          </fieldset>)}
          {panel === "estimate" && <>
            <label className="field">{t("qadaYears")}<QadaNumber name="years" max={150} decimals={2} /></label>
            <label className="field">{t("qadaPrayed")}<QadaNumber name="prayed" max={300000} defaultValue={0} /></label>
          </>}
          {panel === "fasts" && <>
            <p aria-live="polite">{t("qadaLeft", { count: fastsLeft })} · {t("qadaMade", { count: plan.fastsMadeUp })}</p>
            <label className="field">{t("qadaFastsTotal")}<QadaNumber name="fasts" defaultValue={plan.fasts} /></label>
          </>}
          {panel === "pace" && <fieldset className="stack qada-desk-pace">
            <legend className="sr-only">{t("qadaDailyGoals")}</legend>
            {[...new Set([1, 3, 5, editor.initial.dailyGoal])].sort((a, b) => a - b).map(goal => <label key={goal} className="list-row">
              <input name="pace" type="radio" value={goal} required defaultChecked={!editor.initial.withEachPrayer && editor.initial.dailyGoal === goal} />
              {t("qadaGoal", { count: goal })}
            </label>)}
            <label className="list-row"><input name="pace" type="radio" value="each" required defaultChecked={editor.initial.withEachPrayer} />{eachPrayer}</label>
          </fieldset>}
          <button className="action" disabled={saving}>{t("qadaSave")}</button>
        </form>
        {panel === "fasts" && <button className="action soft qada-add-fast" disabled={saving || fastsLeft === 0}
          onClick={() => void logFast()}>{t("qadaFastsAdd")}</button>}
      </DialogContent>}
    </Dialog>
  </div>;
}
