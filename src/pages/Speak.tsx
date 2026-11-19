import { useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { LocalRecorder } from "@/components/LocalRecorder";
import { useRecord } from "@/hooks/use-awwab";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { asset } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { phraseReviewPrefix } from "@/lib/learningPaths";
import { newReview, type ReviewGrade, type Reviews } from "@/lib/reviews";
import { saveLearningReview } from "@/lib/studyMilestones";
import { updateRecord, type Settings } from "@/lib/storageService";
import { askPhrase, renderAsk } from "@/lib/umrahAsk";
import { banglaPhrases } from "@/lib/umrah-ask-copy";
import curriculum from "../../docs/content/spoken-arabic.json";

const base = "/learn/speak";
const steps = ["speakListen", "speakWords", "speakRepeat", "speakTurn", "speakSign"];
const goals = ["speakUmrah", "speakWork", "speakEveryday", "speakNews"];
const goalDefaults = ["speakUmrah"];
const progressKey = "speak-complete";
const speakGoalsKey = "speak-goals";
type Unit = typeof curriculum.units[number];
type Line = { ar: string; tr: string; meaning: string[]; clip: string };
const studyClip = (name: string) => asset(`packs/study-speech/${name}.opus`);

function linesFor(unit: Unit): Line[] {
  if (unit.id === "sim") return curriculum.simDialogue.map((line, i) => ({ ...line, clip: studyClip(`sim-${i + 1}`) }));
  return unit.phrases.map(id => {
    const line = renderAsk(askPhrase(id)!, "saudi");
    return { ...line, meaning: [line.en, banglaPhrases[id] ?? line.en], clip: asset(`packs/phrases/saudi/female/${id}.opus`) };
  });
}

function UnitList({ active, complete }: { active?: string; complete: string[] }) {
  const { t, language } = useCopy();
  return <section className="card speak-unit-list" aria-label={t("speakSurvival")}>
    <header className="row-between"><h2>A1 · {t("speakSurvival")}</h2><span className="small muted">{t("speakUnits", { count: curriculum.units.length })}</span></header>
    <ol>{curriculum.units.map(unit => <li key={unit.id}><Link to={`${base}/${unit.id}`} aria-current={active === unit.id ? "page" : undefined}>
      <span>{unit.title[language === "bn" ? 1 : 0]}</span>{complete.includes(unit.id) && <span aria-label={t("pathsDone")}>✓</span>}
    </Link></li>)}</ol>
  </section>;
}

function SpeakSetup({ complete }: { complete: string[] }) {
  const { t } = useCopy();
  const selected = useRecord(speakGoalsKey, goalDefaults);
  const [error, setError] = useState(false);
  return <div className="paths-page speak-page speak-setup">
    <header className="hifz-heading"><Link className="hifz-back" to="/learn/paths" aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
      <div><h1>{t("pathsSpeak")}</h1><p className="small muted">{t("speakSubtitle")}</p></div></header>
    <div className="speak-setup-grid"><div className="compact-stack">
      <h2 className="caption">{t("speakVariety")}</h2>
      <section className="card speak-variety selected"><h3>{t("speakSaudi")}</h3><p className="small muted">{t("speakSaudiNote")}</p></section>
      {(["speakGulf", "speakFormal", "speakLater"] as const).map(name => <section className="card speak-variety" key={name}>
        <div className="row-between"><h3>{t(name)}</h3><span className="small muted">{t("speakPending")}</span></div>
        {name !== "speakLater" && <p className="small muted">{t(`${name}Note`)}</p>}
      </section>)}
      <h2 className="caption">{t("speakGoal")}</h2>
      <div className="chips">{goals.map(goal => <button key={goal} type="button" className={`chip ${selected.includes(goal) ? "active" : "soft"}`}
        aria-pressed={selected.includes(goal)} onClick={() => {
          setError(false);
          void updateRecord(speakGoalsKey, goalDefaults, saved => saved.includes(goal) ? saved.filter(id => id !== goal) : [...saved, goal]).catch(() => setError(true));
        }}>{t(goal)}</button>)}</div>
      {error && <p role="alert">{t("saveError")}</p>}
      <h2 className="caption">{t("speakLevels")}</h2>
      <div className="equal-row speak-levels">
        <Link className="card night" to={`${base}/greetings`}><strong>A1</strong><small>{t("speakSurvival")} · {t("speakUnits", { count: curriculum.units.length })}</small></Link>
        {(["A2", "B1"] as const).map((level, index) => <Link className="card soft" key={level} to={`/learn/paths/speak/${index + 2}`}><strong>{level}</strong><small>{t("speakPending")}</small></Link>)}
      </div>
    </div><UnitList complete={complete} /></div>
  </div>;
}

function SpeakLesson({ unit, complete, now, settings, reviewIndex }: { unit: Unit; complete: string[]; now: Date; settings: Settings; reviewIndex?: number }) {
  const { t, language } = useCopy();
  const lang = language === "bn" ? 1 : 0;
  const [step, setStep] = useState(reviewIndex === undefined ? 0 : 1);
  const [slow, setSlow] = useState(false);
  const [meanings, setMeanings] = useState(true);
  const [answer, setAnswer] = useState<number>();
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [queueError, setQueueError] = useState(false);
  const sequence = useRef<number>();
  const lines = linesFor(unit);
  const title = unit.title[lang];
  const sim = unit.id === "sim";
  const question = sim ? 2 : 0;
  const clips = Object.fromEntries(lines.map((line, i) => [`line-${i}`, line.clip]));
  clips.sign = studyClip(`sign-${unit.id}`);
  if (sim) curriculum.simWords.forEach((_, i) => { clips[`word-${i}`] = studyClip(`sim-word-${i + 1}`); });
  const player = useAudioPlayback(Object.keys(clips), clips);
  const words = sim ? curriculum.simWords : lines;
  const reviews = useRecord<Reviews>("reviews", {});
  const reviewId = (i: number) => `${phraseReviewPrefix}${unit.id}:${i}`;
  const reviewWord = reviewIndex === undefined ? undefined : words[reviewIndex];
  const queued = words.every((_, i) => reviews[reviewId(i)]);

  function queueWords() {
    setQueueError(false);
    void updateRecord<Reviews>("reviews", {}, saved => {
      const additions = words.flatMap((_, i) => saved[reviewId(i)] ? [] : [[reviewId(i), newReview(now)] as const]);
      return { ...saved, ...Object.fromEntries(additions) };
    }).catch(() => setQueueError(true));
  }

  async function gradeWord(grade: ReviewGrade) {
    if (saving || reviewSaved || reviewIndex === undefined) return;
    setSaving(true);
    setQueueError(false);
    try {
      await saveLearningReview(reviewId(reviewIndex), grade, now, settings.city.timeZone);
      setReviewSaved(true);
    } catch { setQueueError(true); }
    finally { setSaving(false); }
  }

  function changeStep(next: number) {
    sequence.current = undefined;
    player.element.current?.pause();
    setStep(next);
  }

  function listen(id: string) {
    sequence.current = undefined;
    player.play(id, slow ? .75 : 1);
  }

  function playLesson() {
    if (player.playing) { sequence.current = undefined; player.element.current?.pause(); return; }
    sequence.current = 0;
    player.play("line-0", slow ? .75 : 1);
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    setError(false);
    try { await updateRecord<string[]>(progressKey, [], saved => [...new Set([...saved, unit.id])]); }
    catch { setError(true); }
    finally { setSaving(false); }
  }

  const sign = <><h2>{t("speakSign")}</h2><ArabicText text={unit.sign} /></>;
  const wordList = <section className="card speak-words-list"><header className="row-between"><h2>{t("speakWordsInLesson")}</h2>
    <button className="text-button" type="button" disabled={queued} onClick={queueWords}>{t(queued ? "anatomyAdded" : "speakAddAll")}</button></header>
    {words.map((word, i) => <div className="speak-word" key={word.ar}>
      <div><strong>{word.tr}</strong><p className="small muted">{word.meaning[lang]}</p></div>
      <ArabicText text={word.ar} preserveSeparators words={sim ? [{ root: curriculum.simWords[i].root, transliteration: word.tr, gloss: word.meaning[lang] }] : undefined} showGlosses={false} />
      {step === 1 && <button className="icon-button" type="button" onClick={() => listen(`${sim ? "word" : "line"}-${i}`)} aria-label={t("speakHearLine", { number: i + 1 })}><DesignIcon name="speak-volume" size={14} /></button>}
    </div>)}
    {queueError && <p role="alert">{t("saveError")}</p>}
  </section>;

  return <div className="paths-page speak-page speak-lesson">
    <header className="hifz-heading"><Link className="hifz-back" to={base} aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
      <div><h1>{title}</h1><p className="small muted">{t("speakUnitLabel", { number: curriculum.units.indexOf(unit) + 1 })}</p></div></header>
    <div className="speak-workspace">
      <div className="speak-workspace-nav"><UnitList active={unit.id} complete={complete} /></div>
      <div className="compact-stack speak-lesson-main">
        <div className="speak-steps" role="group" aria-label={title}>{steps.map((label, i) => <button type="button" key={label} aria-pressed={step === i} onClick={() => changeStep(i)}>{t(label)}</button>)}</div>
        <audio ref={player.element} preload="none" {...player.events} onEnded={() => {
          player.events.onEnded();
          if (sequence.current === undefined) return;
          const next = sequence.current + 1;
          sequence.current = next < lines.length ? next : undefined;
          if (next < lines.length) player.play(`line-${next}`, slow ? .75 : 1);
        }} />
        {step === 0 && <>
          <div className="speak-dialogue">{lines.map((line, i) => <section className="card speak-line" data-you={!sim || i % 2 === 0} key={line.ar}>
            <div className="row-between"><span className="caption">{t(!sim || i % 2 === 0 ? "speakYou" : "speakShop")}</span>
              <button className="icon-button" type="button" aria-label={t("speakHearLine", { number: i + 1 })} aria-pressed={player.playing && player.track === `line-${i}`}
                onClick={() => listen(`line-${i}`)}><DesignIcon name="speak-volume" size={14} /></button></div>
            <ArabicText text={line.ar} preserveSeparators />
            <strong className="small" lang="en">{line.tr}</strong>{meanings && <p className="muted small">{line.meaning[lang]}</p>}
          </section>)}</div>
          {sim && <div className="card tint speak-bridge"><div><h2 className="caption">{t("speakRoot")}</h2><p className="small">{t("speakRootExplanation")}</p></div>
            <ArabicText text="نَشْرَحْ" compact citation="94:1" verse="94:1" positionOffset={1} words={[{ root: "ش ر ح" }]} /></div>}
        </>}
        {step === 1 && (reviewWord ? <section className="card compact-stack"><h2>{t("speakReviewMeaning")}</h2>
          <ArabicText text={reviewWord.ar} preserveSeparators />
          {!reviewRevealed ? <button className="action light" type="button" onClick={() => setReviewRevealed(true)}>{t("speakShowMeanings")}</button> : <>
            <p>{reviewWord.meaning[lang]}</p>
            {reviewSaved ? <Link className="action" to={`${base}/${unit.id}`}>{t("pathsDone")}</Link> : <div className="equal-row">
              {(["forgot", "shaky", "got-it"] as const).map(grade => <button className="action light" type="button" key={grade}
                disabled={saving} onClick={() => void gradeWord(grade)}>{t(grade)}</button>)}
            </div>}</>}
          {queueError && <p role="alert">{t("saveError")}</p>}
        </section> : wordList)}
        {step === 2 && <section className="card compact-stack"><h2>{t("speakRepeat")}</h2><ArabicText text={lines[question].ar} preserveSeparators />
          <button className="action light" type="button" onClick={() => listen(`line-${question}`)}>{t(player.playing ? "askStop" : "speakListen")}</button><LocalRecorder /></section>}
        {step === 3 && <section className="card compact-stack"><h2>{t("speakChoose")}</h2><p>{lines[question].meaning[lang]}</p>
          <div className="compact-stack">{[lines.at(-1)!, lines[question]].map((line, i) => <div className="speak-answer" key={line.ar}>
            <ArabicText text={line.ar} preserveSeparators /><button type="button" className="action light" aria-pressed={answer === i} onClick={() => setAnswer(i)}>{i + 1}</button>
          </div>)}</div>{answer !== undefined && <p role="status">{t(answer === 1 ? "lessonCorrect" : "speakTryAgain")}</p>}</section>}
        {step === 4 && <section className="card tint compact-stack">{sign}
          <div className="equal-row"><button className="action light" type="button" onClick={() => listen("sign")}>{t(player.playing ? "askStop" : "speakListen")}</button>
            <button className="action light" type="button" aria-expanded={revealed} onClick={() => setRevealed(value => !value)}>{t("speakSignMeaning")}</button></div>
          {revealed && <p>{unit.meaning[lang]}</p>}
          {complete.includes(unit.id) ? <Link className="action" to={base}>{t("pathsDone")}</Link> : <button className="action" type="button" disabled={saving} onClick={() => void finish()}>{t("speakFinish")}</button>}
          {error && <p role="alert">{t("saveError")}</p>}</section>}
        {player.error && <p role="status">{t("setupPlaybackError")}</p>}
        <div className="speak-player card night">
          <button type="button" onClick={playLesson}>{t(player.playing ? "askStop" : "speakPlay")}</button>
          <div className="speak-player-controls"><button type="button" aria-pressed={slow} onClick={() => {
            setSlow(value => !value);
            if (player.element.current) player.element.current.playbackRate = slow ? 1 : .75;
          }}>{t("askSlow")}</button>
            {step === 0 && <button type="button" onClick={() => setMeanings(value => !value)}>{t(meanings ? "speakHideMeanings" : "speakShowMeanings")}</button>}
            {step < steps.length - 1 && <button type="button" onClick={() => changeStep(step + 1)}>{t(steps[step + 1])} →</button>}</div>
        </div>
        <p className="small muted">{t("generatedSpeech")}</p>
      </div>
      <aside className="compact-stack speak-workspace-side">{step !== 1 && wordList}{step !== 4 && <section className="card tint compact-stack">{sign}<p className="small">{unit.meaning[lang]}</p></section>}</aside>
    </div>
  </div>;
}

export function Speak({ settings, now }: { settings: Settings; now: Date }) {
  const { unit: id } = useParams();
  const [params] = useSearchParams();
  const review = params.get("review");
  const unit = curriculum.units.find(candidate => candidate.id === id);
  const complete = useRecord<string[]>(progressKey, []);
  return unit ? <SpeakLesson key={`${unit.id}:${review ?? ""}`} unit={unit} complete={complete} settings={settings} now={now}
    reviewIndex={review && /^\d+$/.test(review) ? Number(review) : undefined} /> : <SpeakSetup complete={complete} />;
}
