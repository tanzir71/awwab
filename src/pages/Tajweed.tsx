import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { LocalRecorder } from "@/components/LocalRecorder";
import { StudyText } from "@/components/StudyText";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { asset } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { studyQuran, verseText } from "@/lib/hifz";
import { pathUrl } from "@/lib/learningPaths";
import { quranText } from "@/lib/quran";
import type { Reviews } from "@/lib/reviews";
import { getRecord, type Settings } from "@/lib/storageService";
import { saveLearningReview } from "@/lib/studyMilestones";
import { correctTajweedSamples, tajweedClip, tajweedExcerpt, tajweedIndex, tajweedIntroKey, tajweedLessonPath, tajweedLessons,
  tajweedPracticeSamples, tajweedReference, tajweedReviewId, tajweedSampleKey, tajweedTitleKey, type TajweedLesson, type TajweedSample } from "@/lib/tajweed";

const tones = ["neutral", "tint", "soft", "accent"] as const;
const ruleSource = "https://qul.tarteel.ai/tajweed_words/85:13:3";

function TajweedHeading({ title, back }: { title: string; back: string }) {
  const { t } = useCopy();
  return <header className="hifz-heading">
    <Link className="hifz-back" to={back} aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
    <div><h1>{t("tajweedTitle")}</h1><p className="small muted">{title}</p></div>
  </header>;
}

function RuleLesson({ settings, now, lesson, reviews }: { settings: Settings; now: Date; lesson: TajweedLesson; reviews: Reviews }) {
  const { t } = useCopy();
  const [params] = useSearchParams();
  const route = tajweedLessonPath(lesson.id);
  const requested = lesson.samples.find(sample => tajweedSampleKey(sample) === params.get("review"));
  const practice = params.has("practice") || Boolean(requested);
  const [verses, setVerses] = useState(quranText);
  const [loadError, setLoadError] = useState(false);
  const [selection, setSelection] = useState<string>();
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [samples] = useState(() => requested ? [requested] : tajweedPracticeSamples(lesson, reviews, settings.mode === "maktab"));
  const practiceCount = tajweedPracticeSamples(lesson, reviews, settings.mode === "maktab").length;
  const example = samples[index];
  const rules = Object.keys(lesson.rules);
  const sources = Object.fromEntries(lesson.samples.flatMap(sample => {
    const clip = tajweedClip(sample);
    return clip ? [[clip.item.ref, asset(clip.item.path)]] : [];
  }));
  const exampleRefs = Object.keys(sources);
  const player = useAudioPlayback(exampleRefs, sources);
  const reciter = lesson.samples.find(sample => tajweedReference(sample) === player.track);
  const pack = reciter && tajweedClip(reciter)?.pack;
  const totalCorrect = correctTajweedSamples(lesson, reviews);
  const nextLesson = tajweedLessons[tajweedLessons.indexOf(lesson) + 1];

  useEffect(() => {
    let active = true;
    void studyQuran().then(data => { if (active) setVerses(data.surahs); }, () => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, []);

  function excerpt(sample: TajweedSample, showAnswer = true) {
    const verse = verses[sample.chapter]?.[sample.ayah - 1];
    if (!verse) return <p className="small muted" role="status">{t(loadError ? "hifzUnavailable" : "hifzLoading")}</p>;
    const pauses = lesson.id === "waqf";
    const script = pauses ? "uthmani" : settings.script;
    const { text } = verseText(verse, script);
    const shown = tajweedExcerpt(text, sample, pauses);
    const annotation = {
      tone: showAnswer ? tones[rules.indexOf(sample.rule) % tones.length] : "neutral" as const,
      label: t(showAnswer ? `tajweedRule-${sample.rule}` : "tajweedHighlightedWord"),
    };
    const words = Array.from({ length: sample.last - sample.first + 1 }, () => ({ annotation }));
    return <ArabicText text={shown} citation={verse.ref} verse={verse.ref} mushaf={script} positionOffset={sample.first - 1} words={words} />;
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

  return <div className="paths-page tajweed-page">
    <TajweedHeading title={t(tajweedTitleKey(lesson.id))} back={practice ? route : tajweedIndex} />
    <audio ref={player.element} preload="none" {...player.events} />
    {player.error && <p role="status">{t("surahAudioError")}</p>}
    {!practice ? <>
      <p className="muted"><StudyText text={t(tajweedIntroKey(lesson.id))} /></p>
      <div className="tajweed-grid">{rules.map((rule, i) => {
        const sample = lesson.samples.find(item => item.rule === rule)!;
        const letters = lesson.rules[rule];
        return <section className="card tajweed-rule" data-tone={tones[i % tones.length]} key={rule}>
          <div><h2>{t(`tajweedRule-${rule}`)}</h2><p className="small muted"><StudyText text={t(`tajweedHint-${rule}`)} /></p></div>
          <div className="tajweed-example">{excerpt(sample)}<bdi className="caption muted">{tajweedReference(sample)}</bdi></div>
          {letters && <div className="tajweed-letters"><span className="caption">{t("letters")}</span><ArabicText text={letters} compact /></div>}
        </section>;
      })}</div>
      <div className="equal-row">
        {exampleRefs.length > 0 && <button className="action light" type="button" onClick={() => player.play(player.track ?? exampleRefs[0])}>
          {t(player.playing ? "setupPause" : "tajweedHear")}</button>}
        <Link className="action" to={`${route}?practice`}>{t("tajweedPractice", { count: practiceCount })}</Link>
      </div>
      {exampleRefs.length > 0 ? <div className="chips">{exampleRefs.map(ref => <button type="button" key={ref} className="chip soft"
        aria-pressed={player.playing && player.track === ref} onClick={() => player.play(ref)}><bdi>{ref}</bdi></button>)}</div>
        : <p className="small muted">{t("tajweedPendingAudio")}</p>}
      <Link className="action light" to={tajweedIndex}>{t("tajweedLessons")}</Link>
    </> : example ? <section className="card compact-stack paths-question">
      <p className="caption">{t("pathsCheckQuestion", { number: index + 1, total: samples.length })} · <bdi>{tajweedReference(example)}</bdi></p>
      <h2>{t(lesson.id === "waqf" ? "tajweedDrillMark" : "tajweedChoose")}</h2>
      {excerpt(example, Boolean(selection))}
      {tajweedClip(example) && <button className="action light" type="button" onClick={() => player.play(tajweedReference(example))}>
        {t(player.playing ? "setupPause" : "tajweedHearVerse")}</button>}
      <div className="tajweed-options">{rules.map(rule => <button type="button" className="action light" key={rule}
        disabled={saving || Boolean(selection) || !verses[example.chapter]} aria-pressed={selection === rule} onClick={() => void answer(rule)}>{t(`tajweedRule-${rule}`)}</button>)}</div>
      {saveError && <p role="alert">{t("saveError")}</p>}
      {selection && <div className="compact-stack" key={tajweedSampleKey(example)}>
        <p role="status">{t("tajweedFeedback", { rule: t(`tajweedRule-${example.rule}`) })}</p>
        <LocalRecorder />
        <button className="action" type="button" onClick={() => { player.element.current?.pause(); setSelection(undefined); setIndex(index + 1); }}>
          {t(index + 1 === samples.length ? "pathsDone" : "hifzNext")}</button>
      </div>}
    </section> : <section className="card compact-stack"><h2>{t("tajweedRead")}</h2>
      <p>{t("tajweedExamplesProgress", { count: totalCorrect, total: lesson.samples.length })}</p>
      <div className="equal-row">
        <Link className="action light" to={route}>{t(totalCorrect < lesson.samples.length ? "tajweedContinueLesson" : "tajweedTryAgain")}</Link>
        <Link className="action" to={nextLesson && totalCorrect === lesson.samples.length ? tajweedLessonPath(nextLesson.id) : tajweedIndex}>
          {t(nextLesson && totalCorrect === lesson.samples.length ? "hifzNext" : "tajweedLessons")}</Link>
      </div>
    </section>}
    {pack && <p className="small muted"><a href={pack.source} rel="noreferrer">{pack.speaker}</a> · <a href={pack.licenseUrl} rel="noreferrer">{pack.attribution.split(" · ")[1]}</a> · {t("setupAudioExcerpt")}</p>}
    <footer className="hifz-sources small muted"><p>{t("tajweedTeacher")}</p>
      <a href={lesson.source ?? ruleSource} rel="noreferrer">{lesson.id === "waqf" ? "Quranic Arabic Corpus · Pause marks" : "Quranic Universal Library · Tajweed"}</a>
    </footer>
  </div>;
}

export function Tajweed({ settings, now }: { settings: Settings; now: Date }) {
  const { t, locale } = useCopy();
  const { unit } = useParams();
  const reviews = useLiveQuery(() => getRecord<Reviews>("reviews", {}));
  const lesson = tajweedLessons.find(item => item.id === (unit ?? "nun"));
  if (!reviews) return <p className="small muted" role="status">{t("hifzLoading")}</p>;
  if (lesson) return <RuleLesson lesson={lesson} reviews={reviews} settings={settings} now={now} />;

  return <div className="paths-page paths-levels tajweed-page">
    <TajweedHeading title={t("tajweedLessons")} back={pathUrl("read")} />
    <ol className="paths-level-list">{tajweedLessons.map((item, index) => {
      const count = correctTajweedSamples(item, reviews);
      const done = count === item.samples.length;
      return <li key={item.id}>
        <span className="paths-level-number" data-state={done ? "done" : "open"} aria-hidden="true">
          {done ? <DesignIcon name="paths-phone-check" size={16} /> : new Intl.NumberFormat(locale).format(index + 1)}
        </span>
        <Link className="card paths-level-mobile" to={tajweedLessonPath(item.id)} data-state={done ? "done" : "open"}>
          <strong>{t(tajweedTitleKey(item.id))}</strong><small>{t("tajweedExamplesProgress", { count, total: item.samples.length })}</small>
        </Link>
      </li>;
    })}</ol>
  </div>;
}
