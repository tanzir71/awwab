import { useEffect, useRef, useState } from "react";
import { ChevronRight, Check } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { LocalRecorder } from "@/components/LocalRecorder";
import { PracticeHeader } from "@/components/PracticeHeader";
import { SectionNav } from "@/components/Surface";
import { useRecord } from "@/hooks/use-awwab";
import { qaidaExamples, qaidaReviewId, qaidaRows, resolveQaidaRow } from "@/lib/qaidaPractice";
import { useCopy } from "@/lib/copy";
import { studyNames } from "@/lib/study-copy";
import { db, type Settings } from "@/lib/storageService";
import { finishQaidaLesson, momentPath, rememberQaidaPlace, saveQaidaRowReview } from "@/lib/studyMilestones";
import { qaidaGrades, type QaidaGrade, type Reviews } from "@/lib/reviews";
import { wordAnatomy } from "@/lib/wordAnatomy";
import { formatQuranReference, quranText } from "@/lib/quran";
import alphabet from "../../docs/content/arabic-letters.json";
import qaida from "../../docs/content/qaida-lessons.json";
import { TakhtiPanel } from "./Takhti";

type Lesson = typeof qaida.lessons[number];
type Drill = ReturnType<typeof wordAnatomy>["letters"][number];
const modes = ["read", "qaidaSpell", "qaidaWrite", "qaidaTest"] as const;
const toggles = ["qaidaColours", "qaidaTranslit", "qaidaBanglaNames"] as const;
const grades = { hard: "qaidaGradeHard", okay: "qaidaGradeOkay", easy: "qaidaGradeEasy" } as const;
const vowelIds = ["fatha", "kasra", "damma"];
const vowelBn = ["া", "ি", "ু"];
const desktopLessonNames: Record<number, string> = {
  9: "Practice: madd, līn, tanwīn",
  14: "Shadda with madd",
  16: "Nūn sākin & tanwīn",
  17: "Mīm sākin, qalqalah, stops",
};

function LessonList({ active, completed }: { active: number; completed: number[] }) {
  const { t, language, locale } = useCopy();
  const number = new Intl.NumberFormat(locale);
  return <aside className="card qaida-lessons" aria-label={t("qaidaLessons")}>
    <div className="row-between"><h2>{t("qaidaLessonList")}</h2><strong>{number.format(qaida.lessons.length)}</strong></div>
    {qaida.lessons.map(item => <Link key={item.n} to={`/learn/qaida/${item.n}`}
      data-complete={completed.includes(item.n)} aria-current={item.n === active ? "step" : undefined}>
      <span>{number.format(item.n)}</span>{language === "en" ? desktopLessonNames[item.n] ?? item.title : studyNames.lesson(language, item.n, item.title)}
    </Link>)}
  </aside>;
}

function LessonAudio({ audioRef, hearLabel, label, desk = false, simple = false }: {
  audioRef: string; hearLabel: string; label: string; desk?: boolean; simple?: boolean;
}) {
  const { t } = useCopy();
  const clip = useLiveQuery(() => db.audio.get(audioRef), [audioRef]);
  const player = useRef<HTMLAudioElement>(null);
  const [source, setSource] = useState("");
  const [editing, setEditing] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!clip?.blob) { setSource(""); return; }
    const url = URL.createObjectURL(clip.blob);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [clip]);

  async function hear() {
    if (!source || !player.current) {
      setEditing(value => !value);
      return;
    }
    if (playing) { player.current.pause(); return; }
    try {
      document.querySelectorAll("audio").forEach(audio => { if (audio !== player.current) audio.pause(); });
      await player.current.play();
    } catch { toast.error(t("recordingUnavailable")); }
  }

  return <div className={`qaida-audio ${simple ? "qaida-audio-simple" : ""}`}>
    <div className={simple ? undefined : "equal-row"}>
      <button className={simple ? "text-button" : desk ? "action" : "action light"} type="button"
        aria-expanded={source ? undefined : editing} onClick={() => void hear()}>
        {desk && <DesignIcon name="qaida-desk-volume" size={14} />}{playing ? t("qaidaPause") : hearLabel}
      </button>
      {!simple && <LocalRecorder key={audioRef} compact label={label} actionClass={desk ? "action soft" : "action"}
        actionLabel={t(desk ? "surahRecord" : "recordCompare")} icon={desk && <DesignIcon name="qaida-desk-headphones" size={14} />} />}
    </div>
    {source && <audio ref={player} src={source} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)} aria-label={label} />}
    {source && !simple && <button className="text-button small" type="button" aria-expanded={editing} onClick={() => setEditing(value => !value)}>{t("replaceAudio")}</button>}
    {editing && <label className="field small">{t("chooseAudioFor", { name: label })}
      <input type="file" accept="audio/*" onChange={async event => {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("audio/") || file.size > 12_000_000) { toast.error(t("audioLimit")); return; }
        try {
          await db.audio.put({ ref: audioRef, blob: file, title: file.name });
          setPlaying(false);
          setEditing(false);
        } catch { toast.error(t("audioSaveError")); }
      }} />
    </label>}
  </div>;
}

function QaidaQuiz({ lesson, maktab }: { lesson: number; maktab: boolean }) {
  const { t, language } = useCopy();
  const [answer, setAnswer] = useState<number>();
  const markOptions = ["مُ", "مِ", "مَ"];
  const options = lesson === 1 ? language === "bn" ? ["বা", "তা", "ছা"] : ["Bāʾ", "Tāʾ", "Thāʾ"]
    : lesson === 5 ? ["an", "in", "un"] : [1, 2, 3].map(count => t("letterCount", { count }));
  const correct = lesson === 1 ? 0 : lesson === 5 ? 2 : 1;
  const prompt = lesson === 1 ? "ب" : lesson === 5 ? "بٌ" : "قُلْ";
  return <section className="card qaida-quiz">
    <h2>{t(lesson === 4 ? "qaidaWhichMi" : lesson === 1 ? "whichLetter" : lesson === 5 ? "whichSound" : "howManyLetters")}</h2>
    {lesson !== 4 && <ArabicText text={prompt} compact />}
    <div className="equal-row">
      {lesson === 4 ? markOptions.map((option, i) => <div key={option} className="qaida-quiz-tile" data-current={answer === i}>
        <ArabicText text={option} selectedPosition={answer === i ? 1 : 0} onWordSelected={() => {
          if (answer === i) return;
          setAnswer(i);
          return false;
        }} />
        {answer === i && answer === correct && <DesignIcon name={`qaida-${maktab ? "maktab" : "phone"}-check`} size={16} />}
      </div>) : options.map((option, i) => <button type="button" className={`action ${answer === i ? "" : "soft"}`} key={option} aria-pressed={answer === i} onClick={() => setAnswer(i)}>{option}</button>)}
    </div>
    {answer !== undefined && <p role="status" className={answer === correct && lesson === 4 ? "sr-only" : "small"}>{t(answer === correct ? "quizCorrect" : "quizTryAgain")}</p>}
  </section>;
}

function SpotInQuran({ lesson, maktab }: { lesson: number; maktab: boolean }) {
  const { t, locale } = useCopy();
  const opening = lesson === 3;
  const verse = opening ? "2:1" : "112:1";
  const citation = t("quranChapterCitation", {
    name: t(opening ? "studySurah2" : "studySurah112"), reference: formatQuranReference(verse, locale),
  });
  return <section className="card qaida-spot">
    <div className="row-between">
      <h2><DesignIcon name={`qaida-${maktab ? "maktab" : "phone"}-sparkles`} size={18} /> {t("spotInQuran")}</h2>
      {opening ? <small><bdi>{citation}</bdi></small> : <Link className="small" to="/learn/surahs/112"><bdi>{citation}</bdi></Link>}
    </div>
    <ArabicText text={opening ? qaidaRows(3)[0][0][0] : quranText[112][0].uthmani} citation={citation} verse={verse} selectedPosition={1} />
    {lesson === 4 && <p className="small muted">{t("qaidaSpotQul")}</p>}
  </section>;
}

function banglaSound(drill: Drill, vowel: number) {
  if (vowel < 0) return drill.sound;
  const initial = drill.nameBn?.replace(/[ািীুূেৈোৌ]+$/u, "");
  return initial ? initial + vowelBn[vowel] : drill.sound;
}

function PhoneExamples({ lesson, maktab, spellStyle }: { lesson: Lesson; maktab: boolean; spellStyle: Settings["spellStyle"] }) {
  const { t, language } = useCopy();
  const [bangla, setBangla] = useState(language === "bn");
  const examples = qaidaExamples(lesson.n);
  const prefix = maktab ? "qaida-maktab" : "qaida-phone";
  const drills = examples.map(text => wordAnatomy(text).letters[0]);
  return <>
    <div className="qaida-intro">
      <h2>{lesson.n === 4 ? t("qaidaHarakatHeading") : studyNames.lesson(language, lesson.n, lesson.title)}</h2>
      <p className="muted">{lesson.n === 4 ? t("qaidaHarakatIntro") : t("lessonAbout", { name: lesson.traditional, minutes: maktab ? 3 : 5 })}</p>
    </div>
    <div className="equal-row qaida-examples" dir="rtl">{examples.map((text, i) => <div className="card" data-mark={lesson.n === 4 ? vowelIds[i] : undefined} key={text}>
      <ArabicText text={text} />
      <strong dir="auto">{language === "bn" ? drills[i].nameBn : drills[i].name}</strong>
      {drills[i].details.map(mark => <small key={mark.mark} dir="auto" className="qaida-mark-name">
        {lesson.n === 4 && <DesignIcon name={prefix + "-ellipse" + (i === 0 ? "2" : i === 1 ? "1" : "")} size={6} />}
        {language === "bn" ? mark.nameBn : [mark.name.toLowerCase(), mark.alt].filter(Boolean).join(" · ")}
      </small>)}
      {(lesson.n === 4 || lesson.n === 5) && <span dir="auto">{language === "bn" && spellStyle === "ampara-bn" && lesson.n === 4 ? banglaSound(drills[i], i) : drills[i].sound}</span>}
    </div>)}</div>
    {(lesson.n === 4 || lesson.n === 5) && <section className="card qaida-ampara-phone">
      <div className="row-between"><h2>{t("qaidaAmpara")}</h2>
        <div className="qaida-language" role="group" aria-label={t("language")}>
          <button type="button" aria-pressed={!bangla} onClick={() => setBangla(false)} lang="en">{t("qaidaEnglish")}</button>
          <button type="button" aria-pressed={bangla} onClick={() => setBangla(true)} lang="bn">{t("qaidaBangla")}</button>
        </div>
      </div>
      {examples.map((text, i) => {
        const drill = drills[i];
        const mark = drill.details[0];
        return <div className="qaida-equation-phone row-between" key={text}>
          <span lang={bangla ? "bn" : "en"}>{bangla
            ? [drill.nameBn, mark.nameBn, lesson.n === 4 ? banglaSound(drill, i) : drill.sound].join(" ")
            : `${drill.name} + ${mark.name.toLowerCase()} = ${drill.sound}`}</span>
          <ArabicText text={text} compact />
        </div>;
      })}
    </section>}
  </>;
}

function SpellEquation({ text }: { text: string }) {
  const { t, language } = useCopy();
  const drill = wordAnatomy(text).letters[0];
  const mark = drill.details[0];
  const vowel = ["َ", "ِ", "ُ"].indexOf(mark?.mark);
  return <section className="card qaida-spell-card">
    <h2>{t("qaidaAmpara")}</h2>
    <div className="qaida-spell-equation">
      <div><ArabicText text={drill.base} compact /><strong>{language === "bn" ? drill.nameBn : drill.name}</strong></div>
      {mark && <><span>+</span><div className="qaida-spell-mark">
        <ArabicText text={drill.glyph} words={[{ displayText: "ـ" + mark.mark, transliteration: mark.alt ?? mark.name }]} compact /><strong>{language === "bn" ? mark.nameBn : mark.alt ?? mark.name}</strong>
      </div></>}
      <span>=</span><div><ArabicText text={text} compact /><strong>{drill.sound}</strong></div>
    </div>
    <p className="small muted">{mark && <span lang="bn">{[drill.nameBn, mark.nameBn, banglaSound(drill, vowel)].join(" ")} · </span>}{t("qaidaIqra", { sound: drill.sound })}</p>
  </section>;
}

export function Qaida({ settings, desktop }: { settings: Settings; desktop: boolean }) {
  const { t, language, locale } = useCopy();
  const number = new Intl.NumberFormat(locale);
  const { id } = useParams();
  const current = useRecord("qaida-current", 1);
  const completed = useRecord<number[]>("qaida-complete", []);
  const lesson = qaida.lessons.find(item => item.n === Number(id));
  if (!lesson) return <div className="stack">
    <SectionNav title={t("nooraniQaida")} back="/learn" />
    {qaida.lessons.map(item => <Link key={item.n} className="list-row" to={`/learn/qaida/${item.n}`}>
      <span className="icon-box">{number.format(item.n)}</span><span><strong>{studyNames.lesson(language, item.n, item.title)}</strong><small lang="en">{item.traditional}</small></span>
      {completed.includes(item.n) ? <span className="chip soft">{t("practised")}</span> : current === item.n ? <span className="chip soft">{t("continueAction")}</span> : <ChevronRight size={18} />}
    </Link>)}
  </div>;
  return <QaidaLesson key={lesson.n} lesson={lesson} settings={settings} completed={completed} desktop={desktop} />;
}

function QaidaLesson({ lesson, settings, completed, desktop }: { lesson: Lesson; settings: Settings; completed: number[]; desktop: boolean }) {
  const { t, language } = useCopy();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const explicit = params.get("row");
  const stored = useRecord(`qaida-row-${lesson.n}`, 0);
  const rows = qaidaRows(lesson.n);
  const row = resolveQaidaRow(explicit, stored, rows.length);
  const reviews = useRecord<Reviews>("reviews", {});
  const [mode, setMode] = useState<typeof modes[number]>("read");
  const [prefs, setPrefs] = useState({ qaidaColours: true, qaidaTranslit: true, qaidaBanglaNames: true });
  const [choice, setChoice] = useState<{ row: number; word: string }>();
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(false);
  const [ratedRow, setRatedRow] = useState<number>();
  const spellTarget = useRef<HTMLElement>(null);
  const traceTarget = useRef<HTMLElement>(null);
  const activeRow = useRef<HTMLDivElement>(null);
  const isMaktab = settings.mode === "maktab";
  const finished = completed.includes(lesson.n);
  const sample = (lesson.n === 4 && row === 5 ? "رُ" : rows[row][0][0]);
  const selected = choice?.row === row ? choice.word : sample;
  const modelLetter = wordAnatomy(selected).letters[0]?.base;
  const traceLetter = alphabet.letters.find(item => item.letter === modelLetter) ?? alphabet.letters[0];
  const oldAudioRef = `qaida:${lesson.n}:${row + 1}`;
  const revisedVowelRows = lesson.n === 4 || lesson.n === 5;
  const audioRef = revisedVowelRows ? oldAudioRef + ":v2" : oldAudioRef;
  const introExercise = lesson.n === 4 && row === 0;
  const exampleAudioRef = introExercise ? "qaida:4:examples" : audioRef;
  const oldClip = useLiveQuery(() => revisedVowelRows ? db.audio.get(oldAudioRef) : undefined, [oldAudioRef, revisedVowelRows]);
  const rowLabel = t("rowLabel", { row: row + 1 });
  const gradeEntry = reviews[qaidaReviewId(lesson.n, row)]?.card.last_review;

  useEffect(() => {
    const requested = resolveQaidaRow(explicit, -1, rows.length);
    void rememberQaidaPlace(lesson.n, requested >= 0 ? requested : undefined).catch(() => toast.error(t("lessonSaveError")));
  }, [explicit, lesson.n, rows.length, t]);
  useEffect(() => {
    if (row >= 8) activeRow.current?.scrollIntoView({ block: "nearest" });
  }, [row, desktop, mode]);

  function move(index: number) {
    if (index === row) return;
    setChoice(undefined);
    setParams({ row: String(index + 1) }, { replace: true });
  }

  async function finish() {
    if (saving || finished) return;
    setSaving(true);
    try {
      const result = await finishQaidaLesson(lesson.n, new Date(), settings.city.timeZone);
      if (result) navigate(isMaktab && result.bookComplete ? momentPath("maktab", qaida.lessons.length) : momentPath("qaida", lesson.n));
    } catch { toast.error(t("lessonSaveError")); }
    finally { setSaving(false); }
  }

  async function rate(grade: QaidaGrade) {
    if (rating) return;
    setRating(true);
    try {
      await saveQaidaRowReview(lesson.n, row, grade, new Date(), settings.city.timeZone);
      setRatedRow(row);
    } catch { toast.error(t("lessonSaveError")); }
    finally { setRating(false); }
  }

  const actions = <section className="card qaida-reading-card">
    <h2>{t("qaidaReadLoud")}</h2>
    <LessonAudio key={audioRef} audioRef={audioRef} label={rowLabel} hearLabel={t("qaidaHearRow")} desk />
    {oldClip && <LessonAudio key={oldAudioRef} audioRef={oldAudioRef} label={t("qaidaEarlierRecording", { row: row + 1 })}
      hearLabel={t("qaidaEarlierRecording", { row: row + 1 })} simple />}
    <div className="equal-row qaida-grade-buttons">{(Object.keys(qaidaGrades) as QaidaGrade[]).map(grade =>
      <button type="button" key={grade} className={`action ${grade === "easy" ? "soft" : "light"}`} disabled={rating} onClick={() => void rate(grade)}>{t(grades[grade])}</button>)}
    </div>
    <p className="small muted">{t("qaidaRecordPrivate")}</p>
    {ratedRow === row && <small role="status">{t("qaidaGradeSaved")}</small>}
  </section>;

  return <div className="qaida-lesson">
    {!desktop && <><div className="qaida-phone-header">
      <PracticeHeader title={t("qaidaScreenTitle", { number: lesson.n, total: qaida.lessons.length })} back="/learn/qaida" maktab={isMaktab} />
      <progress value={lesson.n} max={qaida.lessons.length} aria-label={t("qaidaLessons")} />
    </div>
    <div className="qaida-phone">
      <PhoneExamples lesson={lesson} maktab={isMaktab} spellStyle={settings.spellStyle} />
      <section className="qaida-phone-read">
        <h2>{t("qaidaReadThese")}</h2>
        <LessonAudio key={exampleAudioRef} audioRef={exampleAudioRef} hearLabel={t("qaidaHearAll")} label={introExercise ? t("qaidaReadThese") : rowLabel} simple />
        <ArabicText text={introExercise ? "تَ تِ جُ حَ حِ دُ" : rows[row].flat().join(" ")} />
      </section>
      <QaidaQuiz lesson={lesson.n} maktab={isMaktab} />
      <SpotInQuran lesson={lesson.n} maktab={isMaktab} />
      <LessonAudio audioRef={`qaida:${lesson.n}:lesson`} hearLabel={t("qaidaHearLesson")} label={t("qaidaDesktopTitle", { number: lesson.n })} />
    </div></>}
    {desktop && <div className="qaida-workspace">
      <LessonList active={lesson.n} completed={completed} />
      <div className="qaida-center">
        <div className="card qaida-tools">
          <div className="qaida-modes" role="group" aria-label={t("qaidaModes")}>{modes.map(item =>
            <button key={item} type="button" aria-pressed={mode === item} onClick={() => {
              setMode(item);
              if (item === "qaidaWrite") traceTarget.current?.focus();
              if (item === "qaidaSpell") spellTarget.current?.focus();
            }}>{t(item)}</button>)}
          </div>
          {toggles.map(item => <button className="chip" type="button" aria-pressed={prefs[item]} key={item}
            onClick={() => setPrefs(prev => ({ ...prev, [item]: !prev[item] }))}>{t(item)}</button>)}
        </div>
        {mode === "qaidaTest" ? <><QaidaQuiz lesson={lesson.n} maktab={isMaktab} /><SpotInQuran lesson={lesson.n} maktab={isMaktab} /></> :
          <section className="card qaida-board" aria-label={t("lessonRows")} data-colour={prefs.qaidaColours}>
            <div className="qaida-board-scroll">
              {rows.map((tiles, index) => {
                const isRead = Boolean(reviews[qaidaReviewId(lesson.n, index)]?.card.last_review);
                const future = index > row;
                return <div className="qaida-row" ref={index === row ? activeRow : undefined} data-current={index === row} data-future={future} key={index}>
                  <button className="qaida-row-label" type="button" aria-pressed={index === row} onClick={() => move(index)}>
                    <strong>{t("qaidaRowNumber", { number: index + 1 })}</strong>
                    {index === row ? <span>{t("qaidaRowNow")}</span> : isRead ? <span>{t("qaidaRowRead")} <Check size={12} /></span> : null}
                  </button>
                  <div className="qaida-tiles" dir="rtl" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0,1fr))` }}>
                    {tiles.map((words, tile) => {
                      const drill = wordAnatomy(words[0]);
                      const anatomy = drill.letters[0];
                      const actual = future && words.length > 1 ? [words[0]] : words;
                      return <div className="qaida-tile" data-current={index === row && words.includes(selected)} key={tile}
                        data-mark={vowelIds[["َ", "ِ", "ُ"].indexOf(anatomy?.details[0]?.mark)]}
                        title={anatomy?.details.map(mark => language === "bn" ? mark.nameBn : mark.name).join(" · ") || undefined}>
                        <ArabicText text={actual.join(" ")} compact onWordSelected={position => {
                          if (index !== row) move(index);
                          setChoice({ row: index, word: actual[position - 1] ?? actual[0] });
                        }} showGlosses={false} />
                        {prefs.qaidaTranslit && <small dir="ltr">{drill.syllables.map(item => item.tr).join("")}</small>}
                        {prefs.qaidaBanglaNames && <small lang="bn" className="qaida-bangla-name">{anatomy?.nameBn}</small>}
                      </div>;
                    })}
                  </div>
                </div>;
              })}
            </div>
          </section>}
        <div className="qaida-aux">
          <section className="qaida-spell-focus" ref={spellTarget} tabIndex={-1}><SpellEquation text={selected} /></section>
          {actions}
        </div>
      </div>
      <TakhtiPanel letter={traceLetter} panelRef={traceTarget} />
    </div>}
    <div className="qaida-bottom">
      <div className="equal-row qaida-paging">
        <button className="action light" type="button" disabled={row === 0} onClick={() => move(row - 1)}>{t("previousRow")}</button>
        <button className="action soft" type="button" disabled={row === rows.length - 1} onClick={() => move(row + 1)}>{t("nextRow")}</button>
      </div>
      <p className="small muted qaida-row-status">{t("rowOf", { row: row + 1, total: rows.length })}{gradeEntry ? ` · ${t("qaidaRowRead")}` : ""}</p>
      {!desktop && <div className="qaida-phone-extra">{actions}<Link to="/learn/takhti/boat" className="action soft">{t("takhtiWriting")}</Link></div>}
      {finished ? <div className="equal-row">
        <Link className="action" to={lesson.n < qaida.lessons.length ? `/learn/qaida/${lesson.n + 1}` : "/learn"}>{t("continueLearning")}</Link>
        <Link className="action soft" to={momentPath("qaida", lesson.n)}>{t("shareMoment")}</Link>
      </div> : <button className="action" type="button" disabled={saving} onClick={() => void finish()}>{t("saveLesson")}</button>}
    </div>
  </div>;
}
