import { useState } from "react";
import { BookOpen, CalendarClock, Moon, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { ListLink, SectionNav } from "@/components/Surface";
import { usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { dateKey, formatDay } from "@/lib/dates";
import { estimateQada, finishQada, qadaBalances, qadaDefaults } from "@/lib/qada";
import { type Settings, updateRecord } from "@/lib/storageService";
import { prayerIds, prayerNames } from "@/types/Prayer";
import { message } from "@/lib/copy";
import content from "../../docs/content/return.json";

const returnSteps = [
  { title: "Stop", adult: "Leave it behind as best you can today.", maktab: "Stop doing the thing you know is wrong." },
  { title: "Regret", adult: "Recognise what happened with honesty and care.", maktab: "Tell Allah you’re sorry." },
  { title: "Resolve", adult: "Intend to leave it behind. If you slip, return again.", maktab: "Make a plan to do better next time." },
  { title: "Repair", adult: "If someone was wronged, make it right where you can.", maktab: "If someone was hurt, try to make things right." },
];

export function ReturnPage({ settings, now }: { settings: Settings; now: Date }) {
  const day = dateKey(now, settings.city.timeZone);
  const counters = useRecord<Record<string, number>>("istighfar", {});
  const count = counters[day] ?? 0;
  const line = useRecord("sayyid-line", 0);
  const isMaktab = settings.mode === "maktab";
  async function countOne() {
    try {
      const today = dateKey(new Date(), settings.city.timeZone);
      await updateRecord<Record<string, number>>("istighfar", {}, value => ({ ...value, [today]: (value[today] ?? 0) + 1 }));
      navigator.vibrate?.(15);
    } catch {
      toast.error("The count could not be saved. Try again.");
    }
  }
  return <div className="stack">
    <header className="compact-stack">
      <p className="caption">Return · At-tawbah</p>
      <h1>{message(settings, "welcomeReturn")}</h1>
      <p className="muted">{isMaktab ? "You can always come back to Allah." : "Whatever happened, you’re here now. Tawbah means to return."}</p>
    </header>
    <section className="card night stack text-center">
      <div className="count-ring" style={{ "--count": Math.min(100, count) + "%" } as React.CSSProperties} role="progressbar" aria-label="Daily istighfar goal" aria-valuenow={Math.min(count, 100)} aria-valuemax={100}>
        <div><strong>{count}</strong><small className="muted">of 100 today</small></div>
      </div>
      <div><ArabicText text={content.istighfar.arabic} citation={content.istighfar.source} /><p className="muted small">Astaghfirullah · I seek Allah’s forgiveness</p></div>
      <button className="action gold" onClick={() => void countOne()}>Tap to count</button>
      <a className="caption" href={content.istighfar.url}>{content.istighfar.source}</a>
    </section>
    <section className="card stack">
      <a className="caption" href={content.sayyid.url}>{content.sayyid.source}</a>
      <h2>Sayyid al-Istighfār</h2>
      <div className="text-right"><ArabicText text={content.sayyid.lines.slice(0, 2).map(line => line[0]).join("\n")} citation={content.sayyid.source} /></div>
      <p>{content.sayyid.lines.slice(0, 2).map(line => line[1]).join(" ")}</p>
      <ListLink to="/return/sayyid" icon={<BookOpen size={22} />} title={line ? "Continue line by line" : "Learn it line by line"} detail={line ? `Line ${line + 1} of 7` : "Seven lines · tap any word"} />
    </section>
    <section className="compact-stack">
      <h2>A sincere return, in four steps</h2>
      {returnSteps.map((step, index) => <div className="list-row" key={step.title}>
        <span className="icon-box">{index + 1}</span><span><strong>{step.title}</strong><small>{isMaktab ? step.maktab : step.adult}</small></span>
      </div>)}
    </section>
    <section className="card soft compact-stack">
      <ArabicText text={content.hope.arabic} citation={content.hope.source} />
      <p>{content.hope.meaning}</p>
      <a className="caption" href={content.hope.url}>{content.hope.source}</a>
    </section>
    <ListLink to="/return/qada" icon={<CalendarClock size={22} />} title="Make-up prayers and fasts" detail="Keep track at a pace that works for you" />
    <Link to="/share?template=return&from=return" className="action soft">Share progress</Link>
  </div>;
}

export function Sayyid() {
  const index = useRecord("sayyid-line", 0);
  const [line, setLine] = useState<number>();
  const active = line ?? index;
  function go(next: number) {
    setLine(next);
    void updateRecord("sayyid-line", 0, () => next).catch(() => toast.error("This line could not be saved."));
  }
  return <div className="stack">
    <SectionNav title="Sayyid al-Istighfār" back="/return" />
    <section className="card stack">
      <p className="caption">Line {active + 1} of 7</p>
      <progress value={active + 1} max={7} aria-label="Learning progress" />
      <ArabicText text={content.sayyid.lines[active][0]} citation={content.sayyid.source} />
      <p>{content.sayyid.lines[active][1]}</p>
      <a className="small" href={content.sayyid.url}>{content.sayyid.source}</a>
      <div className="equal-row">
        <button className="action light" disabled={!active} onClick={() => go(active - 1)}>Previous line</button>
        {active < 6 ? <button className="action" onClick={() => go(active + 1)}>Next line</button> : <Link className="action" to="/return">Done for today</Link>}
      </div>
    </section>
  </div>;
}

export function Qada({ settings, now }: { settings: Settings; now: Date }) {
  const plan = useRecord("qada", qadaDefaults);
  const logs = usePrayerLogs();
  const [edit, setEdit] = useState(false);
  const today = dateKey(now, settings.city.timeZone);
  const { madeUp, remaining, totalLeft } = qadaBalances(plan, logs);
  const totalMade = Object.values(madeUp).reduce((total, count) => total + count, 0);
  const end = finishQada(today, totalLeft, plan.dailyGoal);
  async function save(update: (previous: typeof qadaDefaults) => typeof qadaDefaults) {
    try { await updateRecord("qada", qadaDefaults, update); }
    catch { toast.error("Your make-up plan could not be saved."); }
  }

  return <div className="stack">
    <SectionNav title="Make-up prayers" back="/return" />
    <section className="card stack">
      <p className="caption">Left to make up</p>
      <h2 className="numeral">{totalLeft.toLocaleString()} <small className="muted">prayers</small></h2>
      <progress value={totalMade} max={totalLeft + totalMade || 1} aria-label="Make-up prayer progress" />
      <p className="muted">{totalMade} made up so far. {end && `At ${plan.dailyGoal} a day, the projected finish is ${formatDay(end)}.`}</p>
    </section>
    <div className="equal-row" aria-label="Daily goals">{[1, 3, 5].map(goal => <button className={`action ${plan.dailyGoal === goal ? "" : "light"}`} key={goal}
      aria-pressed={plan.dailyGoal === goal} onClick={() => void save(old => ({ ...old, dailyGoal: goal }))}>{goal} / day</button>)}</div>
    <section className="compact-stack">
      <h2>By prayer</h2>
      {prayerIds.map(id => <div className="list-row" key={id}>
        <div className="grow"><strong>{prayerNames[id]}</strong><small>{madeUp[id]} made up</small></div>
        <span>{remaining[id]} left</span>
        <button className="action" aria-label={`+ 1 Record one make-up ${prayerNames[id]}`}
          onClick={() => void save(old => ({ ...old, madeUp: { ...old.madeUp, [id]: old.madeUp[id] + 1 } }))}>+ 1</button>
      </div>)}
    </section>
    <button className="action soft" onClick={() => setEdit(value => !value)} aria-expanded={edit}><RefreshCw size={18} /> Estimate from years missed</button>
    {edit && <form className="card stack" onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      void save(old => ({ ...old, estimated: estimateQada(Number(values.get("years")), Number(values.get("prayed"))) }));
      setEdit(false);
    }}>
      <p className="muted">Estimate the years since you became responsible, and subtract prayers you did pray.</p>
      <label className="field">Years to include<input type="number" name="years" min="0" max="150" step=".01" required /></label>
      <label className="field">Prayers already prayed in that period<input type="number" name="prayed" min="0" max="300000" defaultValue="0" required /></label>
      <button className="action">Save estimate</button>
    </form>}
    <section className="card stack">
      <h2 className="with-icon"><Moon size={22} /> Missed fasts</h2>
      <p>{Math.max(0, plan.fasts - plan.fastsMadeUp)} left · {plan.fastsMadeUp} made up</p>
      <label className="field">Fasts to make up in total<input type="number" min="0" step="1" defaultValue={plan.fasts} onBlur={event => {
        const fasts = event.target.valueAsNumber;
        if (Number.isInteger(fasts) && fasts >= 0) void save(old => ({ ...old, fasts }));
      }} /></label>
      <button className="action soft" disabled={plan.fastsMadeUp >= plan.fasts} onClick={() => void save(old => ({ ...old, fastsMadeUp: Math.min(old.fasts, old.fastsMadeUp + 1) }))}>Record a make-up fast</button>
    </section>
    <section className="card tint">
      <strong>Every one you make up counts. Take it one prayer at a time.</strong>
      <p>Scholars differ on making up prayers deliberately missed in the past. For guidance on your situation, ask a scholar you trust.</p>
    </section>
  </div>;
}
