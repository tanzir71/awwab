import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Bell, BookOpen, Calendar, Compass, Download, Share2, Sparkles } from "lucide-react";
import AppInstallPrompt from "@/components/AppInstallPrompt";
import MosqueProgress from "@/components/MosqueProgress";
import { ListLink, SectionNav } from "@/components/Surface";
import { usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { backup, prayerStatistics, restoreBackup, updateSettings, type Settings } from "@/lib/storageService";
import { cities, methodNames, type City, type PrayerMethod } from "@/lib/prayerServices";
import { dateKey } from "@/lib/dates";
import { downloadFile } from "@/lib/download";
import { prayerReminders, saveCalendar, eventReminders } from "@/lib/calendarFile";
import { calendarDefaults } from "@/lib/hijri";
import { message as copy } from "@/lib/copy";

export function You({ settings, now }: { settings: Settings; now: Date }) {
  const t = copy.bind(null, settings);
  const logs = usePrayerLogs();
  const day = dateKey(now, settings.city.timeZone);
  const stats = prayerStatistics(logs, day);
  return <div className="stack">
    <header><p className="caption">{t("you")}</p><h1>{stats.activeDays ? "Your masjid is growing" : "Build your masjid"}</h1></header>
    <MosqueProgress consistency={stats.consistency} dimmed={stats.activeDays > 0 && !stats.recent[28]?.count} />
    <div className="equal-row">
      <div className="card"><h2>{stats.consistency}%</h2><small className="muted">prayed this month</small></div>
      <div className="card"><h2>{stats.returns}</h2><small className="muted">times you came back</small></div>
      <div className="card"><h2>{stats.activeDays}</h2><small className="muted">days you prayed</small></div>
    </div>
    <section className="card"><div className="row-between"><strong>Last 30 days</strong><small className="muted">prayers per day</small></div>
      <div className="heat-strip" role="list" aria-label="Prayers by day">
        {stats.recent.map(({ day, count }) => <span role="listitem" aria-label={`${day}: ${count} prayers`} title={`${day}: ${count} prayers`} key={day}
          data-active={count > 0} style={{ "--fade": `${(5 - count) * 17}%` } as React.CSSProperties} />)}
      </div>
    </section>
    <section className="compact-stack">
      <h2>{t("settings")}</h2>
      <ListLink to="/you/learning" icon={<Sparkles size={22} />} title={t("learningMode")} detail={t(settings.mode === "maktab" ? "maktabMode" : "adultModeDetail")} />
      <ListLink to="/you/learning#script" icon={<BookOpen size={22} />} title={t("script")} detail={settings.script === "indopak" ? "IndoPak · like the Bangla Ampara" : "Uthmani · Madani mushaf"} />
      <ListLink to="/you/prayer" icon={<Compass size={22} />} title={t("prayerTimes")} detail={`${settings.city.name} · ${methodNames[settings.method]}`} />
      <ListLink to="/you/hijri" icon={<Calendar size={22} />} title="Hijri date" detail={`Umm al-Qura · ${settings.hijriAdjust} day adjustment`} />
      <ListLink to="/you/reminders" icon={<Bell size={22} />} title={t("reminders")} detail="Add prayer times to your calendar" />
      <ListLink to="/you/audio" icon={<Download size={22} />} title={t("offlineAudio")} detail={t("chooseRecitations")} />
      <ListLink to="/you/data" icon={<Download size={22} />} title="Your data" detail="Export or restore an on-device backup" />
    </section>
    <ListLink to="/share" icon={<Share2 size={22} />} title="Share progress" detail="Make a card to save or share" />
    <ListLink to="/sources" icon={<BookOpen size={22} />} title="Sources and licences" />
    <AppInstallPrompt />
  </div>;
}

export function SettingsPage({ settings, now, panel }: { settings: Settings; now: Date; panel: string }) {
  const t = copy.bind(null, settings);
  const title = ({ learning: t("learningSettings"), prayer: t("prayerTimes"), hijri: "Hijri date", reminders: t("reminders"), data: "Your data" })[panel];
  const [message, setMessage] = useState("");
  const calendar = useRecord("calendar", calendarDefaults);
  const [file, setFile] = useState<File>();
  async function save(patch: Partial<Settings>) {
    try {
      await updateSettings(patch);
      if (patch.hijriAdjust !== undefined) {
        const updated = { ...settings, ...patch };
        const day = dateKey(now, settings.city.timeZone);
        saveCalendar([...prayerReminders(day, updated, 30, 5), ...eventReminders(day, updated, calendar)]);
        setMessage("Saved. Open the new calendar file to update your reminders.");
      } else setMessage(copy({ ...settings, ...patch }, "savedOnDevice"));
    }
    catch { setMessage(t("saveError")); }
  }

  if (!title) return <Link to="/you">Go to settings</Link>;
  return <div className="stack">
    <SectionNav title={title} back="/you" />
    {panel === "learning" && <section className="card stack" id="script">
      <label className="field">{t("learningMode")}
        <select value={settings.mode} onChange={event => {
          const mode = event.target.value as Settings["mode"];
          void save({ mode, spellStyle: mode === "maktab" ? "ampara-bn" : "en" });
        }}><option value="adult">{t("adultMode")}</option><option value="maktab">{t("maktabMode")}</option></select>
      </label>
      <label className="field">{t("quranScript")}
        <select value={settings.script} onChange={event => void save({ script: event.target.value as Settings["script"] })}>
          <option value="indopak">IndoPak</option><option value="uthmani">Uthmani</option>
        </select>
      </label>
      <label className="field">{t("spellingStyle")}
        <select value={settings.spellStyle} onChange={event => void save({ spellStyle: event.target.value as Settings["spellStyle"] })}>
          <option value="en" lang="en">English</option><option value="ampara-bn">{t("banglaAmpara")}</option>
        </select>
      </label>
      <label className="field">{t("interfaceLanguage")}
        <select aria-label={t("interfaceLanguage")} value={settings.language} onChange={event => void save({ language: event.target.value as Settings["language"] })}>
          <option value="en" lang="en">English</option><option value="bn" lang="bn">{t("banglaPreview")}</option>
        </select>
      </label>
    </section>}
    {panel === "prayer" && <CityForm initial={settings} save={save} />}
    {panel === "hijri" && <section className="card stack">
      <label className="field">Global day adjustment
        <select value={settings.hijriAdjust} onChange={event => void save({ hijriAdjust: Number(event.target.value) })}>
          {[-2, -1, 0, 1, 2].map(value => <option key={value} value={value}>{value > 0 ? "+" : ""}{value}</option>)}
        </select>
      </label>
      <p className="muted">The adjustment applies to Umm al-Qura estimates until a confirmed month start supplies an anchor.</p>
    </section>}
    {panel === "reminders" && <form className="card stack" onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const day = dateKey(now, settings.city.timeZone);
      const events = form.has("events") ? eventReminders(day, settings, calendar) : [];
      saveCalendar([...prayerReminders(day, settings, Number(form.get("days")), Number(form.get("alarm"))), ...events]);
      setMessage("Calendar file prepared. Open it in your calendar to add the reminders.");
    }}>
      <label className="field">Days to include<select name="days"><option value="7">One week</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
      <label className="field">Reminder before prayer<select name="alarm"><option value="0">At the start</option><option value="5">5 minutes</option><option value="15">15 minutes</option></select></label>
      <label className="with-icon"><input type="checkbox" name="events" /> Include Islamic events</label>
      <button className="action"><Download size={18} /> Export calendar file</button>
    </form>}
    {panel === "data" && <section className="card stack">
      <p>Prayer logs, learning progress and settings are stored on this device.</p>
      <button className="action" onClick={async () => {
        try { downloadFile(new Blob([await backup()], { type: "application/json" }), `awwab-${dateKey(now)}.json`); }
        catch { setMessage("The backup could not be exported. Try again."); }
      }}>Export backup</button>
      <label className="field">Choose an Awwab backup<input type="file" accept=".json,application/json" onChange={event => setFile(event.target.files?.[0])} /></label>
      <p className="muted">Restoring replaces the records on this device with the records in the file.</p>
      <button className="action soft" disabled={!file} onClick={async () => {
        if (!file) return;
        try { await restoreBackup(await file.text()); setMessage("Backup restored."); setFile(undefined); }
        catch { setMessage("That file could not be restored. Choose a valid Awwab backup."); }
      }}>Restore selected backup</button>
    </section>}
    {message && <p className="card soft" role="status">{message}</p>}
  </div>;
}

function CityForm({ initial, save }: { initial: Settings; save: (patch: Partial<Settings>) => Promise<void> }) {
  const [preset, setPreset] = useState(cities.some(item => item.name === initial.city.name && item.latitude === initial.city.latitude) ? initial.city.name : "");
  const [city, setCity] = useState(initial.city);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      dateKey(new Date(), city.timeZone);
      setError("");
      void save({ city: { ...city, name: city.name.trim() }, method: data.get("method") as PrayerMethod, school: data.get("school") as Settings["school"] });
    } catch {
      setError("Enter a time zone such as Asia/Dhaka or Europe/London.");
    }
  }
  const patch = (values: Partial<City>) => setCity(current => ({ ...current, ...values }));
  return <form className="card stack" onSubmit={submit}>
    <label className="field">City
      <select value={preset} onChange={event => {
        setPreset(event.target.value);
        const selected = cities.find(item => item.name === event.target.value);
        if (selected) setCity(selected);
      }}>
        {cities.map(item => <option key={item.name}>{item.name}</option>)}<option value="">Enter coordinates manually</option>
      </select>
    </label>
    {!preset && <>
      <label className="field">City name<input value={city.name} required maxLength={100} onChange={event => patch({ name: event.target.value })} /></label>
      <div className="equal-row">
        <label className="field">Latitude<input type="number" step="any" min="-90" max="90" required value={Number.isFinite(city.latitude) ? city.latitude : ""} onChange={event => patch({ latitude: event.target.valueAsNumber })} /></label>
        <label className="field">Longitude<input type="number" step="any" min="-180" max="180" required value={Number.isFinite(city.longitude) ? city.longitude : ""} onChange={event => patch({ longitude: event.target.valueAsNumber })} /></label>
      </div>
      <label className="field">Time zone<input value={city.timeZone} required onChange={event => patch({ timeZone: event.target.value.trim() })} /></label>
    </>}
    <label className="field">Calculation method<select name="method" defaultValue={initial.method}>{Object.entries(methodNames).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
    <label className="field">Asr calculation<select name="school" defaultValue={initial.school}>
      <option value="hanafi">Hanafi</option><option value="shafi">Shafiʿi, Maliki and Hanbali</option>
    </select></label>
    {error && <p role="alert">{error}</p>}
    <button className="action">Save prayer settings</button>
    <p className="muted small">Times use the selected city and stay on your device. Local mosque timetables can differ.</p>
  </form>;
}
