import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { StudyText } from "@/components/StudyText";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { studyQuran, verseText } from "@/lib/hifz";
import { grammarPath, grammarReviewPrefix, pathUrl } from "@/lib/learningPaths";
import type { QuranVerse } from "@/lib/quran";
import type { Reviews } from "@/lib/reviews";
import { saveLearningReview } from "@/lib/studyMilestones";
import type { Settings } from "@/lib/storageService";
import { splitArabicWords } from "@/lib/wordAnatomy";
import content from "../../docs/content/grammar-foundations.json";

type Unit = typeof content.lessons[number];

function GrammarLesson({ unit, settings, now }: { unit: Unit; settings: Settings; now: Date }) {
  const { t, language } = useCopy();
  const languageIndex = language === "bn" ? 1 : 0;
  const [chapter, ayah, first, last] = unit.ayah;
  const ref = `${chapter}:${ayah}`;
  const [verse, setVerse] = useState<QuranVerse>();
  const [unavailable, setUnavailable] = useState(false);
  const [choice, setChoice] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const next = content.lessons[content.lessons.indexOf(unit) + 1];

  useEffect(() => {
    let active = true;
    void studyQuran().then(quran => { if (active) setVerse(quran.surahs[chapter][ayah - 1]); }, () => { if (active) setUnavailable(true); });
    return () => { active = false; };
  }, [chapter, ayah]);

  async function submit(answer: number) {
    if (saving || choice !== undefined) return;
    setSaving(true);
    setSaveError(false);
    try {
      await saveLearningReview(grammarReviewPrefix + unit.id, answer === unit.answer ? "got-it" : "forgot", now, settings.city.timeZone);
      setChoice(answer);
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  }

  return <>
    <section className="card night compact-stack"><h2>{unit.title[languageIndex]}</h2><p><StudyText text={unit.rule[languageIndex]} /></p></section>
    <ol className="card roots-patterns" aria-label={t("words")}>{unit.words.map(([ar, tr, en, bn]) => <li className="grammar-word" key={ar}>
      <div><strong lang="en">{tr}</strong><p className="muted small">{languageIndex ? bn : en}</p></div>
      <ArabicText text={ar} />
    </li>)}</ol>
    <section className="card roots-spot"><div><h2 className="caption">{t("rootsSpot")}</h2><a className="small"
      href={`https://corpus.quran.com/wordbyword.jsp?chapter=${chapter}&verse=${ayah}`} rel="noreferrer">{ref}</a></div>
      {verse ? <ArabicText text={splitArabicWords(verseText(verse, settings.script).text).slice(first - 1, last).join(" ")}
        citation={ref} verse={ref} positionOffset={first - 1} mushaf={settings.script} /> :
        <p className="small muted" role="status">{t(unavailable ? "hifzUnavailable" : "hifzLoading")}</p>}</section>
    <section className="card compact-stack"><h2>{unit.prompt[languageIndex]}</h2>
      <div className="compact-stack">{unit.words.map(([ar, tr], i) => <div className="roots-option" key={ar}>
        <ArabicText text={ar} compact />
        <button type="button" className="action light" aria-pressed={choice === i} disabled={saving || choice !== undefined} onClick={() => void submit(i)}>{tr}</button>
      </div>)}</div>
      {saveError && <p role="alert">{t("saveError")}</p>}
      {choice !== undefined && <p role="status">{t(choice === unit.answer ? "lessonCorrect" : "grammarCompare", { word: unit.words[unit.answer][1] })}</p>}
    </section>
    <Link className="action" to={next ? `${grammarPath}/${next.id}` : grammarPath}>{t(next ? "hifzNext" : "pathsDone")}</Link>
  </>;
}

export function Grammar({ settings, now }: { settings: Settings; now: Date }) {
  const { t, language } = useCopy();
  const { unit } = useParams();
  const active = content.lessons.find(item => item.id === unit);
  const reviews = useRecord<Reviews>("reviews", {});
  return <div className="paths-page roots-page grammar-page">
    <header className="hifz-heading"><Link className="hifz-back" to={active ? grammarPath : pathUrl("understand")} aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
      <div><h1>{t("grammarTitle")}</h1><p className="small muted">{t("grammarSubtitle")}</p></div></header>
    {active ? <GrammarLesson key={active.id} unit={active} settings={settings} now={now} /> : <ol className="card compact-stack grammar-index">
      {content.lessons.map(item => <li key={item.id}><Link className="row-between" to={`${grammarPath}/${item.id}`}>
        <strong>{item.title[language === "bn" ? 1 : 0]}</strong>{reviews[grammarReviewPrefix + item.id]?.correct > 0 && <span aria-label={t("pathsDone")}>✓</span>}
      </Link></li>)}
    </ol>}
    <footer className="hifz-sources small muted"><a href={content.source} rel="noreferrer">Quranic Arabic Corpus · Grammar</a></footer>
  </div>;
}
