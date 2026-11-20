import { useEffect, useMemo, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ArabicText, type WordDetail } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { LocalRecorder } from "@/components/LocalRecorder";
import { QuranStudySources, QuranVerseMeaning } from "@/components/QuranStudySources";
import { VerseAudio } from "@/components/VerseAudio";
import { useDesktop, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { wordGlosses } from "@/lib/fluency";
import { wordGlossKey } from "@/lib/fluency-messages.mjs";
import { focusListItem } from "@/lib/focusListItem";
import { studyPhrases, studyQuran, verseText, type StudyQuran } from "@/lib/hifz";
import { quranMeaningPreferences } from "@/lib/languagePreferences";
import { coreWordKey, loadMorphology } from "@/lib/morphology";
import { formatQuranReference, knownCoreQuranWords, type QuranVerse } from "@/lib/quran";
import { indopakSplitVerses } from "@/lib/quranWordPositions";
import { completedReadingChapters, emptyReadingPractice, firstUnreadAyah, practiceChapters, practicePage, readingPortions, readingPracticePaths,
  recitationChecks, rootsFromKnownWords, teacherChecklistComplete, type PracticeMode, type ReadingMode, type ReadingPracticeProgress, type RecitationCheck } from "@/lib/readingPractice";
import { getRecord, updateSettings, type Settings } from "@/lib/storageService";
import { studyNames } from "@/lib/study-copy";
import { markReadingPortion, rememberFlowPlace, setTeacherCheck } from "@/lib/studyMilestones";
import { tajweedLessonPath, tajweedReadingRuleKey, tajweedTitleKey, tajweedVerseExamples } from "@/lib/tajweed";
import { useUi } from "@/lib/uiState";
import { splitArabicPhrase } from "@/lib/wordAnatomy";
import audioCatalogue from "../../public/packs/audio/index.json";

const modeTitles = { flow: "readingFlow", meaning: "readingMeaning", teacher: "readingTeacher" };
const tajweedRuleLabels = {
  joining: "readingTajweedJoinedRule", continuing: "readingTajweedContinuedRule", stopping: "readingTajweedStoppedRule",
} as const;
const meaningSteps = ["readingWordStep", "readingPhraseStep", "readingMeaningStep"] as const;
const emptyKeys: string[] = [];
const ayahNumber = (verse: QuranVerse) => Number(verse.ref.split(":")[1]);
type Chapter = (typeof practiceChapters.flow)[number];
type Corpus = Awaited<ReturnType<typeof loadMorphology>>;
type MeaningStep = (typeof meaningSteps)[number];

function ReadingHeading({ title, subtitle, back }: { title: string; subtitle?: string; back: string }) {
  const { t } = useCopy();
  return <header className="hifz-heading">
    <Link className="hifz-back" to={back} aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
    <div><h1>{title}</h1>{subtitle && <p className="small muted">{subtitle}</p>}</div>
  </header>;
}

function ChapterDirectory({ mode, progress, selected, openReader }: {
  mode: PracticeMode; progress: ReadingPracticeProgress; selected?: number; openReader?: () => void;
}) {
  const { language, t, locale } = useCopy();
  const { state } = useLocation();
  const overview = mode === "teacher" ? t("readingPreparedCount", { count: Object.values(progress.teacher).filter(teacherChecklistComplete).length })
    : t("readingSurahsProgress", { count: completedReadingChapters(mode, progress), total: practiceChapters[mode].length });
  const number = new Intl.NumberFormat(locale);
  return <nav className="card reading-directory" aria-label={t("readingChapters")}>
    <header className="row-between"><h2>{t(mode === "teacher" ? "readingChapters" : "readingShortFirst")}</h2><small className="muted">{overview}</small></header>
    <ul className="reading-directory-list" onKeyDown={focusListItem}>{practiceChapters[mode].map(chapter => {
      const read = mode === "teacher" ? [] : progress[mode][chapter.number] ?? [];
      const complete = mode === "teacher" ? teacherChecklistComplete(progress.teacher[chapter.number]) : new Set(read).size >= chapter.ayahs;
      const resume = mode === "teacher" ? undefined : firstUnreadAyah(chapter.ayahs, read);
      return <li key={chapter.number}><Link to={practicePage(mode, chapter.number, resume)} state={state}
        aria-current={selected === chapter.number ? "page" : undefined} onClick={event => {
          if (selected === chapter.number && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) openReader?.();
        }}>
        <span className="caption">{number.format(chapter.number)}</span><strong>{studyNames.surah(language, chapter.number, chapter.title)}</strong>
        <small className="muted">{complete ? t("pathsDone") : mode !== "teacher" && read.length ? t("readingAyahsProgress", { count: new Set(read).size, total: chapter.ayahs }) : t("hifzAyahs", { count: chapter.ayahs })}</small>
      </Link></li>;
    })}</ul>
  </nav>;
}

function ScriptSwitch({ script, change }: { script: Settings["script"]; change: (script: Settings["script"]) => void }) {
  const { t } = useCopy();
  function selectScript(next: Settings["script"]) {
    if (next === script) return;
    useUi.getState().selectWord();
    change(next);
  }
  return <div className="reading-toolbar row-between">
    <span className="small muted">{t("readingScript")}</span>
    <div className="equal-row study-tabs" role="group" aria-label={t("readingScript")}>
      <button type="button" className="chip" aria-pressed={script === "indopak"} onClick={() => selectScript("indopak")}>{t("readingIndopak")}</button>
      <button type="button" className="chip" aria-pressed={script === "uthmani"} onClick={() => selectScript("uthmani")}>{t("readingUthmani")}</button>
    </div>
  </div>;
}

function ReadingTimer() {
  const { t, locale } = useCopy();
  const [start, setStart] = useState<number>();
  const [elapsed, setElapsed] = useState<number>();
  useEffect(() => {
    if (start === undefined) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((performance.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [start]);
  const minutes = new Intl.NumberFormat(locale);
  const seconds = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });
  return <div className="reading-toolbar row-between">
    <button type="button" className="text-button" onClick={() => {
      if (start === undefined) { setElapsed(0); setStart(performance.now()); }
      else { setElapsed(Math.floor((performance.now() - start) / 1000)); setStart(undefined); }
    }}>{t(start === undefined ? "readingTimerStart" : "readingTimerStop")}</button>
    {elapsed !== undefined && <p className="small muted" aria-live="off">{t("readingTimerElapsed", { time: `${minutes.format(Math.floor(elapsed / 60))}:${seconds.format(elapsed % 60)}` })}</p>}
  </div>;
}

function TajweedExamplesToggle({ enabled, pageHasExamples }: { enabled: boolean; pageHasExamples: boolean }) {
  const { t } = useCopy();
  const [error, setError] = useState(false);
  return <div className="compact-stack reading-tajweed">
    <button type="button" className="chip" aria-pressed={enabled} onClick={async () => {
      setError(false);
      try {
        await updateSettings({ tajweedHighlights: !enabled });
        if (enabled && useUi.getState().word?.annotation?.lessons) useUi.getState().selectWord();
      } catch { setError(true); }
    }}>{t("readingTajweedHighlights")}</button>
    {enabled && <p className="small muted">{t(pageHasExamples ? "readingTajweedHint" : "readingTajweedNoExamples")}</p>}
    {error && <p className="small" role="alert">{t("saveError")}</p>}
  </div>;
}

function ReadingVerse({ verse, script, settings, step, corpus, knownRoots, english = false, tajweed = false }: {
  verse: QuranVerse; script: Settings["script"]; settings: Settings; step?: MeaningStep; corpus?: Corpus;
  knownRoots?: ReadonlySet<string>; english?: boolean; tajweed?: boolean;
}) {
  const { t, language, locale, quranWordGloss } = useCopy();
  const { opening, text } = verseText(verse, script);
  const rendered = step === "readingWordStep" ? text : studyPhrases(verse, script, true);
  const words: WordDetail[] | undefined = step === "readingWordStep"
    ? splitArabicPhrase(rendered).filter(part => part.word).map((_part, index) => {
      const meaning = quranWordGloss(verse.ref, index + 1, script);
      const row = script === "indopak" && indopakSplitVerses.has(verse.ref) ? undefined : corpus?.positions.get(`${verse.ref}:${index + 1}`);
      if (!row) return meaning ?? {};
      const key = coreWordKey(row).slice(5);
      const familiar = row.root && knownRoots?.has(row.root);
      const fallback = wordGlosses[key] ? { gloss: t(wordGlossKey(key)), glossLanguage: language } : undefined;
      return { root: row.root, ...(meaning ?? fallback),
        annotation: familiar ? { tone: "soft", label: t("readingKnownRoot") } : undefined };
    }) : tajweed ? tajweedVerseExamples(verse, script)?.map(notes => {
      const lessons = notes.map(note => ({
        title: t(note.condition ? tajweedRuleLabels[note.condition] : "readingTajweedRule", {
          lesson: t(tajweedTitleKey(note.lesson)), rule: t(tajweedReadingRuleKey(note)),
        }),
        to: tajweedLessonPath(note.lesson),
      }));
      const label = lessons.map(lesson => lesson.title).join(" · ");
      return { annotation: { tone: notes[0].tone, label, lessons } };
    }) : undefined;

  return <article className="card compact-stack hifz-verse reading-verse">
    <bdi className="caption muted">{formatQuranReference(verse.ref, locale)}</bdi>
    {opening && <ArabicText text={opening} citation="1:1" verse="1:1" mushaf={script} preserveSeparators />}
    <ArabicText text={rendered} citation={verse.ref} verse={verse.ref} mushaf={script} words={words} preserveSeparators />
    {step === "readingMeaningStep" && <QuranVerseMeaning verse={verse} settings={settings} english={english} />}
  </article>;
}

function GuidedRead({ chapter, title, mode, quran, progress, settings, now }: {
  chapter: Chapter; title: string; mode: ReadingMode; quran: StudyQuran; progress: ReadingPracticeProgress; settings: Settings; now: Date;
}) {
  const { t } = useCopy();
  const [params] = useSearchParams();
  const { state } = useLocation();
  const [script, setScript] = useState(settings.script);
  const [step, setStep] = useState<MeaningStep>("readingWordStep");
  const [revealEnglish, setRevealEnglish] = useState(false);
  const [corpus, setCorpus] = useState<Corpus>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ page: number; message: string }>();
  const familiarWords = useRecord<string[]>("word-bank-known", emptyKeys);
  const familiarVerses = useRecord<string[]>("words-known", emptyKeys);
  const roots = useMemo(() => corpus && rootsFromKnownWords(corpus.vocabulary, knownCoreQuranWords(familiarVerses, familiarWords)),
    [corpus, familiarVerses, familiarWords]);
  const portions = useMemo(() => readingPortions(chapter.number, quran, settings.mode === "maktab"), [chapter.number, quran, settings.mode]);
  const read = progress[mode][chapter.number] ?? [];
  const query = params.get("ayah");
  // A save updates the directory and progress text. The reader stays on the same page until the user moves.
  const [initialAyah] = useState(() => firstUnreadAyah(chapter.ayahs, read));
  const requested = /^\d+$/.test(query ?? "") && Number(query) >= 1 && Number(query) <= chapter.ayahs ? Number(query) : initialAyah;
  useEffect(() => {
    if (mode === "flow") void rememberFlowPlace({ chapter: chapter.number, ayah: requested }).catch(() => {});
  }, [chapter.number, mode, requested]);
  const pageIndex = Math.max(0, portions.findIndex(portion => portion.verses.some(verse => ayahNumber(verse) === requested)));
  const portion = portions[pageIndex];
  const previous = portions[pageIndex - 1];
  const next = portions[pageIndex + 1];
  const nextChapter = practiceChapters[mode][practiceChapters[mode].indexOf(chapter) + 1];
  const ayahs = portion.verses.map(ayahNumber);
  const saved = ayahs.every(ayah => read.includes(ayah));
  const english = quranMeaningPreferences(settings).english || revealEnglish;
  const tajweed = mode === "flow" && settings.tajweedHighlights === true;

  useEffect(() => {
    if (mode !== "meaning") return;
    let active = true;
    void loadMorphology().then(data => { if (active) setCorpus(data); }, () => undefined);
    return () => { active = false; };
  }, [mode]);
  useEffect(() => { window.scrollTo(0, 0); }, [pageIndex]);

  async function save() {
    if (saving || saved) return;
    setSaving(true);
    setNotice(undefined);
    try { await markReadingPortion(mode, chapter.number, ayahs, now, settings.city.timeZone); setNotice({ page: pageIndex, message: "readingSavedAyahs" }); }
    catch { setNotice({ page: pageIndex, message: "saveError" }); }
    finally { setSaving(false); }
  }

  return <section className="compact-stack reading-main" aria-label={title}>
    <div className="card compact-stack reading-controls">
      <p className="small muted">{t("readingAyahsProgress", { count: new Set(read).size, total: chapter.ayahs })}</p>
      <ScriptSwitch script={script} change={setScript} />
      {mode === "flow" && <ReadingTimer key={pageIndex} />}
      {mode === "flow" && quran.surahs[chapter.number].some(verse => tajweedVerseExamples(verse, script)) &&
        <TajweedExamplesToggle enabled={tajweed} pageHasExamples={portion.verses.some(verse => tajweedVerseExamples(verse, script))} />}
      {mode === "meaning" && <>
        <div className="equal-row study-tabs" role="group" aria-label={t("readingMeaning")}>
          {meaningSteps.map(option => <button type="button" className="chip" key={option} aria-pressed={step === option} onClick={() => setStep(option)}>{t(option)}</button>)}
        </div>
        {step !== "readingMeaningStep" && <p className="small muted">{t(step === "readingWordStep" ? "readingWordHint" : "readingPhraseHint")}
          {step === "readingWordStep" && Boolean(roots?.size) && <> {t("readingKnownRootHint")}</>}</p>}
        {step === "readingMeaningStep" && !english && <button className="text-button justify-self-start" type="button"
          onClick={() => setRevealEnglish(true)}>{t("readingShowEnglish")}</button>}
      </>}
    </div>
    {portion.verses.map(verse => <ReadingVerse key={verse.ref} verse={verse} script={script} settings={settings} step={mode === "meaning" ? step : undefined}
      corpus={corpus} knownRoots={roots} english={english} tajweed={tajweed} />)}
    <button type="button" className="action" disabled={saving || saved} onClick={() => void save()}>{t(saved ? "readingSavedAyahs" : "readingSaveAyahs")}</button>
    {notice?.page === pageIndex && <p className="small muted" role={notice.message === "saveError" ? "alert" : "status"}>{t(notice.message)}</p>}
    <div className="equal-row">
      {previous && <Link className="action light" state={state} to={practicePage(mode, chapter.number, ayahNumber(previous.verses[0]))}>{t("readingPrevAyahs")}</Link>}
      <Link className="action light" state={state} to={next ? practicePage(mode, chapter.number, ayahNumber(next.verses[0])) : nextChapter ? practicePage(mode, nextChapter.number) : readingPracticePaths[mode]}>
        {t(next ? "readingNextAyahs" : nextChapter ? "readingNextSurah" : "readingChapters")}</Link>
    </div>
    <QuranStudySources script={script} morphology={Boolean(corpus && step === "readingWordStep")} wordMeanings={mode === "meaning" && step === "readingWordStep"} />
  </section>;
}

function TeacherPractice({ chapter, title, verses, checks, settings, now, suspended }: {
  chapter: Chapter; title: string; verses: QuranVerse[]; checks?: RecitationCheck[]; settings: Settings; now: Date; suspended: boolean;
}) {
  const { t } = useCopy();
  const [script, setScript] = useState(settings.script);
  const [error, setError] = useState(false);
  const reference = `surah:${chapter.number}`;
  const hasPack = audioCatalogue.packs.some(pack => pack.items.some(item => item.ref === reference));
  const prepared = teacherChecklistComplete(checks);
  const hasExamples = verses.some(verse => tajweedVerseExamples(verse, script));
  const tajweed = settings.tajweedHighlights === true;

  async function check(item: RecitationCheck, value: boolean) {
    setError(false);
    try { await setTeacherCheck(chapter.number, item, value, now, settings.city.timeZone); }
    catch { setError(true); }
  }

  return <section className="compact-stack reading-main" aria-label={title}>
    <div className="compact-stack reading-teacher-tools">
      <div className="card compact-stack reading-controls">
        <p className="small muted">{t("readingRecorderHint")}</p>
        <VerseAudio audioRef={reference} label={title} showAttribution suspended={suspended} />
        {hasPack && <Link className="text-button justify-self-start" to={`/you/audio?surah=${chapter.number}&from=teacher`}>{t("offlineAudio")}</Link>}
        <LocalRecorder label={title} maxSeconds={900} suspended={suspended} />
      </div>
      <fieldset className="card reading-checklist">
        <legend className="sr-only">{t("readingChecklist")}</legend><h2>{t("readingChecklist")}</h2>
        {recitationChecks.map(item => <label key={item} className="reading-checkbox">
          <input type="checkbox" checked={checks?.includes(item) ?? false} onChange={event => void check(item, event.currentTarget.checked)} />
          <span>{t(`readingCheck-${item}`)}</span>
        </label>)}
        {prepared && <p className="small muted" role="status">{t("readingChecklistReady")}</p>}
        {error && <p className="small" role="alert">{t("saveError")}</p>}
        <Link className="text-button justify-self-start" to="/learn/paths/read/3/lessons">{t("tajweedLessons")}</Link>
      </fieldset>
    </div>
    <div className="card reading-controls compact-stack">
      <ScriptSwitch script={script} change={setScript} />
      {hasExamples && <TajweedExamplesToggle enabled={tajweed} pageHasExamples />}
    </div>
    {verses.map(verse => <ReadingVerse key={verse.ref} verse={verse} script={script} settings={settings} tajweed={tajweed} />)}
    <QuranStudySources script={script} />
  </section>;
}

function ChapterWorkspace({ chapter, mode, progress, settings, now }: {
  chapter: Chapter; mode: PracticeMode; progress: ReadingPracticeProgress; settings: Settings; now: Date;
}) {
  const { t, language, direction } = useCopy();
  const { state } = useLocation();
  const desktop = useDesktop();
  const wide = useDesktop(1280);
  const compactDesktop = desktop && !wide;
  const [tab, setTab] = useState("reader");
  const readerTab = useRef<HTMLButtonElement>(null);
  const [quran, setQuran] = useState<StudyQuran>();
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const title = studyNames.surah(language, chapter.number, chapter.title);
  useEffect(() => {
    let active = true;
    void studyQuran().then(data => { if (active) setQuran(data); }, () => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [attempt]);
  const verses = quran?.surahs[chapter.number];
  const reader = !verses?.length ? <section className="card compact-stack"><p className="small muted" role="status">{t(loadError ? "hifzUnavailable" : "hifzLoading")}</p>
    {loadError && <button className="action light" type="button" onClick={() => { setLoadError(false); setAttempt(value => value + 1); }}>{t("pathsCheckAgain")}</button>}
  </section> : mode === "teacher"
    ? <TeacherPractice chapter={chapter} title={title} verses={verses} checks={progress.teacher[chapter.number]} settings={settings}
      now={now} suspended={compactDesktop && tab !== "reader"} />
    : <GuidedRead chapter={chapter} title={title} mode={mode} quran={quran} progress={progress} settings={settings} now={now} />;
  const directory = desktop && <ChapterDirectory mode={mode} progress={progress} selected={chapter.number} openReader={compactDesktop ? () => {
    setTab("reader");
    readerTab.current?.focus();
  } : undefined} />;

  return <>
    <ReadingHeading title={title} subtitle={t(modeTitles[mode])}
      back={mode === "flow" && state?.from === "haram-focus" ? "/umrah/focus" : readingPracticePaths[mode]} />
    {compactDesktop ? <Tabs.Root className="workspace-tabs" dir={direction} value={tab} onValueChange={setTab}>
      <Tabs.List className="study-tabs equal-row" aria-label={title}>
        <Tabs.Trigger value="reader" ref={readerTab}>{t(mode === "teacher" ? "practise" : "surahReader")}</Tabs.Trigger>
        <Tabs.Trigger value="chapters">{t("readingChapters")}</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content className="reading-practice-tab" value="reader" forceMount>{reader}</Tabs.Content>
      <Tabs.Content className="reading-chapters-tab" value="chapters">{directory}</Tabs.Content>
    </Tabs.Root> : <div className="reading-active-grid">{directory}{reader}</div>}
  </>;
}

export function ReadingPractice({ mode, settings, now }: { mode: PracticeMode; settings: Settings; now: Date }) {
  const { t } = useCopy();
  const { chapter } = useParams();
  const progress = useLiveQuery(() => getRecord("reading-practice", emptyReadingPractice));
  const selected = practiceChapters[mode].find(item => String(item.number) === chapter);
  return <div className="paths-page reading-workspace" data-mode={mode}>
    {selected && progress ? <ChapterWorkspace key={`${mode}:${selected.number}`} chapter={selected} mode={mode}
      progress={progress} settings={settings} now={now} /> : selected ? <p role="status">{t("hifzLoading")}</p> : <>
      <ReadingHeading title={t(modeTitles[mode])} back={mode === "meaning" ? "/learn/paths/understand" : "/learn/paths/read"} />
      <p className="small muted">{t(`${modeTitles[mode]}Hint`)}</p>
      <ChapterDirectory mode={mode} progress={progress ?? emptyReadingPractice} />
    </>}
  </div>;
}
