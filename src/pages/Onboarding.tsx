import { useState } from "react";
import { Link } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { Wordmark } from "@/components/DesignIcon";
import { VerseAudio } from "@/components/VerseAudio";
import { restoreBackup, updateRecord, updateSettings, type Settings } from "@/lib/storageService";
import content from "../../docs/content/return.json";
import alphabet from "../../docs/content/arabic-letters.json";

const check = [
  { title: "Letters", arabic: alphabet.letters[18].letter, next: 2 },
  { title: "Harakat", arabic: "بِ", next: 5 },
  { title: "Words", arabic: "ٱلْعَصْرِ", next: 6 },
  { title: "Ayah", arabic: "قُلْ هُوَ ٱللَّهُ أَحَدٌ", next: 7, citation: "Al-Ikhlāṣ 112:1" },
];

export function Onboarding({ settings }: { settings: Settings }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState(settings.mode);
  const [script, setScript] = useState(settings.script);
  const [recommendation, recommend] = useState(1);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function finish(lesson: number) {
    setSaving(true);
    try {
      await updateRecord("qaida-current", 1, () => lesson);
      await updateSettings({ onboarded: true, mode, script, spellStyle: mode === "maktab" ? "ampara-bn" : "en" });
    } catch {
      setMessage("Awwab could not save your choices. Try again.");
      setSaving(false);
    }
  }

  if (step === 0) return <main className="onboarding night">
    <div className="stack">
      <header><Wordmark /><p className="muted">the one who keeps returning · <ArabicText text="أَوَّاب" compact /></p></header>
      <h1>For those who keep coming back.</h1>
      <section className="card stack">
        <ArabicText text={content.welcome.arabic} citation={content.welcome.source} />
        <p>{content.welcome.meaning}</p>
        <a href={content.welcome.url} className="caption">{content.welcome.source}</a>
      </section>
      <p className="muted">Works offline and keeps your progress on this device.</p>
      <button className="action gold" onClick={() => setStep(1)}>Bismillah, let’s begin</button>
      <label className="action plain" style={{ cursor: "pointer" }}>Restore from a backup
        <input type="file" className="sr-only" accept=".json,application/json" onChange={async event => {
          const file = event.target.files?.[0];
          if (!file) return;
          try { await restoreBackup(await file.text()); await updateSettings({ onboarded: true }); }
          catch { setMessage("This file could not be restored. Choose an Awwab backup."); }
        }} />
      </label>
      {message && <p role="status">{message}</p>}
      <a className="muted small" href={import.meta.env.BASE_URL}>About awwab</a>
    </div>
  </main>;

  if (step === 1) return <main className="onboarding" data-step="choose">
    <div className="stack">
      <header className="row-between"><p className="caption">Step 2 of 3</p><button className="text-button" disabled={saving} onClick={() => void finish(1)}>Skip</button></header>
      <h1>How would you like to learn?</h1>
      <p className="muted">Choose a learning mode. You can switch any time in Settings.</p>
      {[{ id: "adult", title: "Calm and meaning-first", detail: "Short lessons, word-by-word meaning and spaced review." },
        { id: "maktab", title: "Maktab mode", detail: "Learn like you’re 12 with colour-coded letters, takhti practice and stickers." }].map(item =>
        <button key={item.id} type="button" className={`card stack text-left ${mode === item.id ? "soft" : ""}`} aria-pressed={mode === item.id}
          onClick={() => setMode(item.id as Settings["mode"])}><h2>{item.title}</h2><p>{item.detail}</p></button>)}
      <p><strong>Which script did you learn with?</strong></p>
      <div className="equal-row">
        <button className={`action ${script === "indopak" ? "" : "light"}`} aria-pressed={script === "indopak"} onClick={() => setScript("indopak")}>IndoPak</button>
        <button className={`action ${script === "uthmani" ? "" : "light"}`} aria-pressed={script === "uthmani"} onClick={() => setScript("uthmani")}>Uthmani</button>
      </div>
      <button className="action" onClick={() => setStep(2)}>Continue to the recall check</button>
      {message && <p role="status">{message}</p>}
    </div>
  </main>;

  const index = step - 2;
  const item = check[index];
  return <main className="onboarding">
    <div className="stack">
      <header className="row-between"><p className="caption">Step 3 of 3</p><button className="text-button" disabled={saving} onClick={() => void finish(recommendation)}>Skip</button></header>
      <h1>Let’s see what you still remember</h1>
      <p className="muted">Most people remember more than they think. We’ll start where it feels right for you.</p>
      <div className="chips">{check.map((part, i) => <span className={`chip ${i === index ? "soft" : ""}`} key={part.title}>{part.title}</span>)}</div>
      <section className="card stack text-center"><p className="caption">Can you read this aloud?</p><ArabicText text={item.arabic} citation={item.citation} /><p className="muted small">{item.citation}</p><VerseAudio audioRef={index === 3 ? "112:1" : `placement:${index}`} label={item.title} /></section>
      <button className="action" disabled={saving} onClick={() => {
        recommend(item.next);
        if (index + 1 === check.length) void finish(item.next);
        else setStep(step + 1);
      }}>Yes, I can read it</button>
      <div className="equal-row">{["Slowly", "Not yet"].map(label => <button key={label} className="action light" disabled={saving} onClick={() => void finish(recommendation)}>{label}</button>)}</div>
      {message && <p role="status">{message}</p>}
    </div>
  </main>;
}
