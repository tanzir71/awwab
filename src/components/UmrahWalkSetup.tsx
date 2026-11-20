import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCopy } from "@/lib/copy";
import type { UmrahTrip, UmrahTripUpdater } from "@/lib/umrah";
import { DesignIcon } from "./DesignIcon";

function WalkSwitch({ label, hint, checked, disabled, onChange }: {
  label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return <button type="button" className="umrah-walk-switch row-between" role="switch" aria-checked={checked}
    aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`} disabled={disabled} onClick={() => onChange(!checked)}>
    <span><strong id={`${id}-title`}>{label}</strong><small className="muted" id={`${id}-hint`}>{hint}</small></span>
    <span aria-hidden="true" className="share-switch-track" />
  </button>;
}

export function UmrahWalkSetup({ trip, save, back, hasAuto, locationError }: {
  trip: UmrahTrip; save: UmrahTripUpdater; back: string; hasAuto: boolean; locationError?: string;
}) {
  const { t } = useCopy();
  const navigate = useNavigate();
  const configured = Boolean(trip.walkOptions || trip.gps || trip.auto);
  const [edits, setEdits] = useState<Partial<{ gps: boolean; auto: boolean; voice: boolean; remember: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const choices = {
    gps: configured ? trip.gps : true,
    auto: configured ? trip.auto : true,
    voice: trip.walkOptions?.voice ?? !configured,
    remember: trip.walkOptions?.remember ?? !configured,
    ...edits,
  };

  async function submit() {
    if (saving) return;
    setSaving(true);
    const ok = await save(old => ({
      ...old, gps: choices.gps, auto: choices.gps && choices.auto && hasAuto,
      walkOptions: { voice: choices.voice, remember: choices.gps && choices.remember },
    }));
    if (ok) navigate(back, { replace: true });
    else setSaving(false);
  }

  return <form className="umrah-walk" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <header className="umrah-walk-intro">
      <span className="umrah-walk-emblem"><DesignIcon name="umrah-walk-footprints" size={28} /></span>
      <h1>{t("umrahWalkTitle")}</h1>
      <p className="muted">{t("umrahWalkIntro")}</p>
    </header>
    <div className="card umrah-walk-choices">
      <WalkSwitch label={t("umrahWalkByLocation")} hint={t("umrahWalkByLocationHint")}
        checked={choices.gps} disabled={saving} onChange={gps => setEdits(current => ({ ...current, gps }))} />
      <WalkSwitch label={t("umrahWalkAuto")} hint={t("umrahWalkAutoHint")} checked={choices.gps && choices.auto && hasAuto}
        disabled={saving || !choices.gps || !hasAuto} onChange={auto => setEdits(current => ({ ...current, auto }))} />
      <WalkSwitch label={t("umrahGuideVoice")} hint={t("umrahWalkVoiceHint")}
        checked={choices.voice} disabled={saving} onChange={voice => setEdits(current => ({ ...current, voice }))} />
      <WalkSwitch label={t("umrahWalkMemory")} hint={t("umrahWalkMemoryHint")} checked={choices.gps && choices.remember}
        disabled={saving || !choices.gps} onChange={remember => setEdits(current => ({ ...current, remember }))} />
    </div>
    <section className="card tint umrah-walk-privacy">
      <h2 className="with-icon"><DesignIcon name="umrah-walk-info" size={16} />{t("umrahWalkPrivacy")}</h2>
      <p className="small muted">{t("umrahWalkPrivacyHint")}</p>
    </section>
    {choices.gps && locationError && <p className="small muted" role="status">{t(locationError)}</p>}
    <footer className="equal-row umrah-walk-actions">
      <Link className="action light" to={back} replace>{t(configured ? "umrahSaiCancel" : "umrahWalkNotNow")}</Link>
      <button className="action" type="submit" disabled={saving}>{t(configured || (!choices.gps && !choices.voice) ? "umrahWalkSave" : "umrahWalkTurnOn")}</button>
    </footer>
  </form>;
}
