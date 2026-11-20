import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCopy } from "@/lib/copy";
import { correctSai, saiGuidePosition, saiLapEnds, type Coord, type SaiCourse, type UmrahTrip, type UmrahTripUpdater } from "@/lib/umrah";
import { DesignIcon } from "./DesignIcon";

const laps = [1, 2, 3, 4, 5, 6, 7];
const endNames = { safa: "umrahSaiSafa", marwah: "umrahSaiMarwah" } as const;

export function UmrahSaiGuide({ trip, step, total, course, point, save, note, locationError, children }: {
  trip: UmrahTrip; step: number; total: number; course?: SaiCourse; point?: Coord; note: string; locationError?: string; children: ReactNode;
  save: UmrahTripUpdater;
}) {
  const { t, locale } = useCopy();
  const navigate = useNavigate();
  const number = new Intl.NumberFormat(locale);
  const [correcting, setCorrecting] = useState<number>();
  const correctionTrigger = useRef<HTMLButtonElement | null>(null);
  const { count, last, detected } = trip.sai;
  const paused = trip.saiPaused;
  const finished = count >= laps.length;
  const next = count + 1;
  const { from, to } = saiLapEnds(next);
  const destination = t(endNames[to]);
  const auto = Boolean(trip.gps && trip.auto && course);
  const position = auto && !paused && !finished && course && point ? saiGuidePosition(course, point, to) : undefined;
  const status = paused ? "umrahSaiPaused" : position ? "umrahSaiLive" : "umrahSaiManual";
  const hint = !trip.gps
    ? t("umrahSaiEnableLocation")
    : auto && detected && last
      ? t("umrahSaiDetected", { lap: count, place: t(endNames[last]) })
      : auto && !position && !paused && !finished
        ? t("umrahSaiPendingLocation")
        : t("umrahSaiCorrectionHint");

  function correct(value: number) {
    setCorrecting(undefined);
    void save(old => old.step === step ? { ...old, sai: correctSai(old.sai, value, Date.now()) } : old);
  }

  function lapDone() {
    void save(old => {
      if (old.step !== step) return old;
      if (old.sai.count >= laps.length) return finished ? { ...old, step: Math.min(total - 1, step + 1) } : old;
      return old.saiPaused ? old : { ...old, sai: correctSai(old.sai, old.sai.count + 1, Date.now()) };
    });
  }

  return <>
    <header className="umrah-sai-header night">
      <div className="row-between">
        <div>
          <p className="caption">{t("umrahGuideStep", { step: step + 1, total })} · {t("umrahSaiName")}</p>
          <h1 aria-live="polite">{finished ? t("umrahSaiCompleted") : t("umrahSaiHeading", { lap: next, destination })}</h1>
        </div>
        <span className="chip umrah-sai-status">{position && <DesignIcon name="umrah-live-pin" size={14} />}{t(status)}</span>
      </div>
      <div className="umrah-sai-laps" role="group" aria-label={t("umrahSaiCorrect")}>
        {laps.map(lap => {
          const ends = saiLapEnds(lap);
          const direction = ends.from === "safa" ? "umrahSaiSafaMarwah" : "umrahSaiMarwahSafa";
          const label = t("umrahSaiLap", { lap, from: t(endNames[ends.from]), to: t(endNames[ends.to]) });
          return <button type="button" key={lap} data-complete={lap <= count} aria-current={lap === next ? "step" : undefined}
            aria-label={lap <= count ? t("umrahSaiCompletedLap", { lap: label }) : label}
            aria-haspopup="dialog" onClick={event => { correctionTrigger.current = event.currentTarget; setCorrecting(lap); }}>
            <span aria-hidden="true">{number.format(lap)}</span>
            <small aria-hidden="true" dir="ltr">{t(direction)}</small>
          </button>;
        })}
      </div>
    </header>
    <div className="umrah-sai-body">
      <figure className="card umrah-sai-course" aria-label={t("umrahSaiSchematic")}>
        <figcaption className="umrah-sai-distance">
          <span className="caption">{position ? t("umrahSaiTo", { destination }) : t("umrahSaiWalk")}</span>
          {position && <strong>{t("umrahSaiDistance", { meters: Math.round(position.meters / 10) * 10 })}</strong>}
        </figcaption>
        <div className="umrah-sai-track">
          <strong className="umrah-sai-end umrah-sai-marwah">{t(endNames.marwah)}</strong>
          <strong className="umrah-sai-end umrah-sai-safa">{t(endNames.safa)}</strong>
          <div className="umrah-sai-green"><span>{t("umrahSaiGreenLights")}</span></div>
          {position && <div className="umrah-sai-progress" data-from={from}
            style={{ "--sai-y": `${(1 - position.fraction) * 100}%` } as CSSProperties}>
            <span className="umrah-sai-trace" aria-hidden="true" />
            <div className="umrah-sai-marker">
              <span className="umrah-sai-you">{t("umrahSaiYou")}</span>
              <DesignIcon name="umrah-live-halo" size={36} className="umrah-sai-halo" />
              <DesignIcon name="umrah-live-position" size={18} className="umrah-sai-dot" />
            </div>
          </div>}
        </div>
      </figure>
      <section className="card tint umrah-sai-cue">
        <h2 className="with-icon"><DesignIcon name="umrah-prep-volume" size={16} />
          {finished ? t("umrahSaiName") : t("umrahSaiOnArrival", { destination })}
        </h2>
        <p className="small muted">{note}</p>
        <details>
          <summary className="small">{t("umrahGuideVoice")}</summary>
          {children}
        </details>
      </section>
      {course && <section className="card umrah-sai-automatic">
        <button type="button" className="umrah-sai-switch row-between" role="switch" aria-label={t("umrahSaiAutoCount")}
          aria-checked={auto} onClick={() => {
            if (!trip.gps) navigate("/umrah/location", { state: { from: "rituals" } });
            else void save(old => ({ ...old, auto: !old.auto }));
          }}>
          <span><strong>{t("umrahSaiAutoCount")}</strong><small className="muted">{hint}</small></span>
          <span className="share-switch-track" aria-hidden="true" />
        </button>
        {trip.gps && locationError && <p className="small muted" role="status">{t(locationError)}</p>}
      </section>}
      <div className="equal-row umrah-sai-actions">
        <button type="button" className="action light" disabled={finished}
          onClick={() => void save(old => old.step === step ? {
            ...old, saiPaused: !old.saiPaused,
            sai: { ...old.sai, lastAt: old.sai.last ? Date.now() : undefined, exited: false },
          } : old)}>
          {t(paused ? "umrahSaiResume" : "umrahSaiPause")}
        </button>
        <button type="button" className="action" disabled={paused && !finished} onClick={lapDone}>
          {t(finished ? "umrahGuideNext" : "umrahSaiLapDone")}
        </button>
      </div>
    </div>
    <Dialog open={correcting !== undefined} onOpenChange={open => { if (!open) setCorrecting(undefined); }}>
      <DialogContent className="umrah-sai-correction card" showCloseButton={false} onCloseAutoFocus={event => {
        event.preventDefault();
        correctionTrigger.current?.focus();
      }}>
        <DialogTitle>{t("umrahSaiCorrect")}</DialogTitle>
        <DialogDescription className="sr-only">{t("umrahSaiCorrection", { count: correcting ?? count })}</DialogDescription>
        <div className="equal-row">
          <DialogClose className="action light">{t("umrahSaiCancel")}</DialogClose>
          <button type="button" className="action" onClick={() => correct(correcting ?? count)}>
            {t("umrahSaiCorrection", { count: correcting ?? count })}
          </button>
        </div>
        <button type="button" className="text-button" onClick={() => correct(0)}>{t("umrahSaiBeforeFirst")}</button>
      </DialogContent>
    </Dialog>
  </>;
}
