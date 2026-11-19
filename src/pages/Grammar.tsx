import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { QuranStudySources } from "@/components/QuranStudySources";
import { StudyText } from "@/components/StudyText";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { studyQuran, verseText, type StudyQuran } from "@/lib/hifz";
import { grammarPath, grammarReviewPrefix, pathUrl, sentenceReviewPrefix, sentenceStructurePath } from "@/lib/learningPaths";
import type { Reviews } from "@/lib/reviews";
import { saveLearningReview } from "@/lib/studyMilestones";
import type { Settings } from "@/lib/storageService";
import { splitArabicWords } from "@/lib/wordAnatomy";
import foundations from "../../docs/content/grammar-foundations.json";
import sentence from "../../docs/content/sentence-structure.json";

type Example = { ayah: number[]; label?: string[]; note?: string[] };
type Unit = { id: string; title: string[]; rule: string[]; words: string[][]; prompt: string[]; answer: number;
  commentary?: { text: string[]; ref: string; url: string } } & ({ ayah: number[]; examples?: never } | { examples: Example[]; ayah?: never });
type Course = { title: string; subtitle: string; path: string; prefix: string; source: string; lessons: Unit[] };
const courses = {
  foundations: { ...foundations, title: "grammarTitle", subtitle: "grammarSubtitle", path: grammarPath, prefix: grammarReviewPrefix },
  sentence: { ...sentence, title: "sentenceTitle", subtitle: "sentenceSubtitle", path: sentenceStructurePath, prefix: sentenceReviewPrefix },
} satisfies Record<string, Course>;

function GrammarExample({ example, edition, unavailable, script }: {
  example: Example; edition?: StudyQuran; unavailable: boolean; script: Settings["script"];
}) {
  const { t, language } = useCopy();
  const languageIndex = language === "bn" ? 1 : 0;
  const [chapter, ayah, first, last] = example.ayah;
  const ref = `${chapter}:${ayah}`;
  const verse = edition?.surahs[chapter]?.[ayah - 1];
  return <section className="card roots-spot"><div><h2 className="caption">{example.label?.[languageIndex] ?? t("rootsSpot")}</h2>
    <a className="small" href={`https://corpus.quran.com/${example.label ? "treebank" : "wordbyword"}.jsp?chapter=${chapter}&verse=${ayah}`} rel="noreferrer">{ref}</a></div>
    {verse ? <ArabicText text={splitArabicWords(verseText(verse, script).text).slice(first - 1, last).join(" ")}
      citation={ref} verse={ref} positionOffset={first - 1} mushaf={script} /> :
      <p className="small muted" role="status">{t(unavailable ? "hifzUnavailable" : "hifzLoading")}</p>}
    {example.note && <p className="small muted grammar-example-note">{example.note[languageIndex]}</p>}
  </section>;
}

function GrammarLesson({ unit, course, settings, now }: { unit: Unit; course: Course; settings: Settings; now: Date }) {
  const { t, language } = useCopy();
  const languageIndex = language === "bn" ? 1 : 0;
  const [edition, setEdition] = useState<StudyQuran>();
  const [unavailable, setUnavailable] = useState(false);
  const [choice, setChoice] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const next = course.lessons[course.lessons.indexOf(unit) + 1];
  const examples = unit.examples ?? [{ ayah: unit.ayah }];

  useEffect(() => {
    let active = true;
    void studyQuran().then(quran => { if (active) setEdition(quran); }, () => { if (active) setUnavailable(true); });
    return () => { active = false; };
  }, []);

  async function submit(answer: number) {
    if (saving || choice !== undefined) return;
    setSaving(true);
    setSaveError(false);
    try {
      await saveLearningReview(course.prefix + unit.id, answer === unit.answer ? "got-it" : "forgot", now, settings.city.timeZone);
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
    <div className="grammar-examples">{examples.map(example => <GrammarExample key={example.ayah.join(":")}
      example={example} edition={edition} unavailable={unavailable} script={settings.script} />)}</div>
    {unit.commentary && <section className="card soft compact-stack">
      <h2>{t("sentenceTafsirNote")}</h2><p>{unit.commentary.text[languageIndex]}</p>
      <a className="text-button justify-self-start" href={unit.commentary.url} rel="noreferrer">{t("sentenceTafsirSource", { ref: unit.commentary.ref })}</a>
    </section>}
    <section className="card compact-stack"><h2>{unit.prompt[languageIndex]}</h2>
      <div className="compact-stack">{unit.words.map(([ar, tr], i) => <div className="roots-option" key={ar}>
        <ArabicText text={ar} compact />
        <button type="button" className="action light" aria-pressed={choice === i} disabled={saving || choice !== undefined} onClick={() => void submit(i)}>{tr}</button>
      </div>)}</div>
      {saveError && <p role="alert">{t("saveError")}</p>}
      {choice !== undefined && <p role="status">{t(choice === unit.answer ? "lessonCorrect" : "grammarCompare", { word: unit.words[unit.answer][1] })}</p>}
    </section>
    <Link className="action" to={next ? `${course.path}/${next.id}` : course.path}>{t(next ? "hifzNext" : "pathsDone")}</Link>
  </>;
}

export function Grammar({ settings, now, course = "foundations" }: { settings: Settings; now: Date; course?: keyof typeof courses }) {
  const { t, language } = useCopy();
  const { unit } = useParams();
  const content = courses[course];
  const active = content.lessons.find(item => item.id === unit);
  const reviews = useRecord<Reviews>("reviews", {});
  return <div className="paths-page roots-page grammar-page" data-course={course}>
    <header className="hifz-heading"><Link className="hifz-back" to={active ? content.path : pathUrl("understand")} aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
      <div><h1>{t(content.title)}</h1><p className="small muted">{t(content.subtitle)}</p></div></header>
    {active ? <GrammarLesson key={active.id} unit={active} course={content} settings={settings} now={now} /> : <ol className="card compact-stack grammar-index">
      {content.lessons.map(item => <li key={item.id}><Link className="row-between" to={`${content.path}/${item.id}`}>
        <strong>{item.title[language === "bn" ? 1 : 0]}</strong>{reviews[content.prefix + item.id]?.correct > 0 && <span aria-label={t("pathsDone")}>✓</span>}
      </Link></li>)}
    </ol>}
    <footer className="hifz-sources small muted"><a href={content.source} rel="noreferrer">Quranic Arabic Corpus · Grammar</a></footer>
    {active && course === "sentence" && <QuranStudySources script={settings.script} />}
  </div>;
}
