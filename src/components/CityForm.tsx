import { useState, type FormEvent } from "react";
import { cities, methodNames, type City, type PrayerMethod } from "@/lib/prayerServices";
import { dateKey } from "@/lib/dates";
import { useCopy } from "@/lib/copy";
import { readCoordinatePair } from "@/lib/localeNumbers";
import { guideReference } from "@/lib/prayerGuide";
import { prayerCityLabel } from "@/lib/settings-copy";
import type { Settings } from "@/lib/storageService";
import { CoordinateInput } from "./CoordinateInput";

export function CityForm({ initial, save, submitLabel = "settingsPrayerSave", saving = false, suggestion, onBack }: {
  initial: Settings; save: (patch: Partial<Settings>) => Promise<void>; submitLabel?: string; saving?: boolean;
  suggestion?: Pick<Settings, "method" | "school">; onBack?: () => void;
}) {
  const { t, locale } = useCopy();
  const [preset, setPreset] = useState(() => cities.find(item => item.name === initial.city.name && item.latitude === initial.city.latitude
    && item.longitude === initial.city.longitude && item.timeZone === initial.city.timeZone)?.name ?? "");
  const [city, setCity] = useState(initial.city);
  const [method, setMethod] = useState(initial.method);
  const [school, setSchool] = useState(initial.school);
  const [error, setError] = useState("");
  const usesSuggestion = Boolean(suggestion && suggestion.method === method && suggestion.school === school);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const coordinates = preset ? { lat: city.latitude, lon: city.longitude }
      : readCoordinatePair(String(data.get("lat") ?? ""), String(data.get("lon") ?? ""), locale);
    if (!coordinates) return;
    try {
      if (!city.name.trim()) { setError(t("setupCityNameMissing")); return; }
      dateKey(new Date(), city.timeZone);
      setError("");
      void save({ city: { ...city, name: city.name.trim(), latitude: coordinates.lat, longitude: coordinates.lon }, method, school,
        prayerGuide: data.get("prayerGuide") === "hanafi" ? "hanafi" : "fard" });
    } catch {
      setError(t("settingsTimeZoneError"));
    }
  }
  const patch = (values: Partial<City>) => setCity(current => ({ ...current, ...values }));
  const submitButton = <button className="action" disabled={saving}>{t(submitLabel)}</button>;
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
        <label className="field">{t("settingsLatitude")}<CoordinateInput name="lat" value={city.latitude} required /></label>
        <label className="field">{t("settingsLongitude")}<CoordinateInput name="lon" value={city.longitude} required /></label>
      </div>
      <label className="field">{t("settingsTimeZone")}<input value={city.timeZone} required onChange={event => patch({ timeZone: event.target.value.trim() })} /></label>
    </>}
    {suggestion && <section className="card compact-stack onboarding-prayer-suggestion" aria-labelledby="onboarding-prayer-suggestion">
      <h2 id="onboarding-prayer-suggestion">{t("setupPrayerSuggestion")}</h2>
      <p className="small">{t("setupPrayerSuggestionPair", { method: t(`settingsMethod${suggestion.method}`),
        school: t(suggestion.school === "hanafi" ? "prayerGuideHanafi" : "settingsCalcSchoolOther") })}</p>
      <button className="text-button" type="button" disabled={saving} aria-disabled={usesSuggestion} onClick={() => {
        if (usesSuggestion) return;
        setMethod(suggestion.method);
        setSchool(suggestion.school);
      }}>{t(usesSuggestion ? "setupPrayerSuggestionSelected" : "setupUsePrayerSuggestion")}</button>
    </section>}
    <label className="field">{t("settingsCalcMethod")}<select name="method" value={method} onChange={event => setMethod(event.target.value as PrayerMethod)}>
      {Object.keys(methodNames).map(id => <option value={id} key={id}>{t(`settingsMethod${id}`)}</option>)}
    </select></label>
    <label className="field">{t("settingsAsrCalc")}<select name="school" value={school} onChange={event => setSchool(event.target.value as Settings["school"])}>
      <option value="hanafi">{t("prayerGuideHanafi")}</option><option value="shafi">{t("settingsCalcSchoolOther")}</option>
    </select></label>
    <label className="field">{t("prayerGuidePreference")}
      <select name="prayerGuide" defaultValue={guideReference(initial)} aria-describedby="prayer-guide-preference-note">
        <option value="hanafi">{t("prayerGuideHanafi")}</option><option value="fard">{t("prayerGuideFard")}</option>
      </select>
    </label>
    <p id="prayer-guide-preference-note" className="small muted">{t("prayerGuidePreferenceNote")}</p>
    {error && <p role="alert">{error}</p>}
    {onBack ? <div className="equal-row">
      <button className="action light" type="button" disabled={saving} onClick={onBack}>{t("back")}</button>
      {submitButton}
    </div> : submitButton}
    <p className="muted small">{t("settingsPrayerLocal")}</p>
  </form>;
}
