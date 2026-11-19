import { useLayoutEffect, useRef, useState } from "react";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { VerseAudio } from "@/components/VerseAudio";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { asset } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { completeOnboarding, placement, placementAudio } from "@/lib/onboarding";
import { quranText } from "@/lib/quran";
import { restoreBackup, updateSettings, type Settings } from "@/lib/storageService";
import { studyNames } from "@/lib/study-copy";
import content from "../../docs/content/return.json";
import recordings from "../../public/packs/audio/index.json";

const paths = Object.fromEntries(Object.entries(placementAudio).map(([ref, sample]) => [ref, asset(sample.path)]));
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

function SetupProgress({ step }: { step: number }) {
  const { t } = useCopy();
  return <div className="setup-steps" role="img" aria-label={t("setupStep", { step })}>
    {[1, 2, 3, 4].map(i => <span key={i} data-done={i <= step} data-current={i === step} />)}
  </div>;
}

function PlacementAudio({ reference, title }: { reference: string; title: string }) {
  const { t } = useCopy();
  const [selecting, setSelecting] = useState(false);
  const player = useAudioPlayback([reference], paths);
  const available = player.has(reference);
  const pack = recordings.packs.find(item => item.id === placementAudio[reference]?.pack);

  return <div className="setup-audio">
    <button className="setup-hear" type="button" aria-expanded={!available ? selecting : undefined} onClick={() => {
      if (available) player.play(reference);
      else setSelecting(value => !value);
    }}>
      <span><DesignIcon name="onboarding-volume" size={18} /></span>
      {t(player.playing ? "setupPause" : available ? "setupHeard" : "addAudio")}
    </button>
    <audio ref={player.element} preload="none" {...player.events} aria-label={t("referenceAudioFor", { name: title })} />
    {player.error && <small role="status">{t("setupPlaybackError")}</small>}
    {available && player.track && pack && <small className="muted">
      <a href={pack.source} target="_blank" rel="noreferrer" lang="en">{pack.speaker}</a> · <a href={pack.licenseUrl} target="_blank" rel="noreferrer" lang="en">{pack.attribution.split(" · ")[1]}</a>
      <br />{t("setupAudioExcerpt")}
    </small>}
    {!available && selecting && <VerseAudio audioRef={reference} label={title} startExpanded />}
  </div>;
}

export function Onboarding({ settings }: { settings: Settings }) {
  const { language, t } = useCopy();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState(settings.mode);
  const [script, setScript] = useState(settings.script);
  const [notice, setNotice] = useState<string>();
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const backupFile = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (step === 0) return;
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  async function finish(passed: number) {
    if (saving) return;
    setSaving(true);
    setNotice(undefined);
    try { await completeOnboarding(mode, script, passed); }
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

  if (step === 0) return <main className="onboarding onboarding-welcome night" data-theme-preview="adult">
    <div className="onboarding-inner">
      <label className="onboarding-language">
        <span className="sr-only">{t("interfaceLanguage")}</span>
        <select value={language} disabled={saving} onChange={async event => {
          const next = event.currentTarget.value === "bn" ? "bn" : "en";
          try { await updateSettings({ language: next }); setNotice(undefined); }
          catch { setNotice("setupSaveError"); }
        }}>
          <option value="en" lang="en">English</option>
          <option value="bn" lang="bn">বাংলা</option>
        </select>
      </label>
      <div className="onboarding-welcome-content">
        <header className="onboarding-brand">
          <div className="onboarding-wordmark" lang="en">awwab<DesignIcon name="onboarding-fatha" size={35} height={17} /></div>
          <p className="onboarding-brand-note">{t("oneKeepsReturning")} · <ArabicText text="أَوَّاب" compact /></p>
        </header>
        <h1>{t("welcomeHeading")}</h1>
        <section className="card onboarding-verse">
          <ArabicText text={content.welcome.arabic} citation={content.welcome.source} verse="17:25" positionOffset={8} />
          <p>{t("welcomeMeaning")}</p>
          <a href={content.welcome.url} className="caption">{content.welcome.source}</a>
        </section>
      </div>
      <div className="onboarding-welcome-footer">
        <p className="small">{t("welcomeOffline")}</p>
        <button className="action onboarding-accent" type="button" disabled={saving} onClick={() => setStep(1)}>{t("begin")}</button>
        <button className="action plain" type="button" disabled={saving} onClick={() => backupFile.current?.click()}>{t("restoreFromBackup")}</button>
        <input ref={backupFile} type="file" hidden accept=".json,application/json" onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void importFile(file);
        }} />
        {notice && <p role="status" className="small">{t(notice)}</p>}
      </div>
    </div>
  </main>;

  if (step === 1) return <main className="onboarding onboarding-choose" data-theme-preview="adult">
    <div className="onboarding-inner">
      <header className="row-between onboarding-step-header">
        <SetupProgress step={2} />
        <button className="text-button muted" type="button" disabled={saving} onClick={() => void finish(0)}>{t("skip")}</button>
      </header>
      <h1 ref={heading} tabIndex={-1}>{t("chooseLearningMode")}</h1>
      <p className="muted">{t("modeChangeHint")}</p>
      <div className="onboarding-mode-list" role="group" aria-label={t("chooseLearningMode")}>
        {modes.map(item => <section className="card onboarding-mode-card" key={item.id} data-theme-preview={item.id} data-selected={mode === item.id}>
          <div className="onboarding-mode-title">
            <div className="onboarding-mode-example">
              <span lang="en">Aa</span>
              <ArabicText text={item.example} compact />
            </div>
            <div>
              <h2 id={`onboarding-mode-${item.id}`}>{t(item.title)}</h2>
              <p className="small">{t(item.subtitle)}</p>
            </div>
            {mode === item.id ? item.id === "adult" ? <DesignIcon name="onboarding-script-check" size={24} /> : <span className="onboarding-mode-dot selected" /> : <span className="onboarding-mode-dot" />}
          </div>
          <p className="muted">{t(item.detail)}</p>
          <div className="chips">{item.features.map(feature => <span className="chip soft" key={feature}>{t(feature)}</span>)}</div>
          <button className="onboarding-mode-hit" type="button" disabled={saving} aria-pressed={mode === item.id}
            aria-labelledby={`onboarding-mode-${item.id}`} onClick={() => setMode(item.id)} />
        </section>)}
      </div>
      <fieldset className="onboarding-scripts">
        <legend>{t("chooseFamiliarScript")}</legend>
        <div className="equal-row">
          {scripts.map(item => <button type="button" disabled={saving} key={item.id} aria-pressed={script === item.id} onClick={() => setScript(item.id)}>
            <strong lang="en">{item.label}</strong><small>{t(item.hint)}</small>
          </button>)}
        </div>
      </fieldset>
      <button className="action onboarding-continue" type="button" disabled={saving} onClick={() => setStep(2)}>{t("continueToRecall")}</button>
      {notice && <p role="status" className="small muted">{t(notice)}</p>}
    </div>
  </main>;

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
