import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { LocalRecorder } from "@/components/LocalRecorder";
import { StudyText } from "@/components/StudyText";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { asset } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { studyQuran, verseText } from "@/lib/hifz";
import { pathUrl, tajweedReviewPrefix } from "@/lib/learningPaths";
import { quranText, type QuranVerse } from "@/lib/quran";
import { saveLearningReview } from "@/lib/studyMilestones";
import type { Settings } from "@/lib/storageService";
import { splitArabicWords } from "@/lib/wordAnatomy";
import lesson from "../../docs/content/tajweed-nun.json";

const route = pathUrl("read", 3);
const reference = (example: typeof lesson.samples[number]) => `${example.chapter}:${example.ayah}`;
const reviewKey = (example: typeof lesson.samples[number]) => `${reference(example)}:${example.first}`;
const tracks = Object.fromEntries(lesson.samples.filter(sample => sample.audio).map(sample =>
  [reference(sample), asset(`packs/audio/aaqib-azeez/${sample.chapter}-${sample.ayah}.mp3`)]));
const exampleRefs = Object.keys(tracks);

export function Tajweed({ settings, now }: { settings: Settings; now: Date }) {
  const { t } = useCopy();
  const [params] = useSearchParams();
  const requested = lesson.samples.find(sample => reviewKey(sample) === params.get("review"));
  const practice = params.has("practice") || Boolean(requested);
  const [verses, setVerses] = useState(quranText);
  const [loadError, setLoadError] = useState(false);
  const [selection, setSelection] = useState<string>();
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const player = useAudioPlayback(exampleRefs, tracks);
  const samples = requested ? [requested] : settings.mode === "maktab" ? lesson.samples.slice(0, 4) : lesson.samples;
  const example = samples[index];

  useEffect(() => {
    let active = true;
    void studyQuran().then(data => { if (active) setVerses(data.surahs); }, () => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, []);

  function excerpt(sample: typeof lesson.samples[number], verse: QuranVerse | undefined) {
    if (!verse) return <p className="small muted" role="status">{t(loadError ? "hifzUnavailable" : "hifzLoading")}</p>;
    const { text } = verseText(verse, settings.script);
    const words = splitArabicWords(text).slice(sample.first - 1, sample.last);
    return <ArabicText text={words.join(" ")} citation={verse.ref} verse={verse.ref} mushaf={settings.script} positionOffset={sample.first - 1} />;
  }

  async function answer(rule: string) {
    if (saving || selection) return;
    setSaving(true);
    setSaveError(false);
    try {
      const id = tajweedReviewPrefix + reviewKey(example);
      await saveLearningReview(id, rule === example.rule ? "got-it" : "forgot", now, settings.city.timeZone);
      setSelection(rule);
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  function play(ref: string) { player.play(ref); }

  return <div className="paths-page tajweed-page">
    <header className="hifz-heading">
      <Link className="hifz-back" to={practice ? route : pathUrl("read")} aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
      <div><h1>{t("tajweedTitle")}</h1><p className="small muted">{t("tajweedNunTitle")}</p></div>
    </header>
    <audio ref={player.element} preload="none" {...player.events} />
    {player.error && <p role="status">{t("surahAudioError")}</p>}
    {!practice ? <>
      <p className="muted"><StudyText text={t("tajweedNunIntro")} /></p>
      <div className="tajweed-grid">{Object.entries(lesson.rules).map(([rule, letters], i) => {
        const sample = lesson.samples[i];
        const ref = reference(sample);
        return <section className="card tajweed-rule" data-rule={rule} key={rule}>
          <div><h2>{t(`tajweedRule-${rule}`)}</h2><p className="small muted"><StudyText text={t(`tajweedHint-${rule}`)} /></p></div>
          <div className="tajweed-example">{excerpt(sample, verses[sample.chapter]?.[sample.ayah - 1])}<span className="caption muted">{ref}</span></div>
          <div className="tajweed-letters"><span className="caption">{t("letters")}</span><ArabicText text={letters} compact /></div>
        </section>;
      })}</div>
      <div className="equal-row">
        <button className="action light" type="button" onClick={() => play(player.track ?? exampleRefs[0])}>{t(player.playing ? "setupPause" : "tajweedHear")}</button>
        <Link className="action" to={`${route}?practice`} onClick={() => { setIndex(0); setSelection(undefined); }}>{t("tajweedPractice", { count: settings.mode === "maktab" ? 4 : lesson.samples.length })}</Link>
      </div>
      <div className="chips">{exampleRefs.map(ref => <button type="button" key={ref} className="chip soft" aria-pressed={player.playing && player.track === ref} onClick={() => play(ref)}>{ref}</button>)}</div>
    </> : example ? <section className="card compact-stack paths-question">
      <p className="caption">{t("pathsCheckQuestion", { number: index + 1, total: samples.length })} · {reference(example)}</p>
      <h2>{t("tajweedChoose")}</h2>
      {excerpt(example, verses[example.chapter]?.[example.ayah - 1])}
      <div className="tajweed-options">{Object.keys(lesson.rules).map(rule => <button type="button" className="action light" key={rule}
        disabled={saving || Boolean(selection) || !verses[example.chapter]} aria-pressed={selection === rule} onClick={() => void answer(rule)}>{t(`tajweedRule-${rule}`)}</button>)}</div>
      {saveError && <p role="alert">{t("saveError")}</p>}
      {selection && <div className="compact-stack">
        <p role="status">{t("tajweedFeedback", { rule: t(`tajweedRule-${example.rule}`) })}</p>
        {example.audio && <button className="action light" type="button" onClick={() => play(reference(example))}>{t(player.playing ? "setupPause" : "tajweedHearVerse")}</button>}
        <LocalRecorder />
        <button className="action" type="button" onClick={() => { player.element.current?.pause(); setSelection(undefined); setIndex(index + 1); }}>{t("hifzNext")}</button>
      </div>}
    </section> : <section className="card compact-stack"><h2>{t("tajweedRead")}</h2><p>{t("tajweedKeepPractising")}</p>
      <Link className="action" to={route}>{t("tajweedTitle")}</Link></section>}
    <footer className="hifz-sources small muted"><p>{t("tajweedTeacher")}</p><a href={lesson.source} rel="noreferrer">Quranic Universal Library · Tajweed</a></footer>
  </div>;
}
