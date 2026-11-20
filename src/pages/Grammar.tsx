import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { GrammarLessonList, GrammarWorkspace } from "@/components/GrammarWorkspace";
import { QuranStudySources } from "@/components/QuranStudySources";
import { StudyMessage } from "@/components/StudyText";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { grammarExampleField, grammarLessonKey, grammarWordField } from "@/lib/grammar-lesson-messages.mjs";
import { studyQuran, verseText, type StudyQuran } from "@/lib/hifz";
import { grammarPath, grammarReviewPrefix, pathUrl, rootsPath, rootsReviewPrefix, sentenceReviewPrefix, sentenceStructurePath } from "@/lib/learningPaths";
import { formatQuranReference } from "@/lib/quran";
import type { Reviews } from "@/lib/reviews";
import { saveLearningReview } from "@/lib/studyMilestones";
import type { Settings } from "@/lib/storageService";
import { splitArabicWords } from "@/lib/wordAnatomy";
import foundations from "../../docs/content/grammar-foundations.json";
import roots from "../../docs/content/roots-curriculum.json";
import sentence from "../../docs/content/sentence-structure.json";

type Example = { ayah: number[]; label?: string[]; note?: string[] };
type Unit = { id: string; title: string[]; rule: string[]; words: string[][]; prompt: string[]; answer: number;
  ruleArabic?: string; ruleReference?: string; promptReference?: string;
  commentary?: { text: string[]; ref: string; url: string } } & ({ ayah: number[]; examples?: never } | { examples: Example[]; ayah?: never });
type Course = { id: string; title: string; subtitle: string; path: string; prefix: string; source: string; lessons: Unit[] };
const courses = {
  foundations: { ...foundations, id: "foundations", title: "grammarTitle", subtitle: "grammarSubtitle", path: grammarPath, prefix: grammarReviewPrefix },
  roots: { ...roots, id: "roots", title: "rootsTitle", subtitle: "rootsSubtitle", path: rootsPath, prefix: rootsReviewPrefix },
  sentence: { ...sentence, id: "sentence", title: "sentenceTitle", subtitle: "sentenceSubtitle", path: sentenceStructurePath, prefix: sentenceReviewPrefix },
} satisfies Record<string, Course>;

function GrammarExample({ example, label, note, edition, unavailable, script }: {
  example: Example; label: string; note?: string; edition?: StudyQuran; unavailable: boolean; script: Settings["script"];
}) {
  const { t, locale } = useCopy();
  const [chapter, ayah, first, last] = example.ayah;
  const ref = `${chapter}:${ayah}`;
  const reference = formatQuranReference(ref, locale);
  const verse = edition?.surahs[chapter]?.[ayah - 1];
  return <section className="card roots-spot"><div><h2 className="caption">{label}</h2>
    <a className="small" href={`https://corpus.quran.com/${example.label ? "treebank" : "wordbyword"}.jsp?chapter=${chapter}&verse=${ayah}`} rel="noreferrer"><bdi dir="ltr">{reference}</bdi></a></div>
    {verse ? <ArabicText text={splitArabicWords(verseText(verse, script).text).slice(first - 1, last).join(" ")}
      citation={reference} verse={ref} positionOffset={first - 1} mushaf={script} /> :
      <p className="small muted" role="status">{t(unavailable ? "hifzUnavailable" : "hifzLoading")}</p>}
    {note && <p className="small muted grammar-example-note">{note}</p>}
  </section>;
}

function GrammarLesson({ unit, course, settings, now }: { unit: Unit; course: Course; settings: Settings; now: Date }) {
  const { t, language, locale } = useCopy();
  const [edition, setEdition] = useState<StudyQuran>();
  const [unavailable, setUnavailable] = useState(false);
  const [choice, setChoice] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const next = course.lessons[course.lessons.indexOf(unit) + 1];
  const key = (field: string) => grammarLessonKey(course.id, unit.id, field);
  const referenceValues = (ref?: string) => ref ? { reference: `\u2066${formatQuranReference(ref, locale)}\u2069` } : undefined;
  const examples: Example[] = unit.examples ?? [{ ayah: unit.ayah }];
  const words = unit.words.map(([ar, latin, , , banglaLabel], index) => ({
    ar, label: banglaLabel ? t(key(grammarWordField(index, "label"))) : latin,
    labelLanguage: banglaLabel ? language : "en", meaning: t(key(grammarWordField(index, "meaning"))),
  }));

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

  return <article className="paths-page grammar-lesson" aria-label={t(key("title"))}>
    <section className="card night compact-stack"><h2>{t(key("title"))}</h2>
      <p><StudyMessage id={key("rule")} arabic={unit.ruleArabic} values={referenceValues(unit.ruleReference)} /></p>
    </section>
    <ol className="card roots-patterns" aria-label={t("words")}>{words.map(({ ar, label, labelLanguage, meaning }) => <li className="grammar-word" key={ar}>
      <div><strong lang={labelLanguage}>{label}</strong><p className="muted small">{meaning}</p></div>
      <ArabicText text={ar} />
    </li>)}</ol>
    <div className="grammar-examples">{examples.map((example, index) => <GrammarExample key={example.ayah.join(":")}
      example={example} edition={edition} unavailable={unavailable} script={settings.script}
      label={example.label ? t(key(grammarExampleField(index, "label"))) : t("rootsSpot")}
      note={example.note ? t(key(grammarExampleField(index, "note"))) : undefined} />)}</div>
    {unit.commentary && <section className="card soft compact-stack">
      <h2>{t("sentenceTafsirNote")}</h2><p>{t(key("commentary"))}</p>
      <a className="text-button justify-self-start" href={unit.commentary.url} rel="noreferrer">{t("sentenceTafsirSource", { ref: formatQuranReference(unit.commentary.ref, locale) })}</a>
    </section>}
    <section className="card compact-stack grammar-drill"><h2>{t(key("prompt"), referenceValues(unit.promptReference))}</h2>
      <div className="compact-stack grammar-options">{words.map(({ ar, label, labelLanguage }, i) => <div className="roots-option" key={ar}>
        <ArabicText text={ar} compact />
        <button type="button" className="action light" lang={labelLanguage} aria-pressed={choice === i} disabled={saving || choice !== undefined} onClick={() => void submit(i)}>{label}</button>
      </div>)}</div>
      {saveError && <p role="alert">{t("saveError")}</p>}
      {choice !== undefined && <p role="status">{t(choice === unit.answer ? "lessonCorrect" : "grammarCompare", { word: words[unit.answer].label })}</p>}
    </section>
    <Link className="action grammar-next" to={next ? `${course.path}/${next.id}` : course.path}>{t(next ? "hifzNext" : "pathsDone")}</Link>
  </article>;
}

export function Grammar({ settings, now, course = "foundations" }: { settings: Settings; now: Date; course?: keyof typeof courses }) {
  const { t } = useCopy();
  const { unit } = useParams();
  const content = courses[course];
  const active = content.lessons.find(item => item.id === unit);
  const reviews = useRecord<Reviews>("reviews", {});
  const title = t(content.title);
  const list = <GrammarLessonList lessons={content.lessons} course={content.id} path={content.path} prefix={content.prefix} reviews={reviews} current={active?.id} />;
  return <div className="paths-page roots-page grammar-page grammar-course-shell" data-course={course}>
    <header className="hifz-heading"><Link className="hifz-back" to={active ? content.path : pathUrl("understand")} aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
      <div><h1>{title}</h1><p className="small muted">{t(content.subtitle)}</p></div></header>
    {active ? <GrammarWorkspace key={`${course}/${active.id}`} title={title} directory={<nav className="card compact-stack grammar-directory" aria-label={t("grammarLessons")}>
      <h2>{t("grammarLessons")}</h2>{list}
    </nav>}>
      <GrammarLesson unit={active} course={content} settings={settings} now={now} />
    </GrammarWorkspace> : <div className="card grammar-course-index">{list}</div>}
    <footer className="hifz-sources small muted"><a href={content.source} rel="noreferrer">{t(course === "roots" ? "rootsPatternSource" : "grammarSource")}</a></footer>
    {active && course !== "foundations" && <QuranStudySources script={settings.script} />}
  </div>;
}
