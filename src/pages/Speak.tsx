import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { LocalRecorder } from "@/components/LocalRecorder";
import { useDesktop, useRecord } from "@/hooks/use-awwab";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { useCopy } from "@/lib/copy";
import { focusListItem } from "@/lib/focusListItem";
import { studyQuran, verseText } from "@/lib/hifz";
import { phraseReviewPrefix } from "@/lib/learningPaths";
import { formatQuranReference } from "@/lib/quran";
import { newReview, type ReviewGrade, type Reviews } from "@/lib/reviews";
import { finishSpeakUnit, saveLearningReview } from "@/lib/studyMilestones";
import { speakUnitKey } from "@/lib/speak-lesson-messages.mjs";
import { updateRecord, type Settings } from "@/lib/storageService";
import { defaultSpeakVariety, speakCourses, speakCourseTitle, speakCourseVariety, speakGoals, speakGoalsKey, speakLessonContent, speakLessonPath, speakLevelLabels,
  speakLevels, speakPackDetails, speakPacks, speakProgressKey, speakSetupPath, speakUnit, speakUnitNumber, speakVarieties, speakVarietyKey, speakVarietyLabels,
  type SpeakCourse, type SpeakLevel, type SpeakPack, type SpeakUnit, type SpeakVariety, type SpeakWord } from "@/lib/speakCurriculum";
import { askHomePath, askMeaning, askPhrase, askPhrasePath } from "@/lib/umrahAsk";
import { splitArabicWords } from "@/lib/wordAnatomy";

const steps = ["speakListen", "speakWords", "speakRepeat", "speakTurn", "speakSign"];
const goalDefaults = ["speakUmrah"];

function UnitList({ active, complete, level, variety }: { active?: string; complete: string[]; level: SpeakCourse; variety: SpeakVariety }) {
  const { t } = useCopy();
  const units = speakCourses[variety][level];
  const label = t(speakLevelLabels[level]);
  return <section className="card speak-unit-list" aria-label={label}>
    <header className="row-between"><h2>{speakPackDetails[level] ? active ? label : t("speakPackLessons") : `${level} · ${label}`}</h2>
      <span className="small muted">{t("speakUnits", { count: units.length })}</span></header>
    <ol onKeyDown={focusListItem}>{units.map(unit => <li key={unit.id}><Link to={speakLessonPath(unit.id)} aria-current={active === unit.id ? "page" : undefined}>
      <span>{t(speakUnitKey(unit.id, "title"))}</span>{complete.includes(unit.id) && <span aria-label={t("pathsDone")}>✓</span>}
    </Link></li>)}</ol>
  </section>;
}

function SpeakSetup({ complete, level, variety }: { complete: string[]; level: SpeakLevel; variety: SpeakVariety }) {
  const { t } = useCopy();
  const selected = useRecord(speakGoalsKey, goalDefaults);
  const [error, setError] = useState(false);
  const [changingVariety, setChangingVariety] = useState(false);
  const navigate = useNavigate();
  const courses = speakCourses[variety];
  async function chooseVariety(next: SpeakVariety) {
    setError(false);
    setChangingVariety(true);
    try {
      await updateRecord(speakVarietyKey, defaultSpeakVariety, () => next);
      navigate(speakSetupPath(speakCourses[next][level] ? level : "A1", next));
    } catch { setError(true); }
    finally { setChangingVariety(false); }
  }
  return <div className="paths-page speak-page speak-setup">
    <header className="hifz-heading"><Link className="hifz-back" to="/learn/paths" aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
      <div><h1>{t("pathsSpeak")}</h1><p className="small muted">{t("speakSubtitle")}</p></div></header>
    <div className="speak-setup-grid"><div className="compact-stack">
      <h2 className="caption">{t("speakVariety")}</h2>
      <div className="compact-stack" role="group" aria-label={t("speakVariety")}>
        {speakVarieties.map(id => {
          const label = speakVarietyLabels[id];
          return <button type="button" key={id} disabled={changingVariety}
            className={`card speak-variety${variety === id ? " selected" : ""}`}
            aria-pressed={variety === id} onClick={() => void chooseVariety(id)}>
            <strong>{t(label)}</strong><span className="small muted">{t(`${label}Note`)}</span>
          </button>;
        })}
        <section className="card speak-variety">
          <div className="row-between"><h3>{t("speakLater")}</h3><span className="small muted">{t("speakPending")}</span></div>
        </section>
      </div>
      <h2 className="caption">{t("speakGoal")}</h2>
      <div className="chips">{speakGoals.map(goal => <button key={goal} type="button" className={`chip ${selected.includes(goal) ? "active" : "soft"}`}
        aria-pressed={selected.includes(goal)} onClick={() => {
          setError(false);
          void updateRecord(speakGoalsKey, goalDefaults, saved => saved.includes(goal) ? saved.filter(id => id !== goal) : [...saved, goal]).catch(() => setError(true));
        }}>{t(goal)}</button>)}</div>
      {error && <p role="alert">{t("saveError")}</p>}
      <h2 className="caption">{t("speakLevels")}</h2>
      <div className="equal-row speak-levels">
        {speakLevels.filter(choice => courses[choice]).map(choice => {
          const units = courses[choice];
          const to = choice === "A1" && level === "A1" ? speakLessonPath(units[0].id) : speakSetupPath(choice, variety);
          return <Link className={`card ${choice === level ? "night" : "soft"}`} key={choice}
            to={to} aria-current={choice === level ? "true" : undefined}>
            <strong>{choice}</strong><small>{t(speakLevelLabels[choice])} · {t("speakUnits", { count: units.length })}</small>
          </Link>;
        })}
      </div>
      <h2 className="caption">{t("speakPracticePacks")}</h2>
      <div className="equal-row speak-packs">{speakPacks.map(pack =>
        <Link key={pack} className="card soft" to={speakSetupPath(pack)}><strong>{t(speakLevelLabels[pack])}</strong></Link>)}</div>
    </div><UnitList complete={complete} level={level} variety={variety} /></div>
  </div>;
}

function SpeakPackDirectory({ pack, complete }: { pack: SpeakPack; complete: string[] }) {
  const { t } = useCopy();
  const desktop = useDesktop();
  const { variety, description } = speakPackDetails[pack];
  const units = speakCourses[variety][pack];
  const count = units.filter(unit => complete.includes(unit.id)).length;
  return <div className="paths-page speak-page speak-setup">
    <header className="hifz-heading"><Link className="hifz-back" to="/learn/paths/speak" aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
      <div><h1>{t(speakLevelLabels[pack])}</h1><p className="small muted">{t(speakVarietyLabels[variety])}</p></div></header>
    <div className="speak-setup-grid">
      <section className="card compact-stack"><p>{t(description)}</p><p className="small muted">{t("pathsLessonProgress", { count, total: units.length })}</p>
        {pack === "umrah-hajj" && <Link className="action soft" to={askHomePath(desktop)}>{t("askHome")}</Link>}
      </section>
      <UnitList complete={complete} level={pack} variety={variety} />
    </div>
  </div>;
}

function RootBridge({ word, script }: { word: SpeakWord; script: Settings["script"] }) {
  const { t, locale } = useCopy();
  const [chapter, ayah, position] = word.bridge.split(":").map(Number);
  const [excerpt, setExcerpt] = useState<string>();
  const ref = `${chapter}:${ayah}`;
  const reference = formatQuranReference(ref, locale);
  useEffect(() => {
    let active = true;
    void studyQuran().then(quran => {
      const verse = quran.surahs[chapter]?.[ayah - 1];
      if (active && verse) setExcerpt(splitArabicWords(verseText(verse, script).text)[position - 1]);
    }, () => undefined);
    return () => { active = false; };
  }, [chapter, ayah, position, script]);
  return <section className="card tint speak-bridge"><div><h2 className="caption">{t("rootsSpot")}</h2>
    <p className="small">{t("speakRootFamily", { word: word.tr })}</p>
    <a className="small" href={`https://corpus.quran.com/wordmorphology.jsp?location=(${word.bridge})`} rel="noreferrer"><bdi>{reference}</bdi> · {t("rootsDictionary")}</a>
  </div>{excerpt && <ArabicText text={excerpt} compact citation={reference} verse={ref} positionOffset={position - 1} mushaf={script} words={[{ root: word.root }]} />}</section>;
}

function SpeakLesson({ unit, complete, now, settings, reviewIndex }: { unit: SpeakUnit; complete: string[]; now: Date; settings: Settings; reviewIndex?: number }) {
  const { t, language, locale } = useCopy();
  const desktop = useDesktop();
  const [step, setStep] = useState(reviewIndex === undefined ? 0 : 1);
  const [slow, setSlow] = useState(false);
  const [meanings, setMeanings] = useState(true);
  const [answer, setAnswer] = useState<number>();
  const [replyIndex, setReplyIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [queueError, setQueueError] = useState(false);
  const sequence = useRef<number>();
  const replyHeading = useRef<HTMLHeadingElement>(null);
  const { lines, words, clips } = useMemo(() => speakLessonContent(unit), [unit]);
  const meaning = (word: typeof words[number]) => word.askId ? askMeaning(askPhrase(word.askId), t) : t(word.meaningKey);
  const title = t(speakUnitKey(unit.id, "title"));
  const signMeaning = t(speakUnitKey(unit.id, "sign"));
  const count = new Intl.NumberFormat(locale);
  const simReference = formatQuranReference("94:1", locale);
  const sim = unit.id === "sim";
  const scripted = "dialogue" in unit;
  const dialogue = scripted || sim;
  const repeatLine = dialogue ? 2 : 0;
  const replyLines = unit.level === "B1" ? [2, 4] : [repeatLine];
  const reply = replyLines[replyIndex];
  const promptLine = reply - 1;
  const number = speakUnitNumber(unit);
  const partner = scripted ? t(speakUnitKey(unit.id, "partner")) : t("speakShop");
  const other = unit.level === "B1" ? replyLines[1 - replyIndex] : scripted ? 0 : lines.length - 1;
  const correctFirst = scripted && (number + replyIndex) % 2 === 0;
  const setup = speakSetupPath(unit.level, unit.variety);
  const isUmrahPack = unit.level === "umrah-hajj";
  const replyChoices = correctFirst ? [reply, other] : [other, reply];
  const bridge = words.find(word => word.bridge);
  const player = useAudioPlayback(Object.keys(clips), clips);
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
    try { await finishSpeakUnit(unit.id, now, settings.city.timeZone); }
    catch { setError(true); }
    finally { setSaving(false); }
  }

  const sign = <><h2>{t("speakSign")}</h2><ArabicText text={unit.sign} /></>;
  const wordList = <section className="card speak-words-list"><header className="row-between"><h2>{t("speakWordsInLesson")}</h2>
    <button className="text-button" type="button" disabled={queued} onClick={queueWords}>{t(queued ? "anatomyAdded" : "speakAddAll")}</button></header>
    {words.map((word, i) => {
      const gloss = meaning(word);
      return <div className="speak-word" key={word.ar}>
        <div><strong lang="en" dir="ltr">{word.tr}</strong><p className="small muted">{gloss}</p></div>
        <ArabicText text={word.ar} preserveSeparators words={sim || word.root ? [{ root: word.root, transliteration: word.tr, gloss, glossLanguage: language }] : undefined} showGlosses={false} />
        {step === 1 && <button className="icon-button" type="button" onClick={() => listen(`word-${i}`)} aria-label={t("speakHearLine", { number: i + 1 })}><DesignIcon name="speak-volume" size={14} /></button>}
      </div>;
    })}
    {queueError && <p role="alert">{t("saveError")}</p>}
  </section>;

  return <div className="paths-page speak-page speak-lesson">
    <header className="hifz-heading"><Link className="hifz-back" to={setup} aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
      <div><h1>{title}</h1><p className="small muted">{t("speakUnitLabel", { level: speakCourseTitle(unit.level, t), number, variety: t(speakVarietyLabels[unit.variety]) })}</p></div></header>
    <div className="speak-workspace">
      <div className="speak-workspace-nav"><UnitList active={unit.id} complete={complete} level={unit.level} variety={unit.variety} /></div>
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
          <div className="speak-dialogue">{lines.map((line, i) => <section className="card speak-line" data-you={!dialogue || i % 2 === 0} key={line.ar}>
            <div className="row-between"><span className="caption">{!dialogue || i % 2 === 0 ? t("speakYou") : partner}</span>
              <button className="icon-button" type="button" aria-label={t("speakHearLine", { number: i + 1 })} aria-pressed={player.playing && player.track === `line-${i}`}
                onClick={() => listen(`line-${i}`)}><DesignIcon name="speak-volume" size={14} /></button></div>
            <ArabicText text={line.ar} preserveSeparators />
            <strong className="small" lang="en">{line.tr}</strong>{meanings && <p className="muted small">{meaning(line)}</p>}
            {isUmrahPack && line.askId && <Link className="small speak-ask-link" to={askPhrasePath(line.askId, desktop)}>{t("speakOpenInAsk")}</Link>}
          </section>)}</div>
          {sim && <div className="card tint speak-bridge"><div><h2 className="caption">{t("speakRoot")}</h2><p className="small">{t("speakRootExplanation", { reference: simReference })}</p></div>
            <ArabicText text="نَشْرَحْ" compact citation={simReference} verse="94:1" positionOffset={1} words={[{ root: "ش ر ح" }]} /></div>}
          {bridge && !desktop && <RootBridge word={bridge} script={settings.script} />}
        </>}
        {step === 1 && (reviewWord ? <section className="card compact-stack"><h2>{t("speakReviewMeaning")}</h2>
          <ArabicText text={reviewWord.ar} preserveSeparators />
          {!reviewRevealed ? <button className="action light" type="button" onClick={() => setReviewRevealed(true)}>{t("speakShowMeanings")}</button> : <>
            <p>{meaning(reviewWord)}</p>
            {reviewSaved ? <Link className="action" to={speakLessonPath(unit.id)}>{t("pathsDone")}</Link> : <div className="equal-row">
              {(["forgot", "shaky", "got-it"] as const).map(grade => <button className="action light" type="button" key={grade}
                disabled={saving} onClick={() => void gradeWord(grade)}>{t(grade)}</button>)}
            </div>}</>}
          {queueError && <p role="alert">{t("saveError")}</p>}
        </section> : wordList)}
        {step === 2 && <section className="card compact-stack"><h2>{t("speakRepeat")}</h2><ArabicText text={lines[repeatLine].ar} preserveSeparators />
          <button className="action light" type="button" onClick={() => listen(`line-${repeatLine}`)}>{t(player.playing ? "askStop" : "speakListen")}</button><LocalRecorder /></section>}
        {step === 3 && <section className="card compact-stack"><h2 ref={replyHeading} tabIndex={-1}>{t(dialogue ? "speakChooseReply" : "speakChoose")}</h2>
          {replyLines.length > 1 && <p className="small muted">{t("speakReplyProgress", { number: replyIndex + 1, total: replyLines.length })}</p>}
          {dialogue ? <>
            <div className="row-between"><p className="caption">{partner}</p>
              <button className="icon-button" type="button" aria-label={t("speakHearLine", { number: promptLine + 1 })}
                onClick={() => listen(`line-${promptLine}`)}><DesignIcon name="speak-volume" size={14} /></button></div>
            <ArabicText text={lines[promptLine].ar} preserveSeparators /><p className="small muted">{meaning(lines[promptLine])}</p>
          </> : <p>{meaning(lines[reply])}</p>}
          <div className="compact-stack">{replyChoices.map((index, i) => <div className="speak-answer" key={index}>
            <ArabicText text={lines[index].ar} preserveSeparators /><button type="button" className="action light" aria-label={t("speakReply", { number: i + 1 })}
              aria-pressed={answer === index} onClick={() => setAnswer(index)}>{count.format(i + 1)}</button>
          </div>)}</div>
          {answer !== undefined && <p role="status">{t(answer === reply ? "lessonCorrect" : "speakTryAgain")}</p>}
          {answer === reply && replyIndex + 1 < replyLines.length && <button className="action" type="button" onClick={() => {
            sequence.current = undefined;
            player.element.current?.pause();
            setReplyIndex(replyIndex + 1);
            setAnswer(undefined);
            replyHeading.current?.focus();
          }}>{t("speakNextReply")}</button>}
        </section>}
        {step === 4 && <section className="card tint compact-stack">{sign}
          <div className="equal-row"><button className="action light" type="button" onClick={() => listen("sign")}>{t(player.playing ? "askStop" : "speakListen")}</button>
            <button className="action light" type="button" aria-expanded={revealed} onClick={() => setRevealed(value => !value)}>{t("speakSignMeaning")}</button></div>
          {revealed && <p>{signMeaning}</p>}
          {complete.includes(unit.id) ? <Link className="action" to={setup}>{t("pathsDone")}</Link> : <button className="action" type="button" disabled={saving} onClick={() => void finish()}>{t("speakFinish")}</button>}
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
        <p className="small muted">{unit.variety === "msa" ?
          <a href="https://huggingface.co/oddadmix/Nabra-82M-v0.1" rel="noreferrer">{t("speakFormalSpeech")}</a> : t("generatedSpeech")}</p>
      </div>
      <aside className="compact-stack speak-workspace-side">
        {step !== 1 && wordList}
        {step !== 4 && <section className="card tint compact-stack">{sign}<p className="small">{signMeaning}</p></section>}
        {bridge && desktop && step === 0 && <RootBridge word={bridge} script={settings.script} />}
      </aside>
    </div>
  </div>;
}

export function Speak({ settings, now, pack }: { settings: Settings; now: Date; pack?: SpeakPack }) {
  const { unit: id } = useParams();
  const [params] = useSearchParams();
  const review = params.get("review");
  const unit = speakUnit(id);
  const level = speakLevels.find(candidate => candidate === params.get("level")) ?? "A1";
  const preferred = useRecord(speakVarietyKey, defaultSpeakVariety);
  const requestedVariety = speakVarieties.find(candidate => candidate === params.get("variety"));
  const variety = speakCourseVariety(requestedVariety ?? preferred, level);
  const complete = useRecord<string[]>(speakProgressKey, []);
  if (pack) return <SpeakPackDirectory complete={complete} pack={pack} />;
  return unit ? <SpeakLesson key={`${unit.id}:${review ?? ""}`} unit={unit} complete={complete} settings={settings} now={now}
    reviewIndex={review && /^\d+$/.test(review) ? Number(review) : undefined} /> : <SpeakSetup complete={complete} level={level} variety={variety} />;
}
