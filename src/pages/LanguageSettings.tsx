import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { DesignIcon } from "@/components/DesignIcon";
import { SectionNav } from "@/components/Surface";
import { WordingSuggestionCard } from "@/components/WordingSuggestions";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDesktop } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { glossaryOptions, glossaryValue, isBuiltIn, languages, languageMatches, salahVariants, suggestedLanguage,
  type AppLanguage, type GlossaryTerm, type LanguageItem } from "@/lib/languagePreferences";
import { updateSettings, updateWordChoice, type Settings } from "@/lib/storageService";

const quickLanguages = languages.filter(item => item.tier === 1 || item.code === "hi");

function languageState(code: string) {
  return code === "en" ? "settingsLanguageBuiltIn" : code === "bn" ? "settingsLanguagePreview" : "settingsLanguagePlanned";
}

function LanguageName({ item }: { item: LanguageItem }) {
  const { t } = useCopy();
  return <strong className="settings-language-name" data-script={item.script}>
    <bdi lang={item.code} dir={item.dir === "rtl" ? "rtl" : "ltr"}>{item.native}</bdi>
    {item.dir === "rtl" && <span lang="en" dir="ltr" title={t("settingsLanguageRTL")} className="chip settings-rtl">RTL</span>}
  </strong>;
}

async function selectLanguage(code: AppLanguage, onSaved: () => void, onError: () => void) {
  try { await updateSettings({ language: code }); onSaved(); }
  catch { onError(); }
}

export function LanguagePicker({ settings }: { settings: Settings }) {
  const { t } = useCopy();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const suggestion = suggestedLanguage(navigator.languages);
  const choices = languages.filter(item => languageMatches(item, query));
  const showSuggestion = suggestion && isBuiltIn(suggestion.code) && !query.trim();
  async function change(code: AppLanguage) {
    if (busy) return;
    setBusy(true);
    try { await selectLanguage(code, () => navigate("/you/language", { replace: true }), () => toast.error(t("saveError"))); }
    finally { setBusy(false); }
  }
  function row(item: LanguageItem) {
    const active = settings.language === item.code;
    const content = <><span><LanguageName item={item} /><small>{item.english === item.native ? t(languageState(item.code)) : `${item.english} · ${t(languageState(item.code))}`}</small></span>
      {active && <Check size={18} aria-hidden="true" />}</>;
    return <li key={item.code} className="settings-language-row">
      {isBuiltIn(item.code) ? <button type="button" aria-pressed={active} disabled={busy} onClick={() => void change(item.code as AppLanguage)}>{content}</button>
        : <div>{content}</div>}
    </li>;
  }
  return <div className="settings-language-picker stack">
    <SectionNav title={t("settingsLanguageTitle")} back="/you/language" />
    <p className="muted small">{t("settingsLanguageGuide")}</p>
    <label className="settings-language-search"><DesignIcon name="desk-eye" size={17} />
      <input type="search" value={query} onChange={event => setQuery(event.target.value)}
        aria-label={t("settingsLanguageSearch", { count: languages.length })} placeholder={t("settingsLanguageSearch", { count: languages.length })} />
    </label>
    {showSuggestion && <button className="card settings-language-suggestion" type="button" aria-pressed={settings.language === suggestion.code} disabled={busy}
      onClick={() => void change(suggestion.code as AppLanguage)}>
      <span><span className="caption">{t("settingsPhoneSuggestion")}</span><LanguageName item={suggestion} />
        <small className="muted">{suggestion.english} · {t(languageState(suggestion.code))}</small></span>
      {settings.language === suggestion.code && <span className="settings-language-check"><Check aria-hidden="true" size={18} /></span>}
    </button>}
    {!choices.length && <p className="card" role="status">{t("settingsLanguageNoResults")}</p>}
    {[true, false].map(most => {
      const group = choices.filter(item => (item.tier === 1) === most && (!showSuggestion || item.code !== suggestion.code));
      return group.length ? <section key={String(most)} className="stack settings-picker-group">
        <h2 className="caption">{t(most ? "settingsMostLanguages" : "settingsMoreLanguages")}</h2>
        <ul role="list" className="card">{group.map(row)}</ul>
      </section> : null;
    })}
  </div>;
}

function AppLanguageCard({ settings }: { settings: Settings }) {
  const { t } = useCopy();
  const active = languages.find(item => item.code === settings.language);
  return <section className="card settings-app-language">
    <header className="row-between"><h2>{t("settingsAppLanguage")}</h2>
      <Link className="text-button" to="/you/language/picker">{t("settingsLanguageCount", { count: languages.length })}</Link>
    </header>
    <div className="settings-active-language row-between">
      <LanguageName item={active} /><small className="muted">{active.english} · {t(languageState(active.code))}</small>
      <Link className="chip" to="/you/language/picker">{t("settingsChangeLanguage")}</Link>
    </div>
    <div className="settings-language-tiles">
      {quickLanguages.filter(item => item.code !== settings.language).map(item => {
        const code = item.code;
        const label = <><LanguageName item={item} /><small>{item.english}</small></>;
        return isBuiltIn(code) ? <button type="button" className="settings-language-tile" key={code}
          onClick={() => void selectLanguage(code, () => undefined, () => toast.error(t("saveError")))}>{label}</button>
          : <div className="settings-language-tile" key={code} title={t(languageState(code))}>{label}<span className="sr-only">{t(languageState(code))}</span></div>;
      })}
    </div>
  </section>;
}

function ReadingToggle({ title, hint, enabled, disabled = false, onToggle }: {
  title: string; hint: string; enabled: boolean; disabled?: boolean; onToggle: (next: boolean) => void;
}) {
  return <button type="button" className="settings-reading-toggle" role="switch" aria-checked={enabled} aria-label={title}
    disabled={disabled} onClick={() => onToggle(!enabled)}>
    <span><strong>{title}</strong><small className="muted">{hint}</small></span><span className="settings-toggle-track" aria-hidden="true" />
  </button>;
}

function ReadingHelp({ settings }: { settings: Settings }) {
  const { t } = useCopy();
  const bangla = settings.language === "bn";
  function save(patch: Partial<Settings>) {
    void updateSettings(patch).catch(() => toast.error(t("saveError")));
  }
  return <section className="card settings-reading-help">
    <h2>{t("settingsReadingHelp")}</h2>
    <ReadingToggle title={t("settingsMeaningLocal")} hint={t(bangla ? "settingsMeaningLocalPending" : "settingsMeaningLocalEnglish")}
      enabled={!bangla && settings.quranMeanings !== false} disabled={bangla} onToggle={quranMeanings => save({ quranMeanings })} />
    <ReadingToggle title={t("settingsMeaningEnglish")} hint={t("settingsMeaningEnglishHint")}
      enabled={settings.englishMeaning ?? bangla} onToggle={englishMeaning => save({ englishMeaning })} />
    {bangla && <ReadingToggle title={t("settingsNativeDigits")} hint={t("settingsNativeDigitsHint")}
      enabled={settings.nativeDigits !== false} onToggle={nativeDigits => save({ nativeDigits })} />}
  </section>;
}

const deskTerms = ["salah", "wudu", "tawbah", "ramadan"] as const;
const allTerms = ["salah", "wudu", "fajr", "qada", "tawbah", "ramadan", "dhuhr", "asr", "maghrib", "isha", "eid", "sunnah", "fard", "witr"] as const;
const termLabels: Partial<Record<GlossaryTerm, string>> = {
  salah: "settingsTermSalah", wudu: "settingsTermWudu", qada: "settingsTermQada", tawbah: "settingsTermTawbah", ramadan: "settingsTermRamadan",
};

function YourWords({ settings, compact = false }: { settings: Settings; compact?: boolean }) {
  const { language, t } = useCopy();
  function save(term?: GlossaryTerm, value?: string) {
    void updateWordChoice(language, term, value).catch(() => toast.error(t("saveError")));
  }
  return <section className="card settings-words-card">
    <header className="row-between"><h2>{compact ? <Link className="settings-words-open" to="/you/words">{t("settingsYourWords")}</Link> : t("settingsYourWords")}</h2>
      <button type="button" className="text-button" onClick={() => save()} disabled={!settings.wordChoices?.[language]}>{t("settingsTermReset")}</button>
    </header>
    <p className="small muted">{t("settingsYourWordsHint")}</p>
    <div className="settings-word-rows">
      {(compact ? deskTerms : allTerms).map(term => {
        const label = termLabels[term] ? t(termLabels[term]) : glossaryOptions("en", term)[0];
        const choices = glossaryOptions(language, term);
        const selected = glossaryValue(language, term, settings.wordChoices);
        return <div key={term} className="settings-word-row" role="group" aria-label={label}>
          <span>{label}</span><div className="settings-word-options">
            {choices.length > 1 ? choices.map(choice => <button className="chip" key={choice} type="button" aria-pressed={choice === selected}
              onClick={() => save(term, choice)}>{choice}</button>) : <span className="chip">{selected}</span>}
          </div>
        </div>;
      })}
    </div>
  </section>;
}

function Spelling({ settings }: { settings: Settings }) {
  const { t } = useCopy();
  const presets = [{ style: "ampara-bn", title: "settingsAmpara", sample: "বা যবর বা", lang: "bn" },
    { style: "en", title: "settingsSpellingEnglish", sample: "Bāʾ + fatha = ba", lang: "en" }] as const;
  return <section className="card settings-spelling-card">
    <h2>{t("settingsSpelling")}</h2>
    <div className="equal-row">{presets.map(({ style, title, sample, lang }) => <button type="button" key={style}
      aria-pressed={settings.spellStyle === style} onClick={() => void updateSettings({ spellStyle: style }).catch(() => toast.error(t("saveError")))}>
      <small>{t(title)}</small><strong lang={lang}>{sample}</strong>
    </button>)}</div>
  </section>;
}

export function LanguageSettings({ settings, desktop }: { settings: Settings; desktop: boolean }) {
  const { t } = useCopy();
  const wide = useDesktop(1280);
  const details = <div className="settings-language-column"><YourWords settings={settings} compact /><Spelling settings={settings} /><WordingSuggestionCard /></div>;
  return <div className="settings-language-workspace" data-wide={wide}>
    {!desktop && <SectionNav title={t("settingsLanguage")} back="/you" />}
    <div className="settings-language-column"><AppLanguageCard settings={settings} /><ReadingHelp settings={settings} />
      {!desktop && <Link className="action soft" to="/you/words">{t("settingsYourWords")}</Link>}
      {desktop && !wide && <Dialog>
        <DialogTrigger className="action soft settings-words-trigger">{t("settingsYourWords")}</DialogTrigger>
        <DialogContent className="awwab-dialog desktop-detail-drawer" overlayClassName="desktop-detail-overlay" showCloseButton={false} aria-describedby={undefined}>
          <header className="row-between"><DialogTitle>{t("settingsYourWords")}</DialogTitle>
            <DialogClose asChild><button className="icon-button" type="button" aria-label={t("shareClose")}><X size={18} /></button></DialogClose>
          </header>
          <div className="settings-language-column"><YourWords settings={settings} compact /><Spelling settings={settings} /></div>
        </DialogContent>
      </Dialog>}
      {!wide && <WordingSuggestionCard />}
    </div>
    {desktop && wide && details}
  </div>;
}

export function YourWordsSettings({ settings }: { settings: Settings }) {
  const { t } = useCopy();
  return <div className="settings-language-picker stack">
    <SectionNav title={t("settingsYourWords")} back="/you/language" />
    <p className="small muted">{t("settingsYourWordsSub")}</p>
    <YourWords settings={settings} /><Spelling settings={settings} />
    <section className="settings-salah-variants compact-stack">
      <h2 className="caption">{t("settingsTermWorldwide")}</h2>
      {salahVariants.map(item => <div className="row-between" key={item.language.code}>
        <strong lang={item.language.code} dir={item.language.dir === "rtl" ? "rtl" : "ltr"}>{item.words.join(" · ")}</strong>
        <small className="muted">{item.language.english}</small>
      </div>)}
    </section>
    <WordingSuggestionCard />
  </div>;
}
