import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArabicText } from "@/components/ArabicText";
import { CityForm } from "@/components/CityForm";
import { DesignIcon } from "@/components/DesignIcon";
import { PlacementAudio } from "@/components/PlacementAudio";
import { IS_PREVIEW } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { builtInLanguages, isBuiltIn, languages } from "@/lib/languagePreferences";
import { completeOnboarding, desktopPlacement, desktopPlacementPassed, placement } from "@/lib/onboarding";
import { quranText } from "@/lib/quran";
import { restoreBackup, updateSettings, type Settings } from "@/lib/storageService";
import { studyNames } from "@/lib/study-copy";
import content from "../../docs/content/return.json";
const modes = [
  { id: "adult", title: "adultOnboardingTitle", subtitle: "adultOnboardingSubtitle", detail: "adultOnboardingDetail",
    example: "ب", features: ["setupWordMeanings", "setupSpacedReview", "setupNoBadges"] },
  { id: "maktab", title: "maktabOnboardingTitle", subtitle: "maktabOnboardingSubtitle", detail: "maktabOnboardingDetail",
    example: "بُ بِ بَ", features: ["qaidaColours", "takhti", "setupStickers"] },
] as const;
const scripts = [
  { id: "indopak", label: "IndoPak", hint: "setupIndopak" },
  { id: "uthmani", label: "Uthmani", hint: "setupUthmani" },
] as const;
const placementHints = ["setupLetterHint", "setupHarakatHint", "setupWordsHint", "setupAyahHint"] as const;
const stepTitles = ["setupLanguageStep", "setupLearnStep", "setupCheckStep", "prayerTimes"];
const answers = ["easy", "effort", "new"] as const;

function WelcomeVerse() {
  const { t } = useCopy();
  return <section className="card onboarding-verse">
    <ArabicText text={content.welcome.arabic} citation={content.welcome.source} verse="17:25" positionOffset={8} />
    <p>{t("welcomeMeaning")}</p>
    <a href={content.welcome.url} className="caption">{content.welcome.source}</a>
  </section>;
}

function SetupWordmark() {
  return <div className="onboarding-wordmark" lang="en">awwab<DesignIcon name="onboarding-fatha" size={35} height={17} /></div>;
}

function DesktopSetup({ step, language, children }: { step: number; language: ReactNode; children: ReactNode }) {
  const { t } = useCopy();
  return <div className="onboarding-desktop">
    <aside className="onboarding-aside night" data-theme-preview="adult">
      <SetupWordmark />
      <div className="stack"><WelcomeVerse />
        <ol className="setup-desktop-steps">{stepTitles.map((title, i) => <li key={title} data-passed={i < step - 1} aria-current={i === step - 1 ? "step" : undefined}>
          <span aria-hidden="true">{i < step - 1 ? <DesignIcon name="onboarding-step-check" size={14} /> : i + 1}</span>{t(title)}
        </li>)}</ol>
      </div>
      <p className="small">{t("setupDevice")}</p>
    </aside>
    <div className="onboarding-inner">
      <header className="setup-desktop-header"><div className="row-between"><p className="small muted">{t("setupDesktopStep", { step })}</p>{language}</div>
        <SetupProgress step={step} /></header>
      {children}
    </div>
  </div>;
}

function SetupProgress({ step }: { step: number }) {
  const { t } = useCopy();
  return <div className="setup-steps" role="img" aria-label={t("setupStep", { step })}>
    {[1, 2, 3, 4].map(i => <span key={i} data-done={i <= step} data-current={i === step} />)}
  </div>;
}

export function Onboarding({ settings, desktop }: { settings: Settings; desktop: boolean }) {
  const { language, t } = useCopy();
  const [step, setStep] = useState(0);
  const [desktopFlow] = useState(desktop);
  const [mode, setMode] = useState(settings.mode);
  const [script, setScript] = useState(settings.script);
  const [spelling, setSpelling] = useState<Settings["spellStyle"]>();
  const [responses, setResponses] = useState<string[]>([]);
  const [question, setQuestion] = useState(0);
  const [showLetters, setShowLetters] = useState(false);
  const [startingPoint, setStartingPoint] = useState(0);
  const [notice, setNotice] = useState<string>();
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const backupFile = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (step === 0) return;
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [step, question]);

  async function finish(passed: number, preferences: Partial<Settings> = {}) {
    if (saving) return;
    setSaving(true);
    setNotice(undefined);
    try { await completeOnboarding(mode, script, passed, { ...preferences, ...(spelling ? { spellStyle: spelling } : {}) }); }
    catch {
      setNotice("setupSaveError");
      setSaving(false);
    }
  }

  async function importFile(file: File) {
    if (saving) return;
    setSaving(true);
    setNotice("setupRestoreOpen");
    try { await restoreBackup(await file.text(), { completeOnboarding: true }); }
    catch {
      setNotice("restoreError");
      setSaving(false);
    }
  }

  const languagePicker = <label className="onboarding-language">
        {desktopFlow && <DesignIcon name="onboarding-language-speech" size={14} />}
        <span className="sr-only">{t("interfaceLanguage")}</span>
        <select value={language} disabled={saving} onChange={async event => {
          const next = event.currentTarget.value;
          if (!isBuiltIn(next)) return;
          try { await updateSettings({ language: next }); setNotice(undefined); }
          catch { setNotice("setupSaveError"); }
        }}>
          {languages.filter(item => builtInLanguages.some(code => code === item.code)).map(item => <option key={item.code} value={item.code} lang={item.code}>{item.native}</option>)}
        </select>
      </label>;
  const languageStep = <>
      <div className="onboarding-welcome-content">
        <header className="onboarding-brand">
          <SetupWordmark />
          <p className="onboarding-brand-note">{t("oneKeepsReturning")} · <ArabicText text="أَوَّاب" compact /></p>
        </header>
        <h1>{t(desktopFlow ? "setupPickLanguage" : "welcomeHeading")}</h1>
        {desktopFlow ? <p className="muted">{t("setupChangeLanguage")}</p> : <WelcomeVerse />}
      </div>
      <div className="onboarding-welcome-footer">
        <p className="small">{t("welcomeOffline")}</p>
        <button className="action onboarding-accent" type="button" disabled={saving} onClick={() => setStep(1)}>{t("begin")}</button>
        <button className="action plain" type="button" disabled={saving} onClick={() => backupFile.current?.click()}>{t("restoreFromBackup")}</button>
        {IS_PREVIEW && <p className="small muted">{t("previewStatus")}</p>}
        <input ref={backupFile} type="file" hidden accept=".json,application/json" onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void importFile(file);
        }} />
        {notice && <p role="status" className="small">{t(notice)}</p>}
      </div>
  </>;
  if (step === 0) return <main className={desktopFlow ? "onboarding onboarding-desktop-page" : "onboarding onboarding-welcome night"} data-theme-preview="adult">
    {desktopFlow ? <DesktopSetup step={1} language={languagePicker}>{languageStep}</DesktopSetup> : <div className="onboarding-inner">{languagePicker}{languageStep}</div>}
  </main>;

  const choose = <>
      {!desktopFlow && <header className="row-between onboarding-step-header">
        <SetupProgress step={2} />
        <button className="text-button muted" type="button" disabled={saving} onClick={() => void finish(0)}>{t("skip")}</button>
      </header>}
      <h1 ref={heading} tabIndex={-1}>{t(desktopFlow ? "setupHowLearn" : "chooseLearningMode")}</h1>
      <p className="muted">{t("modeChangeHint")}</p>
      <div className="onboarding-mode-list" role="group" aria-label={t("chooseLearningMode")}>
        {modes.map(item => <section className="card onboarding-mode-card" key={item.id} data-theme-preview={desktopFlow ? "adult" : item.id} data-selected={mode === item.id}>
          <div className="onboarding-mode-title">
            {!desktopFlow && <div className="onboarding-mode-example">
              <span lang="en">Aa</span>
              <ArabicText text={item.example} compact />
            </div>}
            <div>
              <h2 id={`onboarding-mode-${item.id}`}>{t(desktopFlow ? item.id === "adult" ? "setupAdult" : "setupMaktab" : item.title)}</h2>
              {!desktopFlow && <p className="small">{t(item.subtitle)}</p>}
            </div>
            {mode === item.id ? desktopFlow ? <span className="onboarding-mode-dot setup-mode-checked"><DesignIcon name="onboarding-mode-check" size={14} /></span> : item.id === "adult" ? <DesignIcon name="onboarding-script-check" size={24} /> : <span className="onboarding-mode-dot selected" /> : <span className="onboarding-mode-dot" />}
          </div>
          <p className="muted">{t(desktopFlow ? `setupMode-${item.id}` : item.detail)}</p>
          {desktopFlow ? <><div className="onboarding-mode-example" data-lesson-mode={item.id}>
            <ArabicText text="بَ" compact /><strong className="small">{t(`setupSample-${item.id}`)}</strong>
          </div>
            <ul className="setup-mode-features">{[1, 2, 3].map(i => <li key={i}><DesignIcon name="check-primary-14" size={14} />{t(`setupFeature-${item.id}-${i}`)}</li>)}</ul></>
            : <div className="chips">{item.features.map(feature => <span className="chip soft" key={feature}>{t(feature)}</span>)}</div>}
          <button className="onboarding-mode-hit" type="button" disabled={saving} aria-pressed={mode === item.id}
            aria-labelledby={`onboarding-mode-${item.id}`} onClick={() => setMode(item.id)} />
        </section>)}
      </div>
      <div className={desktopFlow ? "equal-row setup-script-options" : undefined}><fieldset className="onboarding-scripts">
        <legend>{t(desktopFlow ? "setupQuranScript" : "chooseFamiliarScript")}</legend>
        <div className="equal-row">
          {scripts.map(item => <button type="button" disabled={saving} key={item.id} aria-pressed={script === item.id} onClick={() => setScript(item.id)}>
            <strong lang="en">{item.label}</strong><small>{t(item.hint)}</small>
          </button>)}
        </div>
      </fieldset>
      {desktopFlow && <fieldset className="onboarding-scripts">
        <legend>{t("setupSpellLetters")}</legend><div className="equal-row">
          {(["ampara-bn", "en"] as const).map(style => <button type="button" key={style} aria-pressed={(spelling ?? (mode === "maktab" ? "ampara-bn" : "en")) === style}
            onClick={() => setSpelling(style)}><strong>{t(style === "en" ? "setupEnglish" : "setupAmpara")}</strong>
            <small lang={style === "en" ? "en" : "bn"}>{style === "en" ? "Bāʾ + fatha = ba" : "বা যবর বা"}</small></button>)}
        </div></fieldset>}</div>
      <footer className={desktopFlow ? "setup-desktop-actions row-between" : undefined}>
        {desktopFlow && <button className="action light" type="button" onClick={() => setStep(0)}>{t("back")}</button>}
        <button className="action onboarding-continue" type="button" disabled={saving} onClick={() => setStep(2)}>{t("continueToRecall")}</button>
      </footer>
      {notice && <p role="status" className="small muted">{t(notice)}</p>}
  </>;
  if (step === 1) return <main className="onboarding onboarding-choose" data-theme-preview="adult">
    {desktopFlow ? <DesktopSetup step={2} language={languagePicker}>{choose}</DesktopSetup> : <div className="onboarding-inner">{choose}</div>}
  </main>;

  if (desktopFlow && step === 3) return <main className="onboarding onboarding-prayer" data-theme-preview={mode}>
    <DesktopSetup step={4} language={languagePicker}>
      <h1 ref={heading} tabIndex={-1}>{t("prayerTimes")}</h1>
      <CityForm initial={settings} saving={saving} submitLabel="setupFinish" save={patch => finish(startingPoint, patch)} />
      {notice && <p role="alert">{t(notice)}</p>}
      <footer className="setup-desktop-actions"><button className="action light" type="button" disabled={saving} onClick={() => setStep(2)}>{t("back")}</button></footer>
    </DesktopSetup>
  </main>;

  if (desktopFlow) {
    const sample = desktopPlacement[question];
    const ref = sample.chapter && `${sample.chapter}:${sample.verse}`;
    const advance = (passed: number) => { setStartingPoint(passed); setStep(3); };
    return <main className="onboarding onboarding-recall" data-theme-preview={mode}>
      <DesktopSetup step={3} language={languagePicker}>
        <h1 ref={heading} tabIndex={-1}>{t("setupCanRead")}</h1><p className="muted">{t("setupEightQuestions")}</p>
        <section className="card onboarding-question">
          <p className="caption">{t("pathsCheckQuestion", { number: question + 1, total: desktopPlacement.length })} · {t(sample.title)}</p>
          <ArabicText text={sample.arabic} citation={ref || undefined} verse={ref || undefined} />
          {ref && <span className="caption muted">{ref}</span>}
          <div className="setup-question-tools">
            <PlacementAudio key={sample.audioRef} reference={sample.audioRef} title={t(sample.title)} concise />
            <button className="chip soft" type="button" aria-expanded={showLetters} onClick={() => setShowLetters(value => !value)}>{t("setupShowLetters")}</button>
          </div>
          {showLetters && <ArabicText text={[...sample.arabic].filter(letter => /\p{L}/u.test(letter)).join(" ")} compact />}
        </section>
        <div className="equal-row setup-desktop-answers">{answers.map(answer => <button type="button" className="action light" key={answer} aria-pressed={responses[question] === answer}
          onClick={() => setResponses(values => [...values.slice(0, question), answer])}><strong>{t(`setupAnswer-${answer}`)}</strong><small>{t(`setupAnswerHint-${answer}`)}</small></button>)}</div>
        <div className="setup-question-dots" aria-hidden="true">{desktopPlacement.map((_, i) => <span key={i} data-done={i < question} data-current={i === question} />)}</div>
        <footer className="setup-desktop-actions row-between">
          <button className="action light" type="button" onClick={() => advance(0)}>{t("setupSkipPlacement")}</button>
          <button className="action" type="button" disabled={!responses[question]} onClick={() => {
            setShowLetters(false);
            if (question + 1 === desktopPlacement.length) advance(desktopPlacementPassed(responses));
            else setQuestion(index => index + 1);
          }}>{t("hifzNext")}</button>
        </footer>
      </DesktopSetup>
    </main>;
  }

  const index = step - 2;
  const item = placement[index];
  const verse = item.chapter && item.verse ? quranText[item.chapter][item.verse - 1] : undefined;
  const citation = item.chapter && verse ? studyNames.surah(language, item.chapter, item.chapter === 112 ? "Al-Ikhlāṣ" : "Al-ʿAsr") + " " + verse.ref : undefined;

  return <main className="onboarding onboarding-recall" data-theme-preview={mode}>
    <div className="onboarding-inner">
      <header className="row-between onboarding-step-header">
        <SetupProgress step={3} />
        <span className="small muted">{t("setupTime", { count: 2 })}</span>
      </header>
      <h1 ref={heading} tabIndex={-1}>{t("recallCheck")}</h1>
      <p className="muted">{t("recallCheckHint")}</p>
      <ol className="chips onboarding-placement" aria-label={t("recallCheck")}>
        {placement.map((sample, i) => <li className="chip" key={sample.title} data-passed={i < index} aria-current={i === index ? "step" : undefined}>
          {i < index ? <>
            <span aria-hidden="true">✓ {t(sample.title)}</span>
            <span className="sr-only">{t("setupPassed", { name: t(sample.title) })}</span>
          </> : t(sample.title)}
        </li>)}
      </ol>
      <section className="card onboarding-question" aria-label={t("readThisAloud")}>
        <p className="caption">{t("readThisAloud")}</p>
        <ArabicText text={item.arabic} citation={citation} verse={verse?.ref} />
        <PlacementAudio key={item.audioRef} reference={item.audioRef} title={t(item.title)} />
      </section>
      <div className="onboarding-recall-actions">
        <button className="action" type="button" disabled={saving} onClick={() => {
          if (index + 1 === placement.length) void finish(index + 1);
          else setStep(value => value + 1);
        }}>{t("canRead")}</button>
        <div className="equal-row">{["readSlowly", "notYet"].map(label => <button key={label} className="action light" type="button" disabled={saving} onClick={() => void finish(index)}>{t(label)}</button>)}</div>
      </div>
      <section className="card onboarding-recognition">
        <h2><DesignIcon name="onboarding-sparkles" size={18} />{t("setupRecognise")}</h2>
        <p className="small muted">{t(placementHints[index])}{verse && <> {t("setupVerseMeaning", { meaning: verse.english })}</>}</p>
        {citation && <p className="small muted">{citation}</p>}
      </section>
      {notice && <p role="status" className="small muted">{t(notice)}</p>}
      <button className="text-button muted justify-self-end" type="button" disabled={saving} onClick={() => void finish(index)}>{t("skip")}</button>
    </div>
  </main>;
}
