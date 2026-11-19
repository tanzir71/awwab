import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { PracticeHeader } from "@/components/PracticeHeader";
import { usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { dateKey } from "@/lib/dates";
import { qadaBalances, qadaDefaults } from "@/lib/qada";
import { type Settings, updateRecord } from "@/lib/storageService";
import content from "../../docs/content/return.json";

const steps = ["Stop", "Regret", "Resolve", "Repair"];
const sayyidLines = content.sayyid.lines;

export function ReturnPage({ settings, now }: { settings: Settings; now: Date }) {
  const { language, t } = useCopy();
  const number = new Intl.NumberFormat(language);
  const day = dateKey(now, settings.city.timeZone);
  const counters = useRecord<Record<string, number>>("istighfar", {});
  const count = counters[day] ?? 0;
  const line = useRecord("sayyid-line", 0);
  const plan = useRecord("qada", qadaDefaults);
  const logs = usePrayerLogs();
  const { madeUp, totalLeft } = qadaBalances(plan, logs);
  const totalMade = Object.values(madeUp).reduce((total, amount) => total + amount, 0);
  const icons = settings.mode === "maktab" ? "return-maktab" : "return";
  const meaning = (index: number) => language === "bn" ? content.sayyid.meaningsBn[index] : sayyidLines[index][1];
  const progress = Math.min(100, count);

  async function countOne() {
    try {
      const today = dateKey(new Date(), settings.city.timeZone);
      await updateRecord<Record<string, number>>("istighfar", {}, value => ({ ...value, [today]: (value[today] ?? 0) + 1 }));
    } catch {
      toast.error(t("returnCountError"));
      return;
    }
    navigator.vibrate?.(15);
  }

  return <div className="return-page">
    <header className="return-heading">
      <p className="caption">{t("returnEyebrow")}</p>
      <h1>{t("welcomeReturn")}</h1>
      <p className="muted">{t("returnIntro")}</p>
    </header>
    <section className="return-counter night" aria-label={t("returnDailyGoal")}>
      <div className="count-ring" style={{ "--count": progress + "%" } as CSSProperties}>
        <div className="count-window"><strong aria-live="polite">{number.format(count)}</strong><small>{t("returnOfHundred")}</small></div>
      </div>
      <div className="return-phrase"><ArabicText text={content.istighfar.arabic} citation={content.istighfar.source} /></div>
      <p className="muted small">{t("returnIstighfar")}</p>
      <button className="action return-count" onClick={() => void countOne()}>{t("returnCount")}</button>
      <a className="return-counter-source" href={content.istighfar.url}>{t("returnHadith", { source: content.istighfar.source })}</a>
    </section>
    <section className="card return-sayyid">
      <div className="return-source-row">
        <a className="return-source-badge caption" href={content.sayyid.url} aria-label={content.sayyid.source}>Bukhari 6306</a>
        <small className="muted">{t("sayyidNote")} · Sahih</small>
      </div>
      <h2>{t("sayyidTitle")}</h2>
      <div className="return-sayyid-arabic"><ArabicText text={sayyidLines.slice(0, 2).map(([arabic]) => arabic).join("\n")} citation={content.sayyid.source} /></div>
      <p className="small">{meaning(0)} {meaning(1)}</p>
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
    <section className="return-hope compact-stack">
      <ArabicText text={content.hope.arabic} citation={content.hope.source} />
      <p>“{language === "bn" ? content.hope.meaningBn : content.hope.meaning}”</p>
      <a className="caption" href={content.hope.url}>{content.hope.source}</a>
    </section>
    <Link to="/return/qada" className="list-row return-list-link">
      <span className="icon-box"><DesignIcon name={icons + "-calendar"} size={22} /></span>
      <span><strong>{t("qadaTitle")}</strong><small>{t("qadaSummary", { left: totalLeft, made: totalMade, pace: plan.withEachPrayer ? t("qadaEach") : t("qadaPace", { count: plan.dailyGoal }) })}</small></span>
      <DesignIcon name={icons + "-chevron"} size={20} />
    </Link>
    <Link to="/share?template=return&from=return" className="text-button return-share">{t("returnShare")}</Link>
  </div>;
}

export function Sayyid({ settings }: { settings: Settings }) {
  const { language, t } = useCopy();
  const index = useRecord("sayyid-line", 0);
  const active = Math.max(0, Math.min(index, sayyidLines.length - 1));
  const [saving, setSaving] = useState(false);
  const progress = t("sayyidLine", { line: active + 1, total: sayyidLines.length });
  async function go(next: number) {
    setSaving(true);
    try { await updateRecord("sayyid-line", 0, () => next); }
    catch { toast.error(t("sayyidError")); }
    finally { setSaving(false); }
  }
  return <div className="sayyid-page">
    <PracticeHeader title={t("sayyidTitle")} back="/return" maktab={settings.mode === "maktab"} />
    <section className="card return-sayyid sayyid-study">
      <p className="caption" aria-live="polite">{progress}</p>
      <progress value={active + 1} max={sayyidLines.length} aria-label={progress} />
      <div className="return-sayyid-arabic">
        <ArabicText text={sayyidLines[active][0]} citation={content.sayyid.source} />
      </div>
      <p>{language === "bn" ? content.sayyid.meaningsBn[active] : sayyidLines[active][1]}</p>
      <a className="small" href={content.sayyid.url}>{content.sayyid.source}</a>
      <div className="equal-row">
        <button className="action light" disabled={active === 0 || saving} onClick={() => void go(active - 1)}>{t("sayyidPrevious")}</button>
        {active + 1 < sayyidLines.length
          ? <button className="action" disabled={saving} onClick={() => void go(active + 1)}>{t("sayyidNext")}</button>
          : <Link className="action" to="/return">{t("sayyidDone")}</Link>}
      </div>
    </section>
  </div>;
}
