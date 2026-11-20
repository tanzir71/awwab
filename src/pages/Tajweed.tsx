import { useEffect, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { LocalRecorder } from "@/components/LocalRecorder";
import { QuranStudySources } from "@/components/QuranStudySources";
import { StudyText } from "@/components/StudyText";
import { useDesktop } from "@/hooks/use-awwab";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { asset } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { focusListItem } from "@/lib/focusListItem";
import { studyQuran, verseText } from "@/lib/hifz";
import { pathUrl } from "@/lib/learningPaths";
import { formatQuranReference, quranText } from "@/lib/quran";
import type { Reviews } from "@/lib/reviews";
import { getRecord, type Settings } from "@/lib/storageService";
import { saveLearningReview } from "@/lib/studyMilestones";
import { correctTajweedSamples, tajweedClip, tajweedDepthIndex, tajweedDepthLessons, tajweedExcerpt, tajweedIndex, tajweedIntroKey, tajweedLessonPath, tajweedLessons,
  tajweedLessonSources, tajweedPracticeSamples, tajweedReference, tajweedReviewId, tajweedSampleKey, tajweedTitleKey, tajweedTones as tones, type TajweedLesson, type TajweedSample } from "@/lib/tajweed";

const scripts = [["indopak", "readingIndopak"], ["uthmani", "readingUthmani"]] as const;

function LessonList({ lessons, reviews, current }: { lessons: readonly TajweedLesson[]; reviews: Reviews; current?: string }) {
  const { t, locale } = useCopy();
  const number = new Intl.NumberFormat(locale);
  return <ol className="paths-level-list" onKeyDown={focusListItem}>{lessons.map((lesson, index) => {
    const count = correctTajweedSamples(lesson, reviews);
    const done = count === lesson.samples.length;
    const active = lesson.id === current;
    const state = active ? "current" : done ? "done" : "open";
    const card = <><strong>{t(tajweedTitleKey(lesson.id))}</strong>
      <small>{t("tajweedExamplesProgress", { count, total: lesson.samples.length })}</small></>;
    return <li key={lesson.id}>
      <span className="paths-level-number" data-state={state} aria-hidden="true">
        {done ? <DesignIcon name="paths-phone-check" size={16} /> : number.format(index + 1)}
      </span>
      {active ? <div className="card paths-level-mobile" data-state={state} aria-current="page">{card}</div> :
        <Link className="card paths-level-mobile" to={tajweedLessonPath(lesson.id)} data-state={state}>{card}</Link>}
    </li>;
  })}</ol>;
}

function TajweedHeading({ title, back, depth }: { title: string; back: string; depth: boolean }) {
  const { t } = useCopy();
  return <header className="hifz-heading">
    <Link className="hifz-back" to={back} aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
    <div><h1>{t(depth ? "tajweedDepthTitle" : "tajweedTitle")}</h1><p className="small muted">{title}</p></div>
  </header>;
}

function ArticulationPoints({ regions }: { regions: NonNullable<TajweedLesson["articulation"]> }) {
  const { t, language } = useCopy();
  return <details className="card compact-stack tajweed-articulation">
    <summary>{t("tajweedArticulationPoints")}</summary>
    {Object.entries(regions).map(([region, points]) => <section key={region} className="compact-stack">
      <h2>{t(`tajweedRule-${region}`)}</h2>
      <ul>{points.map(point => <li key={point.letters}><span>{point.name[language === "bn" ? 1 : 0]}</span><ArabicText text={point.letters} compact /></li>)}</ul>
    </section>)}
  </details>;
}

function RuleLesson({ settings, now, lesson, reviews, depth, nextLesson, practice, requested }: {
  settings: Settings; now: Date; lesson: TajweedLesson; reviews: Reviews; depth: boolean; nextLesson?: TajweedLesson;
  practice: boolean; requested?: TajweedSample;
}) {
  const { t, locale, direction } = useCopy();
  const desktop = useDesktop();
  const wide = useDesktop(1280);
  const compactDesktop = desktop && !wide;
  const [tab, setTab] = useState("lesson");
  const suspended = compactDesktop && tab !== "lesson";
  const route = tajweedLessonPath(lesson.id);
  const overview = depth ? tajweedDepthIndex : tajweedIndex;
  const overviewLabel = depth ? "tajweedDepthIndex" : "tajweedLessons";
  const compareScripts = lesson.id === "mushaf-marks";
  const script = lesson.id === "waqf" ? "uthmani" : settings.script;
  const includesReading = !depth && !requested;
  const [verses, setVerses] = useState(quranText);
  const [loadError, setLoadError] = useState(false);
  const [selection, setSelection] = useState<string>();
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [readAloudComplete, setReadAloudComplete] = useState(false);
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const [samples] = useState(() => requested ? [requested] : tajweedPracticeSamples(lesson, reviews, settings.mode === "maktab"));
  const practiceCount = tajweedPracticeSamples(lesson, reviews, settings.mode === "maktab").length;
  const example = samples[index];
  const readAloud = practice && !example && includesReading && !readAloudComplete;
  const rules = Object.keys(lesson.rules);
  const sources = Object.fromEntries(lesson.samples.flatMap(sample => {
    const clip = tajweedClip(sample);
    return clip ? [[clip.ref, asset(clip.path)]] : [];
  }));
  const exampleRefs = Object.keys(sources);
  const player = useAudioPlayback(exampleRefs, sources);
  const { pause } = player;
  const activeRef = practice && example && !player.playing ? tajweedReference(example) : player.track ?? exampleRefs[0];
  const activeSample = lesson.samples.find(sample => tajweedReference(sample) === activeRef);
  const recording = activeSample && tajweedClip(activeSample);
  const totalCorrect = correctTajweedSamples(lesson, reviews);
  const credits = tajweedLessonSources(lesson, depth);

  useEffect(() => {
    let active = true;
    void studyQuran().then(data => { if (active) setVerses(data.surahs); }, () => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (practice && !example) stageHeading.current?.focus();
  }, [practice, example, readAloud]);
  useEffect(() => { if (suspended) pause(); }, [pause, suspended]);

  function excerpt(sample: TajweedSample, showAnswer: boolean, script: Settings["script"]) {
    const verse = verses[sample.chapter]?.[sample.ayah - 1];
    if (!verse) return <p className="small muted" role="status">{t(loadError ? "hifzUnavailable" : "hifzLoading")}</p>;
    const pauses = lesson.id === "waqf" || sample.rule === "script-pair";
    const { text } = verseText(verse, script);
    const shown = tajweedExcerpt(text, sample, pauses);
    const annotation = {
      tone: showAnswer ? tones[rules.indexOf(sample.rule) % tones.length] : "neutral" as const,
      label: t(showAnswer ? `tajweedRule-${sample.rule}` : "tajweedHighlightedWord"),
    };
    const words = Array.from({ length: sample.last - sample.first + 1 }, () => ({ annotation }));
    return <ArabicText text={shown} citation={verse.ref} verse={verse.ref} mushaf={script} positionOffset={sample.first - 1} words={words} />;
  }

  function exampleText(sample: TajweedSample, showAnswer = true) {
    if (!compareScripts) return excerpt(sample, showAnswer, script);
    return <div className="tajweed-script-compare">
      {scripts.map(([script, label]) => <div key={script}><span className="caption muted">{t(label)}</span>{excerpt(sample, showAnswer, script)}</div>)}
    </div>;
  }

  async function answer(rule: string) {
    if (saving || selection || !example) return;
    setSaving(true);
    setSaveError(false);
    try {
      await saveLearningReview(tajweedReviewId(lesson, example), rule === example.rule ? "got-it" : "forgot", now, settings.city.timeZone);
      setSelection(rule);
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  const content = <div className="paths-page tajweed-main">
    {player.error && <p role="status">{t("surahAudioError")}</p>}
    {!practice ? <>
      <p className="muted"><StudyText text={t(tajweedIntroKey(lesson.id))} /></p>
      <div className="tajweed-grid">{rules.map((rule, i) => {
        const sample = lesson.samples.find(item => item.rule === rule)!;
        const letters = lesson.rules[rule];
        return <section className="card tajweed-rule" data-tone={tones[i % tones.length]} key={rule}>
          <div><h2>{t(`tajweedRule-${rule}`)}</h2><p className="small muted"><StudyText text={t(`tajweedHint-${rule}`)} /></p></div>
          <div className="tajweed-example">{exampleText(sample)}<bdi className="caption muted">{formatQuranReference(tajweedReference(sample), locale)}</bdi></div>
          {sample.target && <div className="tajweed-focus"><span className="caption">{t("tajweedFocusLetter")}</span><ArabicText text={sample.target} compact /></div>}
          {letters && <div className="tajweed-letters"><span className="caption">{t("letters")}</span><ArabicText text={letters} compact /></div>}
        </section>;
      })}</div>
      <div className="equal-row">
        {exampleRefs.length > 0 && <button className="action light" type="button" onClick={() => player.play(player.track ?? exampleRefs[0])}>
          {t(player.playing ? "setupPause" : "tajweedHear")}</button>}
        <Link className="action" to={`${route}?practice`}>{t("tajweedPractice", { count: practiceCount })}</Link>
      </div>
      {exampleRefs.length > 0 ? <div className="chips">{exampleRefs.map(ref => <button type="button" key={ref} className="chip soft"
        aria-pressed={player.playing && player.track === ref} onClick={() => player.play(ref)}><bdi>{formatQuranReference(ref, locale)}</bdi></button>)}</div>
        : <p className="small muted">{t("tajweedPendingAudio")}</p>}
      {lesson.articulation && <ArticulationPoints regions={lesson.articulation} />}
      {!desktop && <Link className="action light" to={overview}>{t(overviewLabel)}</Link>}
    </> : example ? <section className="card compact-stack paths-question">
      <p className="caption">{t("pathsCheckQuestion", { number: index + 1, total: samples.length })} · <bdi>{formatQuranReference(tajweedReference(example), locale)}</bdi></p>
      <h2>{t(depth ? `tajweedQuestion-${lesson.id}` : lesson.id === "waqf" ? "tajweedDrillMark" : "tajweedChoose")}</h2>
      {example.target && <div className="tajweed-focus"><span className="caption">{t("tajweedFocusLetter")}</span><ArabicText text={example.target} compact /></div>}
      {exampleText(example, Boolean(selection))}
      {tajweedClip(example) ? <button className="action light" type="button" onClick={() => player.play(tajweedReference(example))}>
        {t(player.playing ? "setupPause" : "tajweedHearVerse")}</button> :
        depth && <p className="small muted">{t("tajweedPendingAudio")}</p>}
      <div className="tajweed-options">{rules.map(rule => <button type="button" className="action light" key={rule}
        disabled={saving || Boolean(selection) || !verses[example.chapter]} aria-pressed={selection === rule} onClick={() => void answer(rule)}>{t(`tajweedRule-${rule}`)}</button>)}</div>
      {saveError && <p role="alert">{t("saveError")}</p>}
      {selection && <div className="compact-stack" key={tajweedSampleKey(example)}>
        <p role="status">{t("tajweedFeedback", { rule: t(`tajweedRule-${example.rule}`) })}</p>
        {depth && <p className="small muted"><StudyText text={t(`tajweedHint-${example.rule}`)} /></p>}
        {!includesReading && <LocalRecorder suspended={suspended} />}
        <button className="action" type="button" onClick={() => { player.pause(); setSelection(undefined); setIndex(index + 1); }}>
          {t(index + 1 < samples.length ? "hifzNext" : includesReading ? "tajweedReadAloud" : "pathsDone")}</button>
      </div>}
    </section> : readAloud ? <section className="compact-stack" aria-labelledby="tajweed-read-aloud">
      <h2 className="tajweed-stage-heading" id="tajweed-read-aloud" tabIndex={-1} ref={stageHeading}>{t("tajweedReadAloud")}</h2>
      <p className="small muted">{t("tajweedReadAloudHint")}</p>
      <ol className="tajweed-grid tajweed-read-list" role="list">{samples.map(sample => {
        const ref = tajweedReference(sample);
        const citation = formatQuranReference(ref, locale);
        const playing = player.track === ref && player.playing;
        return <li className="card compact-stack tajweed-read-example" key={tajweedSampleKey(sample)}>
          <header className="row-between">
            <h3>{t(`tajweedRule-${sample.rule}`)}</h3>
            <bdi className="caption muted">{citation}</bdi>
          </header>
          {exampleText(sample)}
          {tajweedClip(sample) && <button type="button" className="action light" onClick={() => player.play(ref)}>
            {t(playing ? "setupPause" : "tajweedHearVerse")} <bdi className="sr-only">{citation}</bdi>
          </button>}
        </li>;
      })}</ol>
      <LocalRecorder maxSeconds={settings.mode === "maktab" ? 30 : 90} suspended={suspended} />
      <button className="action" type="button" onClick={() => {
        player.pause();
        setReadAloudComplete(true);
      }}>{t("pathsDone")}</button>
    </section> : <section className="card compact-stack">
      <h2 className="tajweed-stage-heading" tabIndex={-1} ref={stageHeading}>{t(includesReading ? "tajweedPracticeSummary" : "tajweedRead")}</h2>
      <p>{t("tajweedExamplesProgress", { count: totalCorrect, total: lesson.samples.length })}</p>
      <div className="equal-row">
        <Link className="action light" to={route}>{t(totalCorrect < lesson.samples.length ? "tajweedContinueLesson" : "tajweedTryAgain")}</Link>
        <Link className="action" to={nextLesson && totalCorrect === lesson.samples.length ? tajweedLessonPath(nextLesson.id) : overview}>
          {t(nextLesson && totalCorrect === lesson.samples.length ? "hifzNext" : overviewLabel)}</Link>
      </div>
    </section>}
    {recording && <p className="small muted"><a href={recording.source} rel="noreferrer">{recording.speaker}</a> · <a href={recording.licenseUrl} rel="noreferrer">{recording.license}</a> · {t("setupAudioExcerpt")}</p>}
    <footer className="hifz-sources small muted"><p>{t("tajweedTeacher")}</p>
      {credits.map(source => <a key={source.url} href={source.url} rel="noreferrer">{source.title}</a>)}
    </footer>
    {(depth || readAloud) && <QuranStudySources script={compareScripts ? "both" : script} />}
  </div>;

  const directory = desktop && <nav className="card compact-stack tajweed-directory" aria-label={t(overviewLabel)}>
    <h2>{t(overviewLabel)}</h2>
    <LessonList lessons={depth ? tajweedDepthLessons : tajweedLessons} reviews={reviews} current={lesson.id} />
  </nav>;
  return <div className="paths-page tajweed-page" data-compare={compareScripts || undefined}>
    <TajweedHeading title={t(tajweedTitleKey(lesson.id))} back={practice ? route : overview} depth={depth} />
    <audio hidden ref={player.element} preload="none" {...player.events} />
    {compactDesktop ? <Tabs.Root className="workspace-tabs" dir={direction} value={tab} onValueChange={setTab}>
      <Tabs.List className="study-tabs equal-row" aria-label={t(tajweedTitleKey(lesson.id))}>
        <Tabs.Trigger value="lesson">{t("tajweedLessonPractice")}</Tabs.Trigger>
        <Tabs.Trigger value="lessons">{t(overviewLabel)}</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content className="tajweed-practice-tab" value="lesson" forceMount>{content}</Tabs.Content>
      <Tabs.Content className="tajweed-lessons-tab" value="lessons">{directory}</Tabs.Content>
    </Tabs.Root> : desktop ? <div className="tajweed-workspace">{directory}{content}</div> : content}
  </div>;
}

export function Tajweed({ settings, now, depth = false }: { settings: Settings; now: Date; depth?: boolean }) {
  const { t } = useCopy();
  const { unit } = useParams();
  const [params] = useSearchParams();
  const reviews = useLiveQuery(() => getRecord<Reviews>("reviews", {}));
  const lessons = depth ? tajweedDepthLessons : tajweedLessons;
  const lesson = lessons.find(item => item.id === (unit ?? (depth ? undefined : "nun")));
  if (!reviews) return <p className="small muted" role="status">{t("hifzLoading")}</p>;
  if (lesson) {
    const requested = lesson.samples.find(sample => tajweedSampleKey(sample) === params.get("review"));
    const practice = params.has("practice") || Boolean(requested);
    const key = `${lesson.id}:${requested ? tajweedSampleKey(requested) : practice ? "practice" : "lesson"}`;
    return <RuleLesson key={key} lesson={lesson} reviews={reviews} settings={settings} now={now} depth={depth}
      nextLesson={lessons[lessons.indexOf(lesson) + 1]} practice={practice} requested={requested} />;
  }

  return <div className="paths-page paths-levels tajweed-page tajweed-course-index">
    <TajweedHeading title={t(depth ? "tajweedDepthIndex" : "tajweedLessons")} back={pathUrl("read")} depth={depth} />
    <LessonList lessons={lessons} reviews={reviews} />
  </div>;
}
