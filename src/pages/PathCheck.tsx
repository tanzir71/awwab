import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { PlacementAudio } from "@/components/PlacementAudio";
import { QuranStudySources } from "@/components/QuranStudySources";
import { useCopy } from "@/lib/copy";
import { dateKey } from "@/lib/dates";
import { levels, pathUrl, tracks, type PathPlacement, type Track } from "@/lib/learningPaths";
import { quranText } from "@/lib/quran";
import { placement, placementAudio } from "@/lib/onboarding";
import { askPhrase } from "@/lib/umrahAsk";
import { banglaPhrases } from "@/lib/umrah-ask-copy";
import { updateRecord, type Settings } from "@/lib/storageService";

type Prompt = { prompt?: string; answer: string; ref?: string; meaning?: string; bn?: string; audio?: string; copy?: string };
const trackKeys = { read: "pathsRead", memorise: "pathsMemorise", understand: "pathsUnderstand", speak: "pathsSpeak" };
const quiz: Record<Track, Prompt[]> = {
  read: placement.map(sample => ({ prompt: sample.arabic, answer: "", audio: placementAudio[sample.audioRef] ? sample.audioRef : undefined,
    copy: sample.title === "letters" ? "pathsCheckAyn" : sample.title === "harakat" ? "pathsCheckBi" : undefined,
    ref: sample.chapter ? `${sample.chapter}:${sample.verse}` : undefined })),
  memorise: [103, 108, 112].map(chapter => ({ prompt: quranText[chapter][0].uthmani, answer: quranText[chapter][1].uthmani, ref: `${chapter}:2` })),
  understand: [2, 4, 5, 6].map(ayah => ({ prompt: quranText[1][ayah - 1].uthmani, answer: quranText[1][ayah - 1].english, ref: `1:${ayah}` })),
  speak: ["excuse-me", "toilet", "buy-sim", "lost"].map(id => ({ answer: askPhrase(id).saudi.ar, meaning: askPhrase(id).en, bn: banglaPhrases[id] })),
};

function CheckRound({ track, settings, now }: { track: Track; settings: Settings; now: Date }) {
  const { t, language } = useCopy();
  const questions = quiz[track];
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [revealed, reveal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, failed] = useState(false);
  const question = questions[index];
  const level = score === questions.length && track !== "speak" ? 2 : 1;
  async function grade(correct: boolean) {
    if (pending) return;
    const next = score + Number(correct);
    if (index + 1 === questions.length) {
      setPending(true);
      failed(false);
      try {
        const suggested = next === questions.length && track !== "speak" ? 2 : 1;
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
      <h2>{t(promptLabel[track])}</h2>
      {question.prompt ? <ArabicText text={question.prompt} citation={question.ref} /> : <p>{language === "bn" ? question.bn : question.meaning}</p>}
      {revealed && <div className="paths-reveal">{question.copy && <p>{t(question.copy)}</p>}
        {question.answer && (/\p{Script=Arabic}/u.test(question.answer)
          ? <ArabicText text={question.answer} citation={question.ref} preserveSeparators /> : <p lang="en">{question.answer}</p>)}
        {question.audio && <PlacementAudio key={question.audio} reference={question.audio} title={question.ref} />}
        {question.ref && <small>{question.ref}</small>}
        {track === "understand" && <QuranStudySources script="uthmani" english />}</div>}
      {!revealed ? <button className="action" type="button" onClick={() => reveal(true)}>{t("pathsCheckReveal")}</button>
        : <div className="equal-row"><button type="button" className="action light" disabled={pending} onClick={() => void grade(false)}>{t("forgot")}</button>
          <button type="button" className="action" disabled={pending} onClick={() => void grade(true)}>{t("got-it")}</button></div>}
      {error && <p role="alert">{t("hifzSaveError")}</p>}
    </section> : <section className="card compact-stack"><h2>{t("pathsCheckScore", { score, total: questions.length })}</h2>
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
