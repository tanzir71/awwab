import { useState } from "react";
import { ArabicText } from "@/components/ArabicText";
import { Wordmark } from "@/components/DesignIcon";
import { VerseAudio } from "@/components/VerseAudio";
import { restoreBackup, updateRecord, updateSettings, type Settings } from "@/lib/storageService";
import { useCopy } from "@/lib/copy";
import content from "../../docs/content/return.json";
import alphabet from "../../docs/content/arabic-letters.json";

const check = [
  { title: "letters", arabic: alphabet.letters[18].letter, next: 2 },
  { title: "harakat", arabic: "بِ", next: 5 },
  { title: "words", arabic: "ٱلْعَصْرِ", next: 6 },
  { title: "ayah", arabic: "قُلْ هُوَ ٱللَّهُ أَحَدٌ", next: 7, citation: "Al-Ikhlāṣ 112:1" },
];

export function Onboarding({ settings }: { settings: Settings }) {
  const { language, t } = useCopy();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState(settings.mode);
  const [script, setScript] = useState(settings.script);
  const [recommendation, recommend] = useState(1);
  const [notice, setNotice] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function finish(lesson: number) {
    setSaving(true);
    try {
      await updateRecord("qaida-current", 1, () => lesson);
      await updateSettings({ onboarded: true, mode, script, spellStyle: mode === "maktab" ? "ampara-bn" : "en" });
    } catch {
      setNotice("setupSaveError");
      setSaving(false);
    }
  }

  if (step === 0) return <main className="onboarding night">
    <div className="stack">
      <header><Wordmark /><p className="muted">{t("oneKeepsReturning")} · <ArabicText text="أَوَّاب" compact /></p></header>
      <h1>{t("welcomeHeading")}</h1>
      <section className="card stack">
        <ArabicText text={content.welcome.arabic} citation={content.welcome.source} />
        <p lang="en">{content.welcome.meaning}</p>
        <a href={content.welcome.url} className="caption">{content.welcome.source}</a>
      </section>
      <p className="muted">{t("welcomeOffline")}</p>
      <label className="field onboarding-language">{t("interfaceLanguage")}
        <select value={language} onChange={async event => {
          const language = event.target.value === "bn" ? "bn" : "en";
          try { await updateSettings({ language }); setNotice(undefined); }
          catch { setNotice("setupSaveError"); }
        }}>
          <option value="en" lang="en">English</option>
          <option value="bn" lang="bn">বাংলা</option>
        </select>
      </label>
      <button className="action gold" onClick={() => setStep(1)}>{t("begin")}</button>
      <label className="action plain" style={{ cursor: "pointer" }}>{t("restoreFromBackup")}
        <input type="file" className="sr-only" accept=".json,application/json" onChange={async event => {
          const file = event.target.files?.[0];
          if (!file) return;
          try { await restoreBackup(await file.text()); await updateSettings({ onboarded: true }); }
          catch { setNotice("restoreError"); }
        }} />
      </label>
      {notice && <p role="status">{t(notice)}</p>}
      <a className="muted small" href={import.meta.env.BASE_URL}>{t("aboutAwwab")}</a>
    </div>
  </main>;

  if (step === 1) return <main className="onboarding" data-step="choose">
    <div className="stack">
      <header className="row-between"><p className="caption">{t("setupStep", { step: 2 })}</p><button className="text-button" disabled={saving} onClick={() => void finish(1)}>{t("skip")}</button></header>
      <h1>{t("chooseLearningMode")}</h1>
      <p className="muted">{t("modeChangeHint")}</p>
      {([{ id: "adult", title: "adultOnboardingTitle", detail: "adultOnboardingDetail" },
        { id: "maktab", title: "maktabOnboardingTitle", detail: "maktabOnboardingDetail" }] as const).map(item =>
        <button key={item.id} type="button" className={`card stack text-left ${mode === item.id ? "soft" : ""}`} aria-pressed={mode === item.id}
          onClick={() => setMode(item.id)}><h2>{t(item.title)}</h2><p>{t(item.detail)}</p></button>)}
      <p><strong>{t("chooseFamiliarScript")}</strong></p>
      <div className="equal-row">
        <button className={`action ${script === "indopak" ? "" : "light"}`} aria-pressed={script === "indopak"} onClick={() => setScript("indopak")}>IndoPak</button>
        <button className={`action ${script === "uthmani" ? "" : "light"}`} aria-pressed={script === "uthmani"} onClick={() => setScript("uthmani")}>Uthmani</button>
      </div>
      <button className="action" onClick={() => setStep(2)}>{t("continueToRecall")}</button>
      {notice && <p role="status">{t(notice)}</p>}
    </div>
  </main>;

  const index = step - 2;
  const item = check[index];
  return <main className="onboarding">
    <div className="stack">
      <header className="row-between"><p className="caption">{t("setupStep", { step: 3 })}</p><button className="text-button" disabled={saving} onClick={() => void finish(recommendation)}>{t("skip")}</button></header>
      <h1>{t("recallCheck")}</h1>
      <p className="muted">{t("recallCheckHint")}</p>
      <div className="chips">{check.map((part, i) => <span className={`chip ${i === index ? "soft" : ""}`} key={part.title}>{t(part.title)}</span>)}</div>
      <section className="card stack text-center"><p className="caption">{t("readThisAloud")}</p><ArabicText text={item.arabic} citation={item.citation} /><p className="muted small">{item.citation}</p><VerseAudio audioRef={index === 3 ? "112:1" : `placement:${index}`} label={t(item.title)} /></section>
      <button className="action" disabled={saving} onClick={() => {
        recommend(item.next);
        if (index + 1 === check.length) void finish(item.next);
        else setStep(step + 1);
      }}>{t("canRead")}</button>
      <div className="equal-row">{["readSlowly", "notYet"].map(label => <button key={label} className="action light" disabled={saving} onClick={() => void finish(recommendation)}>{t(label)}</button>)}</div>
      {notice && <p role="status">{t(notice)}</p>}
    </div>
  </main>;
}
