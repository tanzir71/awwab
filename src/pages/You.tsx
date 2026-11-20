import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bell, BookOpen, Calendar, Compass, Download, Languages, Share2, Sparkles } from "lucide-react";
import AppInstallPrompt from "@/components/AppInstallPrompt";
import { CityForm } from "@/components/CityForm";
import MosqueProgress from "@/components/MosqueProgress";
import { ListLink, SectionNav } from "@/components/Surface";
import { usePrayerLogs, useRecord } from "@/hooks/use-awwab";
import { backup, defaults, getRecord, prayerStatistics, restoreBackup, updateSettings, type Settings } from "@/lib/storageService";
import { prayerCityLabel } from "@/lib/settings-copy";
import { dateKey } from "@/lib/dates";
import { downloadFile } from "@/lib/download";
import { prayerReminders, saveCalendar, eventReminders } from "@/lib/calendarFile";
import { calendarDefaults } from "@/lib/hijri";
import { message as copy, useCopy } from "@/lib/copy";
import { prayerGuidePath } from "@/lib/prayerGuide";
import { languages, textSizes } from "@/lib/languagePreferences";
import { countKnownQuranWords } from "@/lib/quran";

const emptyWords: string[] = [];

function Profile({ settings, now, desktop = false }: { settings: Settings; now: Date; desktop?: boolean }) {
  const { locale, t } = useCopy();
  const logs = usePrayerLogs();
  const knownVerses = useRecord("words-known", emptyWords);
  const vocabulary = useRecord("word-bank-known", emptyWords);
  const day = dateKey(now, settings.city.timeZone);
  const stats = prayerStatistics(logs, day);
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent" });
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, { dateStyle: "medium", calendar: "gregory", timeZone: "UTC" });
  return <section className="stack settings-profile-stats">
    <header><p className="caption">{t("you")}</p>{desktop ? <h2>{t(stats.activeDays ? "profileGrowing" : "profileBuild")}</h2>
      : <h1>{t(stats.activeDays ? "profileGrowing" : "profileBuild")}</h1>}</header>
    <MosqueProgress consistency={stats.consistency} dimmed={stats.activeDays > 0 && !stats.recent.at(-2)?.count} />
    <div className="equal-row">
      <div className="card"><strong>{percent.format(stats.consistency / 100)}</strong><small className="muted">{t("profilePrayedMonth")}</small></div>
      <div className="card"><strong>{number.format(stats.returns)}</strong><small className="muted">{t("profileReturns")}</small></div>
      <div className="card"><strong>{number.format(countKnownQuranWords(knownVerses, vocabulary))}</strong><small className="muted">{t("quranWordsKnown")}</small></div>
    </div>
    <section className="card"><div className="row-between"><strong>{t("profileLastMonth")}</strong><small className="muted">{t("profilePrayersPerDay")}</small></div>
      <div className="heat-strip" role="list" aria-label={t("profilePrayersByDay")}>
        {stats.recent.map(({ day, count }) => {
          const label = t("profilePrayersOnDay", { day: date.format(new Date(day + "T12:00:00Z")), count });
          return <span role="listitem" aria-label={label} title={label} key={day}
            data-active={count > 0} style={{ "--fade": `${(5 - count) * 17}%` } as React.CSSProperties} />;
        })}
      </div>
    </section>
  </section>;
}
export function You({ settings, now, desktop }: { settings: Settings; now: Date; desktop: boolean }) {
  const { t } = useCopy();
  if (desktop) return <div className="settings-profile-workspace">
    <SettingsPage settings={settings} now={now} panel="learning" desktop />
    <Profile settings={settings} now={now} desktop />
  </div>;
  return <div className="stack">
    <Profile settings={settings} now={now} />
    <section className="compact-stack">
      <h2>{t("settings")}</h2>
      <ListLink to="/you/learning" icon={<Sparkles size={22} />} title={t("learningMode")} detail={t(settings.mode === "maktab" ? "maktabMode" : "adultModeDetail")} />
      <ListLink to="/you/learning#script" icon={<BookOpen size={22} />} title={t("script")} detail={t(settings.script === "indopak" ? "profileIndopak" : "profileUthmani")} />
      <ListLink to="/you/language" icon={<Languages size={22} />} title={t("settingsLanguage")} />
      <ListLink to="/you/prayer" icon={<Compass size={22} />} title={t("prayerTimes")} detail={t("profilePrayerContext", {
        asr: t(settings.school === "hanafi" ? "profileHanafiAsr" : "profileStandardAsr"),
        method: t(`settingsMethod${settings.method}`), city: prayerCityLabel(settings.city, t),
      })} />
      <ListLink to="/you/hijri" icon={<Calendar size={22} />} title={t("settingsHijri")} detail={t("profileHijriOffset", { count: settings.hijriAdjust })} />
      <ListLink to="/you/reminders" icon={<Bell size={22} />} title={t("reminders")} detail={t("profileRemindersHint")} />
      <ListLink to="/you/audio" icon={<Download size={22} />} title={t("offlineAudio")} detail={t("chooseRecitations")} />
      <ListLink to="/you/data" icon={<Download size={22} />} title={t("settingsBackup")} detail={t("profileBackupHint")} />
      <ListLink to="/you/display" icon={<BookOpen size={22} />} title={t("settingsDisplay")} />
      <ListLink to="/you/privacy" icon={<BookOpen size={22} />} title={t("settingsPrivacy")} />
      <ListLink to="/you/about" icon={<BookOpen size={22} />} title={t("settingsAbout")} />
    </section>
    <ListLink to="/share" icon={<Share2 size={22} />} title={t("returnShare")} detail={t("profileShareHint")} />
    <ListLink to="/sources" icon={<BookOpen size={22} />} title={t("settingsSources")} />
    <AppInstallPrompt />
  </div>;
}

export function SettingsPage({ settings, now, panel, desktop }: { settings: Settings; now: Date; panel: string; desktop: boolean }) {
  const { locale, t } = useCopy();
  const language = languages.find(item => item.code === settings.language);
  const title = ({ learning: t(desktop ? "settingsProfile" : "learningSettings"), prayer: t(desktop ? "settingsPrayer" : "prayerTimes"), hijri: t("settingsHijri"),
    reminders: t(desktop ? "settingsReminders" : "reminders"), data: t("settingsBackup"), display: t("settingsDisplay"), privacy: t("settingsPrivacy"), about: t("settingsAbout") })[panel];
  const [search] = useSearchParams();
  const prayerBack = panel === "prayer" && prayerGuidePath(search.get("fromPrayer"), search.get("fromRakah"));
  const number = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" });
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
        setMessage(t("settingsHijriSaved"));
      } else setMessage(copy({ ...settings, ...patch }, "savedOnDevice"));
    }
    catch { setMessage(t("saveError")); }
  }

  if (!title) return <Link to="/you">{t("settings")}</Link>;
  return <div className="stack settings-active-panel">
    {desktop && !prayerBack ? <h2 className="settings-panel-heading">{title}</h2> : <SectionNav title={title} back={prayerBack || "/you"} />}
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
      {!desktop && <Link className="list-row" to="/you/language/picker">
        <span>{t("interfaceLanguage")}</span><bdi lang={language?.code} dir={language?.dir === "rtl" ? "rtl" : "ltr"}>{language?.native}</bdi>
      </Link>}
    </section>}
    {panel === "prayer" && <><CityForm initial={settings} save={save} />
      <Link className="list-row" to="/you/hijri">{t("settingsHijri")}</Link>
    </>}
    {panel === "hijri" && <section className="card stack">
      <label className="field">{t("settingsHijriAdjust")}
        <select value={settings.hijriAdjust} onChange={event => void save({ hijriAdjust: Number(event.target.value) })}>
          {[-2, -1, 0, 1, 2].map(value => <option key={value} value={value}>{number.format(value)}</option>)}
        </select>
      </label>
      <p className="muted">{t("settingsHijriNote")}</p>
    </section>}
    {panel === "reminders" && <form className="card stack" onSubmit={event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const day = dateKey(now, settings.city.timeZone);
      const events = form.has("events") ? eventReminders(day, settings, calendar) : [];
      saveCalendar([...prayerReminders(day, settings, Number(form.get("days")), Number(form.get("alarm"))), ...events]);
      setMessage(t("settingsCalendarSaved"));
    }}>
      <label className="field">{t("settingsCalendarDays")}<select name="days"><option value="7">{t("settingsCalendar7")}</option>
        {[30, 90].map(count => <option value={count} key={count}>{t("settingsCalendarDaysCount", { count })}</option>)}</select></label>
      <label className="field">{t("settingsCalendarAlert")}<select name="alarm"><option value="0">{t("settingsCalendarStart")}</option>
        {[5, 15].map(count => <option value={count} key={count}>{t("settingsCalendarMinutes", { count })}</option>)}</select></label>
      <label className="with-icon"><input type="checkbox" name="events" />{t("settingsCalendarEvents")}</label>
      <button className="action"><Download size={18} />{t("settingsCalendarExport")}</button>
    </form>}
    {panel === "data" && <section className="card stack">
      <p>{t("settingsDataNote")}</p>
      <button className="action" onClick={async () => {
        try { downloadFile(new Blob([await backup()], { type: "application/json" }), `awwab-${dateKey(now)}.json`); }
        catch { setMessage(t("settingsDataExportError")); }
      }}>{t("settingsDataExport")}</button>
      <label className="field">{t("settingsDataPick")}<input type="file" accept=".json,application/json" onChange={event => setFile(event.target.files?.[0])} /></label>
      <p className="muted">{t("settingsDataRestoreNote")}</p>
      <button className="action soft" disabled={!file} onClick={async () => {
        if (!file) return;
        try {
          await restoreBackup(await file.text());
          setMessage(copy(await getRecord("settings", defaults), "settingsDataRestored"));
          setFile(undefined);
        }
        catch { setMessage(t("settingsDataRestoreError")); }
      }}>{t("settingsDataRestore")}</button>
    </section>}
    {panel === "display" && <section className="card stack">
      <label className="field">{t("settingsTextSize")}<select value={settings.textSize ?? "default"} onChange={event => void save({ textSize: event.target.value as Settings["textSize"] })}>
        {textSizes.map(value => <option key={value} value={value}>{t(value === "large" ? "settingsTextLarge" : "settingsTextDefault")}</option>)}
      </select></label>
      <p className="settings-text-sample">{t("settingsTextSample")}</p>
      <Link className="list-row" to="/you/audio">{t("offlineAudio")}</Link>
    </section>}
    {panel === "privacy" && <section className="card stack"><p>{t("settingsPrivacyDetails")}</p><p>{t("settingsPrivacyLocation")}</p>
      <Link className="text-button" to="/you/data">{t("settingsBackup")}</Link></section>}
    {panel === "about" && <><section className="card stack"><p>{t("settingsAboutDetails")}</p>
      <a className="text-button" href="https://github.com/tanzir71/awwab">{t("settingsAboutProject")}</a></section><AppInstallPrompt /></>}
    {message && <p className="card soft" role="status">{message}</p>}
  </div>;
}
