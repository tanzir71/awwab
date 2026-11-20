import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { AskAudioButton } from "@/components/AskAudio";
import { DesignIcon } from "@/components/DesignIcon";
import { PlacementAudio } from "@/components/PlacementAudio";
import { QuranStudySources, QuranVerseMeaning } from "@/components/QuranStudySources";
import { useCopy } from "@/lib/copy";
import { dateKey } from "@/lib/dates";
import { verseText } from "@/lib/hifz";
import { levels, pathUrl, placementStartingLevel, tracks, type PathPlacement, type Track } from "@/lib/learningPaths";
import { formatQuranReference, quranText, type QuranVerse } from "@/lib/quran";
import { placement, placementAudio } from "@/lib/onboarding";
import { placementSpeakPhraseIds } from "@/lib/speakAskAudio";
import { askDefaults, askMeaning, askPhrase, type AskPhrase } from "@/lib/umrahAsk";
import { updateRecord, type Settings } from "@/lib/storageService";

type Prompt = { letter?: string; prompt?: QuranVerse; answer?: QuranVerse; showMeaning?: boolean; phrase?: AskPhrase; audio?: string; copy?: string };
const trackKeys = { read: "pathsRead", memorise: "pathsMemorise", understand: "pathsUnderstand", speak: "pathsSpeak" };
const quiz: Record<Track, Prompt[]> = {
  read: placement.map(sample => ({
    letter: sample.chapter ? undefined : sample.arabic,
    prompt: sample.chapter && sample.verse ? quranText[sample.chapter][sample.verse - 1] : undefined,
    audio: placementAudio[sample.audioRef] ? sample.audioRef : undefined,
    copy: sample.title === "letters" ? "pathsCheckGhayn" : sample.title === "harakat" ? "pathsCheckBi" : undefined,
  })),
  memorise: [103, 108, 112].map(chapter => ({ prompt: quranText[chapter][0], answer: quranText[chapter][1] })),
  understand: [2, 4, 5, 6].map(ayah => ({ prompt: quranText[1][ayah - 1], showMeaning: true })),
  speak: placementSpeakPhraseIds.map(id => ({ phrase: askPhrase(id) })),
};

function CheckVerse({ verse, script }: { verse: QuranVerse; script: Settings["script"] }) {
  const { locale } = useCopy();
  const reference = formatQuranReference(verse.ref, locale);
  return <>
    <ArabicText text={verseText(verse, script).text} citation={reference} verse={verse.ref} mushaf={script} preserveSeparators />
    <small className="muted"><bdi>{reference}</bdi></small>
  </>;
}

function CheckRound({ track, settings, now }: { track: Track; settings: Settings; now: Date }) {
  const { t, locale } = useCopy();
  const questions = quiz[track];
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [revealed, reveal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, failed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const answer = useRef<HTMLDivElement>(null);
  const question = questions[index];
  const level = placementStartingLevel(score, questions.length);
  useEffect(() => {
    (revealed ? answer.current : heading.current)?.focus({ preventScroll: true });
  }, [index, revealed]);
  async function grade(correct: boolean) {
    if (pending) return;
    const next = score + Number(correct);
    if (index + 1 === questions.length) {
      setPending(true);
      failed(false);
      try {
        const suggested = placementStartingLevel(next, questions.length);
        await updateRecord<PathPlacement>("path-placement", {}, previous => ({ ...previous, [track]: {
          level: suggested, score: next, total: questions.length, day: dateKey(now, settings.city.timeZone),
        } }));
      } catch { failed(true); return; }
      finally { setPending(false); }
    }
    setScore(next);
    setIndex(index + 1);
    reveal(false);
  }

  const promptLabel = { read: "pathsCheckRead", memorise: "pathsCheckMemorise", understand: "pathsCheckUnderstand", speak: "pathsCheckSpeak" };
  return <div className="paths-page paths-levels">
    <header className="hifz-heading"><Link className="hifz-back" aria-label={t("back")} to="/learn/paths/check"><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
      <div><h1>{t(trackKeys[track])}</h1><p className="muted small">{t("pathsCheckTitle")}</p></div></header>
    {question ? <section className="card compact-stack paths-question">
      <p className="caption">{t("pathsCheckQuestion", { number: index + 1, total: questions.length })}</p>
      <h2 ref={heading} tabIndex={-1}>{t(promptLabel[track])}</h2>
      {question.letter && <ArabicText text={question.letter} />}
      {question.prompt && <CheckVerse verse={question.prompt} script={settings.script} />}
      {question.phrase && <p>{askMeaning(question.phrase, t)}</p>}
      {revealed && <div ref={answer} tabIndex={-1} className="paths-reveal">
        {question.copy && <p>{t(question.copy)}</p>}
        {question.answer && <CheckVerse verse={question.answer} script={settings.script} />}
        {question.showMeaning && question.prompt && <QuranVerseMeaning text={question.prompt.english} />}
        {question.audio && <PlacementAudio key={question.audio} reference={question.audio}
          title={question.prompt ? formatQuranReference(question.prompt.ref, locale) : t(question.copy ?? trackKeys[track])} />}
        {question.phrase && <>
          <ArabicText text={question.phrase.saudi.ar} preserveSeparators />
          <AskAudioButton key={question.phrase.id} ids={[question.phrase.id]} settings={askDefaults} label={t("pathsCheckHearAnswer")} light />
        </>}
      </div>}
      {question.prompt && <QuranStudySources script={settings.script} />}
      {!revealed ? <button className="action" type="button" onClick={() => reveal(true)}>{t("pathsCheckReveal")}</button>
        : <div className="equal-row"><button type="button" className="action light" disabled={pending} onClick={() => void grade(false)}>{t("forgot")}</button>
          <button type="button" className="action" disabled={pending} onClick={() => void grade(true)}>{t("got-it")}</button></div>}
      {error && <p role="alert">{t("hifzSaveError")}</p>}
    </section> : <section className="card compact-stack"><h2 ref={heading} tabIndex={-1}>{t("pathsCheckScore", { score, total: questions.length })}</h2>
      <p>{t("pathsCheckLevel", { title: t(levels[track][level - 1].titleKey) })}</p>
      <div className="equal-row"><button className="action light" type="button" onClick={() => { setIndex(0); setScore(0); }}>{t("pathsCheckAgain")}</button>
        <Link className="action" to={pathUrl(track, level)}>{t("pathsStart")}</Link></div>
    </section>}
  </div>;
}

export function PathCheck({ settings, now }: { settings: Settings; now: Date }) {
  const { t } = useCopy();
  const { track: id } = useParams();
  const track = tracks.find(item => item === id);
  if (track) return <CheckRound key={track} track={track} settings={settings} now={now} />;
  return <div className="paths-page paths-levels">
    <header className="hifz-heading"><Link className="hifz-back" to="/learn/paths" aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
      <div><h1>{t("pathsCheckTitle")}</h1><p className="small muted">{t("pathsCheckHint")}</p></div></header>
    {tracks.map(item => <Link key={item} className="list-row" to={`/learn/paths/check/${item}`}>{t(trackKeys[item])}</Link>)}
  </div>;
}
