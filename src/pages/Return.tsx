import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { PracticeHeader } from "@/components/PracticeHeader";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDesktop, usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { addDays, dateKey, formatDay } from "@/lib/dates";
import { qadaBalances, qadaDefaults } from "@/lib/qada";
import { db, getRecord, prayerStatistics, type Settings, updateRecord } from "@/lib/storageService";
import { useUi } from "@/lib/uiState";
import { Qada } from "@/pages/Qada";
import content from "../../docs/content/return.json";

const steps = ["Stop", "Regret", "Resolve", "Repair"];
const sayyidLines = content.sayyid.lines;

type ReturnProps = { settings: Settings; now: Date };

export function ReturnPage({ settings, now, desktop }: ReturnProps & { desktop: boolean }) {
  return desktop ? <DesktopReturn settings={settings} now={now} /> : <MobileReturn settings={settings} now={now} />;
}

function ReturnCounter({ settings, now, desktop = false }: ReturnProps & { desktop?: boolean }) {
  const { language, t } = useCopy();
  const number = new Intl.NumberFormat(language);
  const day = dateKey(now, settings.city.timeZone);
  const counters = useRecord<Record<string, number>>("istighfar", {});
  const count = counters[day] ?? 0;
  const countOne = useCallback(async () => {
    try {
      const today = dateKey(new Date(), settings.city.timeZone);
      await updateRecord<Record<string, number>>("istighfar", {}, value => ({ ...value, [today]: (value[today] ?? 0) + 1 }));
    } catch {
      toast.error(t("returnCountError"));
      return;
    }
    navigator.vibrate?.(15);
  }, [settings.city.timeZone, t]);

  useEffect(() => {
    if (!desktop) return;
    function onSpace(event: KeyboardEvent) {
      if (event.key !== " " || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (useUi.getState().word || document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (event.target instanceof HTMLElement && event.target.closest('a, button, input, select, textarea, summary, [contenteditable], [role="button"], [role="checkbox"], [role="switch"]')) return;
      event.preventDefault();
      if (!event.repeat) void countOne();
    }
    window.addEventListener("keydown", onSpace);
    return () => window.removeEventListener("keydown", onSpace);
  }, [countOne, desktop]);

  return <section className="return-counter night" aria-label={t("returnDailyGoal")}>
    {desktop && <h2 className="caption">{t("returnDeskIstighfar")}</h2>}
    <div className="count-ring" style={{ "--count": Math.min(100, count) + "%" } as CSSProperties}>
      <div className="count-window"><strong aria-live="polite">{number.format(count)}</strong><small>{t(desktop ? "returnDeskOfHundred" : "returnOfHundred")}</small></div>
    </div>
    <div className="return-phrase"><ArabicText text={content.istighfar.arabic} citation={content.istighfar.source} /></div>
    {!desktop && <p className="muted small">{t("returnIstighfar")}</p>}
    <button type="button" className="action return-count" aria-keyshortcuts={desktop ? "Space" : undefined} onClick={() => void countOne()}>{t(desktop ? "returnDeskCount" : "returnCount")}</button>
    <a className="return-counter-source" href={content.istighfar.url}>{desktop ? content.istighfar.source : t("returnHadith", { source: content.istighfar.source })}</a>
  </section>;
}

function sayyidMeaning(index: number, language: string) {
  return language === "bn" ? content.sayyid.meaningsBn[index] : sayyidLines[index][1];
}

function MobileReturn({ settings, now }: ReturnProps) {
  const { language, t } = useCopy();
  const number = new Intl.NumberFormat(language);
  const line = useRecord("sayyid-line", 0);
  const plan = useRecord("qada", qadaDefaults);
  const logs = usePrayerLogs();
  const { madeUp, totalLeft } = qadaBalances(plan, logs);
  const totalMade = Object.values(madeUp).reduce((total, amount) => total + amount, 0);
  const icons = settings.mode === "maktab" ? "return-maktab" : "return";

  return <div className="return-page">
    <header className="return-heading">
      <p className="caption">{t("returnEyebrow")}</p>
      <h1>{t("welcomeReturn")}</h1>
      <p className="muted">{t("returnIntro")}</p>
    </header>
    <ReturnCounter settings={settings} now={now} />
    <section className="card return-sayyid">
      <div className="return-source-row">
        <a className="return-source-badge caption" href={content.sayyid.url} aria-label={content.sayyid.source}>Bukhari 6306</a>
        <small className="muted">{t("sayyidNote")} · Sahih</small>
      </div>
      <h2>{t("sayyidTitle")}</h2>
      <div className="return-sayyid-arabic"><ArabicText text={sayyidLines.slice(0, 2).map(([arabic]) => arabic).join("\n")} citation={content.sayyid.source} /></div>
      <p className="small">{sayyidMeaning(0, language)} {sayyidMeaning(1, language)}</p>
      <Link to="/return/sayyid" className="list-row return-list-link">
        <span className="icon-box"><DesignIcon name={icons + "-book"} size={22} /></span>
        <span><strong>{t(line > 0 ? "sayyidResume" : "sayyidStart")}</strong><small>{line > 0 ? t("sayyidLine", { line: line + 1, total: sayyidLines.length }) : t("sayyidDetails")}</small></span>
        <DesignIcon name={icons + "-chevron"} size={20} />
      </Link>
    </section>
    <section className="return-steps compact-stack">
      <h2>{t("returnSteps")}</h2>
      <ol className="compact-stack">
        {steps.map((step, index) => <li className="list-row return-step" key={step}>
          <span className="icon-box" aria-hidden="true">{number.format(index + 1)}</span>
          <span><strong>{t("return" + step)}</strong><small>{t("return" + step + "Detail")}</small></span>
        </li>)}
      </ol>
    </section>
    <ReturnHope />
    <Link to="/return/qada" className="list-row return-list-link">
      <span className="icon-box"><DesignIcon name={icons + "-calendar"} size={22} /></span>
      <span><strong>{t("qadaTitle")}</strong><small>{t("qadaSummary", { left: totalLeft, made: totalMade, pace: plan.withEachPrayer ? t("qadaEach") : t("qadaPace", { count: plan.dailyGoal }) })}</small></span>
      <DesignIcon name={icons + "-chevron"} size={20} />
    </Link>
    <Link to="/share?template=return&from=return" className="text-button return-share">{t("returnShare")}</Link>
  </div>;
}

function ReturnHope() {
  const { language } = useCopy();
  return <section className="return-hope compact-stack">
    <ArabicText text={content.hope.arabic} citation={content.hope.source} />
    <p>“{language === "bn" ? content.hope.meaningBn : content.hope.meaning}”</p>
    <a className="caption" href={content.hope.url}>{content.hope.source}</a>
  </section>;
}

function DesktopReturn({ settings, now }: ReturnProps) {
  const { t } = useCopy();
  const wide = useDesktop(1280);
  const word = useUi(state => state.word);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const historyButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const returningFromHistory = useRef(false);
  const day = dateKey(now, settings.city.timeZone);
  const stats = prayerStatistics(usePrayerLogs(), day);
  const inlineReflection = wide && !word;

  useEffect(() => {
    if (word || wide) {
      setReflectionOpen(false);
      setShowHistory(false);
    }
  }, [word, wide]);
  useLayoutEffect(() => {
    if (showHistory) backButton.current?.focus();
    else if (returningFromHistory.current) {
      returningFromHistory.current = false;
      historyButton.current?.focus();
    }
  }, [showHistory]);

  function backToReflection() {
    returningFromHistory.current = true;
    setShowHistory(false);
  }

  return <div className="return-desk" data-reflection={inlineReflection}>
    <div className="return-desk-column">
      <ReturnCounter settings={settings} now={now} desktop />
      <SayyidPath />
    </div>
    <Qada settings={settings} now={now} desktop embedded />
    {inlineReflection ? <ReturnReflection day={day} stats={stats} /> : <Dialog open={reflectionOpen} onOpenChange={open => {
      if (!open) setShowHistory(false);
      setReflectionOpen(open);
    }}>
      <DialogTrigger asChild><button type="button" className="action soft return-desk-reflection-trigger">{t("returnDeskReflection")}</button></DialogTrigger>
      <DialogContent className="awwab-dialog desktop-detail-drawer return-desk-drawer" overlayClassName="desktop-detail-overlay" showCloseButton={false}
        aria-describedby={undefined} onCloseAutoFocus={event => {
          if (!useUi.getState().word) return;
          event.preventDefault();
          document.querySelector<HTMLButtonElement>(".word-side .anatomy-close")?.focus();
        }} onEscapeKeyDown={event => {
          if (!showHistory) return;
          event.preventDefault();
          backToReflection();
        }}>
        <header className="row-between"><DialogTitle>{t(showHistory ? "returnDeskHistoryTitle" : "returnDeskReflection")}</DialogTitle>
          <DialogClose asChild><button type="button" className="icon-button" aria-label={t("qadaClose")}><X size={20} /></button></DialogClose>
        </header>
        {showHistory ? <>
          <button type="button" ref={backButton} className="text-button return-history-back" onClick={backToReflection}>{t("back")} · {t("returnDeskReflection")}</button>
          <ReturnHistory returnDays={stats.returnDays} />
        </> : <ReturnReflection day={day} stats={stats} historyTrigger={
          <button type="button" ref={historyButton} className="text-button" onClick={() => setShowHistory(true)}>{t("returnDeskHistory")}</button>
        } />}
      </DialogContent>
    </Dialog>}
  </div>;
}

const historyDate = { day: "numeric", month: "short", year: "numeric" } as const;

function ReturnHistory({ returnDays }: { returnDays: string[] }) {
  const { language, t } = useCopy();
  return <>
    {returnDays.length ? <ol className="compact-stack">{returnDays.slice().reverse().map(date => <li key={date} className="list-row">
      <time dateTime={date}>{formatDay(date, historyDate, language)}</time>
    </li>)}</ol> : <p className="muted">{t("returnDeskHistoryEmpty")}</p>}
    <Link to="/share?template=return&from=return" className="text-button">{t("returnShare")}</Link>
  </>;
}

function ReturnReflection({ day, stats: { returnDays, returns }, historyTrigger }: {
  day: string; stats: ReturnType<typeof prayerStatistics>; historyTrigger?: ReactNode;
}) {
  const { language, t } = useCopy();
  const number = new Intl.NumberFormat(language);
  const weeks = Array.from({ length: 10 }, (_, index) => {
    const until = addDays(day, (index - 9) * 7);
    const from = addDays(until, -6);
    return { from, count: returnDays.filter(date => from <= date && date <= until).length };
  });
  const maxWeeks = Math.max(1, ...weeks.map(week => week.count));

  return <div className="return-desk-column">
    <section className="card return-desk-history">
      <header className="row-between"><h2>{t("returnDeskReturns")}</h2>
        {historyTrigger ?? <Dialog>
          <DialogTrigger asChild><button type="button" className="text-button">{t("returnDeskHistory")}</button></DialogTrigger>
          <DialogContent className="awwab-dialog return-history-dialog" aria-describedby={undefined} showCloseButton={false}>
            <header className="row-between"><DialogTitle>{t("returnDeskHistoryTitle")}</DialogTitle>
              <DialogClose asChild><button type="button" className="icon-button" aria-label={t("qadaClose")}><X size={20} /></button></DialogClose>
            </header>
            <ReturnHistory returnDays={returnDays} />
          </DialogContent>
        </Dialog>}
      </header>
      <div className="return-desk-history-total"><strong>{number.format(returns)}</strong><small>{t("returnDeskReturnedTimes", { count: returns })}</small></div>
      <ol className="return-desk-bars" aria-label={t("returnDeskWeeks")}>
        {weeks.map(({ from, count }) => {
          const label = t("returnDeskWeek", { date: formatDay(from, historyDate, language), count });
          return <li key={from} title={label} data-active={count > 0} style={{ "--bar-height": (100 * count / maxWeeks) + "%" } as CSSProperties}>
            <span className="sr-only">{label}</span>
          </li>;
        })}
      </ol>
    </section>
    <section className="card return-desk-steps">
      <h2>{t("returnDeskSteps")}</h2>
      <ol>{steps.map((step, index) => <li key={step}>
        <span aria-hidden="true">{number.format(index + 1)}</span>{t(step === "Repair" ? "returnDeskRepair" : "return" + step)}
      </li>)}</ol>
    </section>
    <ReturnHope />
  </div>;
}

function SayyidPath({ selected }: { selected?: number }) {
  const { language, t } = useCopy();
  const line = useRecord("sayyid-line", 0);
  const current = selected ?? line;
  const reviewed = useRecord<number[] | null>("sayyid-reviewed", null);

  return <section className="card return-desk-sayyid">
    <header className="row-between"><h2>{t("sayyidTitle")}</h2>
      <Link to={`/return/sayyid?line=${current + 1}`} className="text-button">{t("sayyidLine", { line: current + 1, total: sayyidLines.length })}</Link>
    </header>
    <ol>{sayyidLines.map(([arabic], index) => {
      const done = current !== index && (reviewed?.includes(index) ?? index < line);
      return <li key={arabic}><Link to={`/return/sayyid?line=${index + 1}`} aria-current={current === index ? "step" : undefined}>
        <span className="return-desk-line-dot" data-reviewed={done} aria-hidden="true" />
        <span className={done ? "muted" : undefined}>{current === index
          ? t("sayyidCurrent", { meaning: sayyidMeaning(index, language) })
          : done ? <><span className="sr-only">{t("sayyidLineOnly", { line: index + 1 })} · </span>{t("sayyidReviewed")}</>
          : t("sayyidLineOnly", { line: index + 1 })}</span>
      </Link></li>;
    })}</ol>
    <a className="small" href={content.sayyid.url}>{content.sayyid.source}</a>
  </section>;
}

export function Sayyid({ settings, desktop }: { settings: Settings; desktop: boolean }) {
  const { language, t } = useCopy();
  const index = useRecord("sayyid-line", 0);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const selected = Number(params.get("line"));
  const active = Number.isInteger(selected) && selected >= 1 && selected <= sayyidLines.length ? selected - 1 : index;
  const [saving, setSaving] = useState(false);
  const progress = t("sayyidLine", { line: active + 1, total: sayyidLines.length });
  useEffect(() => { useUi.getState().selectWord(); }, [active]);
  async function go(next: number, reviewed: boolean) {
    setSaving(true);
    try {
      const finished = next === sayyidLines.length;
      await db.transaction("rw", db.records, async () => {
        const saved = await getRecord("sayyid-line", 0);
        const known = await getRecord<number[]>("sayyid-reviewed", Array.from({ length: saved }, (_, line) => line));
        await db.records.bulkPut([
          { key: "sayyid-line", value: finished ? active : next },
          { key: "sayyid-reviewed", value: reviewed ? [...new Set([...known, active])] : known },
        ]);
      });
      if (finished) navigate("/return");
      else setParams({ line: String(next + 1) }, { replace: true });
    }
    catch { toast.error(t("sayyidError")); }
    finally { setSaving(false); }
  }
  return <div className="sayyid-page" data-desktop={desktop}>
    {desktop
      ? <Link className="text-button qada-desk-back" to="/return">{t("back")} · {t("return")}</Link>
      : <PracticeHeader title={t("sayyidTitle")} back="/return" maktab={settings.mode === "maktab"} />}
    {desktop && <SayyidPath selected={active} />}
    <section className="card return-sayyid sayyid-study">
      <p className="caption" aria-live="polite">{progress}</p>
      <progress value={active + 1} max={sayyidLines.length} aria-label={progress} />
      <div className="return-sayyid-arabic">
        <ArabicText text={sayyidLines[active][0]} citation={content.sayyid.source} />
      </div>
      <p>{sayyidMeaning(active, language)}</p>
      <a className="small" href={content.sayyid.url}>{content.sayyid.source}</a>
      <div className="equal-row">
        <button className="action light" disabled={active === 0 || saving} onClick={() => void go(active - 1, false)}>{t("sayyidPrevious")}</button>
        <button className="action" disabled={saving} onClick={() => void go(active + 1, true)}>{t(active + 1 < sayyidLines.length ? "sayyidNext" : "sayyidDone")}</button>
      </div>
    </section>
  </div>;
}
