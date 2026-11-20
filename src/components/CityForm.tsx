import { useState, type FormEvent } from "react";
import { cities, methodNames, type City, type PrayerMethod } from "@/lib/prayerServices";
import { dateKey } from "@/lib/dates";
import { useCopy } from "@/lib/copy";
import { guideReference } from "@/lib/prayerGuide";
import { prayerCityLabel } from "@/lib/settings-copy";
import type { Settings } from "@/lib/storageService";

export function CityForm({ initial, save, submitLabel = "settingsPrayerSave", saving = false }: { initial: Settings; save: (patch: Partial<Settings>) => Promise<void>; submitLabel?: string; saving?: boolean }) {
  const { t } = useCopy();
  const [preset, setPreset] = useState(cities.some(item => item.name === initial.city.name && item.latitude === initial.city.latitude) ? initial.city.name : "");
  const [city, setCity] = useState(initial.city);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      if (!city.name.trim()) { setError(t("setupCityNameMissing")); return; }
      dateKey(new Date(), city.timeZone);
      setError("");
      void save({ city: { ...city, name: city.name.trim() }, method: data.get("method") as PrayerMethod,
        school: data.get("school") as Settings["school"], prayerGuide: data.get("prayerGuide") === "hanafi" ? "hanafi" : "fard" });
    } catch {
      setError(t("settingsTimeZoneError"));
    }
  }
  const patch = (values: Partial<City>) => setCity(current => ({ ...current, ...values }));
  return <form className="card stack" onSubmit={submit}>
    <label className="field">{t("settingsCity")}
      <select value={preset} onChange={event => {
        setPreset(event.target.value);
        const selected = cities.find(item => item.name === event.target.value);
        if (selected) setCity(selected);
      }}>
        {cities.map(item => <option key={item.name} value={item.name}>{prayerCityLabel(item, t)}</option>)}<option value="">{t("settingsCityManual")}</option>
      </select>
    </label>
    {!preset && <>
      <label className="field">{t("settingsCityName")}<input value={city.name} required maxLength={100} onChange={event => patch({ name: event.target.value })} /></label>
      <div className="equal-row">
        <label className="field">{t("settingsLatitude")}<input type="number" step="any" min="-90" max="90" required value={Number.isFinite(city.latitude) ? city.latitude : ""} onChange={event => patch({ latitude: event.target.valueAsNumber })} /></label>
        <label className="field">{t("settingsLongitude")}<input type="number" step="any" min="-180" max="180" required value={Number.isFinite(city.longitude) ? city.longitude : ""} onChange={event => patch({ longitude: event.target.valueAsNumber })} /></label>
      </div>
      <label className="field">{t("settingsTimeZone")}<input value={city.timeZone} required onChange={event => patch({ timeZone: event.target.value.trim() })} /></label>
    </>}
    <label className="field">{t("settingsCalcMethod")}<select name="method" defaultValue={initial.method}>
      {Object.keys(methodNames).map(id => <option value={id} key={id}>{t(`settingsMethod${id}`)}</option>)}
    </select></label>
    <label className="field">{t("settingsAsrCalc")}<select name="school" defaultValue={initial.school}>
      <option value="hanafi">{t("prayerGuideHanafi")}</option><option value="shafi">{t("settingsCalcSchoolOther")}</option>
    </select></label>
    <label className="field">{t("prayerGuidePreference")}
      <select name="prayerGuide" defaultValue={guideReference(initial)} aria-describedby="prayer-guide-preference-note">
        <option value="hanafi">{t("prayerGuideHanafi")}</option><option value="fard">{t("prayerGuideFard")}</option>
      </select>
    </label>
    <p id="prayer-guide-preference-note" className="small muted">{t("prayerGuidePreferenceNote")}</p>
    {error && <p role="alert">{error}</p>}
    <button className="action" disabled={saving}>{t(submitLabel)}</button>
    <p className="muted small">{t("settingsPrayerLocal")}</p>
  </form>;
}
