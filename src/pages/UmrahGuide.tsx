import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { DesignIcon } from "@/components/DesignIcon";
import { SectionNav } from "@/components/Surface";
import { UmrahGuideVoice } from "@/components/UmrahGuideVoice";
import { UmrahRitualDua, UmrahRitualSources, UmrahTawafDiagram } from "@/components/UmrahRitualContent";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRecord } from "@/hooks/use-awwab";
import { useUmrahVoice } from "@/hooks/use-umrah-voice";
import { useCopy } from "@/lib/copy";
import { updateRecord } from "@/lib/storageService";
import { saiLapEnds, tawafRounds } from "@/lib/umrah";
import { umrahStepSummary, umrahStepTitle } from "@/lib/umrah-step-messages.mjs";
import ritual from "../../docs/content/umrah-steps.json";

const practiceKey = "umrah-practice";
const initialPractice = { step: 2, tawaf: 0, sai: 0, completed: [] as number[] };
const laps = [1, 2, 3, 4, 5, 6, 7];
const ends = { safa: "umrahSaiSafa", marwah: "umrahSaiMarwah" } as const;

export function UmrahGuide() {
  const { t, locale } = useCopy();
  const { state } = useLocation();
  const progress = useRecord(practiceKey, initialPractice);
  const [error, setError] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const selected = useRef<HTMLHeadingElement>(null);
  const step = ritual.steps[progress.step] ?? ritual.steps[initialPractice.step];
  const title = t(umrahStepTitle(step.id));
  const counter = step.id === "tawaf" || step.id === "sai" ? step.id : undefined;
  const count = counter ? progress[counter] : 0;
  const { from, to } = saiLapEnds(count + 1);
  const complete = progress.completed.includes(progress.step);
  const number = new Intl.NumberFormat(locale);
  const voice = useUmrahVoice(step.id, false, false);

  async function save(update: (old: typeof initialPractice) => typeof initialPractice) {
    try {
      await updateRecord(practiceKey, initialPractice, update);
      setError(false);
      return true;
    } catch {
      setError(true);
      return false;
    }
  }

  async function select(index: number) {
    if (await save(old => ({ ...old, step: index }))) {
      selected.current?.focus({ preventScroll: true });
      selected.current?.closest("section")?.scrollIntoView({ block: "nearest" });
    }
  }

  function changeCount(change: number) {
    if (counter) void save(old => ({ ...old, [counter]: tawafRounds(old[counter], change) }));
  }

  function toggleStep() {
    const index = progress.step;
    void save(old => ({ ...old, completed: old.completed.includes(index)
      ? old.completed.filter(value => value !== index) : [...old.completed, index] }));
  }

  const caption = t("umrahPracticeCaption", {
    step: progress.step + 1,
    title: counter ? t(counter === "tawaf" ? "umrahPracticeTawaf" : "umrahPracticeSai") : title,
  });
  const countLabel = counter === "tawaf"
    ? t(count === 7 ? "umrahPracticeTawafDone" : "umrahPracticeRound", { round: count + 1, total: 7 })
    : t(count === 7 ? "umrahPracticeSaiDone" : "umrahPracticeLap", { round: count + 1, total: 7, from: t(ends[from]), to: t(ends[to]) });

  return <article className="umrah-practice">
    <audio ref={voice.player.element} preload="none" hidden {...voice.player.events} />
    <Dialog onOpenChange={open => {
      if (!open) { setConfirmReset(false); voice.stopFollowing(); }
    }}>
      <SectionNav title={t("umrahPracticeTitle")} back={state?.from === "umrah-preparation" ? "/umrah" : "/plan"}
        backIcon={<DesignIcon name="guide-back" size={24} />}
        action={<DialogTrigger type="button" className="icon-button" aria-label={t("umrahPracticeSettings")}>
          <DesignIcon name="guide-settings" size={24} />
        </DialogTrigger>} />
      <DialogContent className="awwab-dialog umrah-practice-options" showCloseButton={false}>
        <div className="row-between">
          <DialogTitle>{t("umrahPracticeSettings")}</DialogTitle>
          <DialogClose className="action light">{t("umrahFocusDone")}</DialogClose>
        </div>
        <DialogDescription>{t("umrahPracticeSaved")}</DialogDescription>
        <UmrahGuideVoice step={step} title={title} voice={voice} embedded />
        <div className="equal-row">
          <Link to="/umrah" className="action soft">{t("umrah")}</Link>
          <Link to="/print/umrah-guide" state={{ from: "umrah-guide" }} className="action light">{t("umrahPrepPrint")}</Link>
        </div>
        {confirmReset ? <div className="compact-stack">
          <p>{t("umrahPracticeResetConfirm")}</p>
          <div className="equal-row">
            <button type="button" className="action light" onClick={() => setConfirmReset(false)}>{t("cancel")}</button>
            <button type="button" className="action soft" onClick={async () => {
              if (await save(() => initialPractice)) setConfirmReset(false);
            }}>{t("umrahPracticeReset")}</button>
          </div>
        </div> : <button type="button" className="text-button" onClick={() => setConfirmReset(true)}>{t("umrahPracticeReset")}</button>}
        {error && <p role="alert" className="small">{t("umrahPracticeSaveError")}</p>}
      </DialogContent>
    </Dialog>
    <div className="umrah-practice-body">
      <section className="umrah-practice-active night" aria-labelledby="umrah-practice-step">
        <header className="row-between">
          <h2 className="caption" id="umrah-practice-step" tabIndex={-1} ref={selected}>{caption}</h2>
          {counter === "tawaf" && <p className="small muted">{t("umrahPracticeCounterClockwise")}</p>}
        </header>
        {counter === "tawaf" && <UmrahTawafDiagram />}
        {counter ? <>
          <ol className="umrah-practice-laps" aria-hidden="true">
            {laps.map(lap => <li key={lap} data-done={lap <= count} data-next={lap === count + 1}>{number.format(lap)}</li>)}
          </ol>
          <p className="small umrah-practice-count" aria-live="polite">{countLabel}</p>
          <div className="equal-row">
            <button type="button" className="action light" onClick={() => changeCount(-1)} disabled={count === 0}>{t("umrahPracticeUndo")}</button>
            <button type="button" className="action gold" onClick={() => changeCount(1)} disabled={count === 7}>
              {t(counter === "tawaf" ? "umrahPracticeCountRound" : "umrahPracticeCountLap")}
            </button>
          </div>
        </> : <>
          <h3>{title}</h3>
          <p>{t(umrahStepSummary(step.id))}</p>
          <div className="equal-row">
            <button type="button" className="action light" aria-pressed={complete} onClick={toggleStep}>
              {t(complete ? "umrahPracticeCompleted" : "umrahPracticeComplete")}
            </button>
            <button type="button" className="action gold" disabled={progress.step >= ritual.steps.length - 1}
              onClick={() => void select(progress.step + 1)}>{t("umrahGuideNext")}</button>
          </div>
        </>}
        {error && <p role="alert" className="small">{t("umrahPracticeSaveError")}</p>}
      </section>
      <aside className="umrah-practice-aside compact-stack">
        {step.id === "talbiyah" && <UmrahRitualDua kind="talbiyah" />}
        {step.id === "tawaf" && <UmrahRitualDua kind="good" />}
        <p className="small muted"><UmrahRitualSources sources={step.sources} /></p>
      </aside>
      <section className="umrah-practice-steps compact-stack">
        <h2>{t("umrahPracticeAll")}</h2>
        <ol className="compact-stack">
          {ritual.steps.map((item, i) => {
            const done = item.id === "tawaf" || item.id === "sai" ? progress[item.id] === 7 : progress.completed.includes(i);
            return <li key={item.id}><button type="button" className="list-row" aria-current={i === progress.step ? "step" : undefined}
              data-done={done} onClick={() => void select(i)}>
              <span className="umrah-practice-progress" aria-hidden="true">{done
                ? <DesignIcon name="paths-phone-check" size={16} /> : number.format(i + 1)}</span>
              <span><strong>{t(umrahStepTitle(item.id))}</strong><small>{t(umrahStepSummary(item.id))}</small>
                {done && <span className="sr-only"> {t("umrahPracticeCompleted")}</span>}</span>
            </button></li>;
          })}
        </ol>
        <p className="small muted">{t("umrahGuideScholars")}</p>
      </section>
    </div>
  </article>;
}
