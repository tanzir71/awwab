import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useSearchParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { StudyMessage } from "@/components/StudyText";
import { useCopy } from "@/lib/copy";
import { grammarLessonKey } from "@/lib/grammar-lesson-messages.mjs";
import { studyQuran, verseText } from "@/lib/hifz";
import { pathUrl, patternPracticePath, patternReviewPrefix, rootsPath, rootsReviewPrefix } from "@/lib/learningPaths";
import { formatQuranReference, type QuranVerse } from "@/lib/quran";
import { isDue, type ReviewGrade, type Reviews } from "@/lib/reviews";
import { saveLearningReview } from "@/lib/studyMilestones";
import { getRecord, type Settings } from "@/lib/storageService";
import { splitArabicWords } from "@/lib/wordAnatomy";
import content from "../../docs/content/roots-and-patterns.json";
import curriculum from "../../docs/content/roots-curriculum.json";

const reviewKey = (id: string) => patternReviewPrefix + id;
const emptyReviews: Reviews = {};
const { spot, patterns } = content;
const spotRef = `${spot.chapter}:${spot.ayah}`;
type Pattern = typeof patterns[number];

function RootsHeading({ drill }: { drill: boolean }) {
  const { t } = useCopy();
  return <header className="hifz-heading">
    <Link className="hifz-back" to={drill ? rootsPath : pathUrl("understand")} aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
    <div><h1>{t(drill ? "rootsPractice" : "rootsTitle")}</h1><p className="small muted">{t("rootsSubtitle")}</p></div>
  </header>;
}

function QuranSpot({ settings }: { settings: Settings }) {
  const { t, locale } = useCopy();
  const [verse, setVerse] = useState<QuranVerse>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void studyQuran().then(quran => { if (active) setVerse(quran.surahs[spot.chapter][spot.ayah - 1]); },
      () => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  const excerpt = verse && splitArabicWords(verseText(verse, settings.script).text).slice(spot.first - 1, spot.last).join(" ");
  const source = `https://corpus.quran.com/wordmorphology.jsp?location=(${spotRef}:${spot.last})`;
  const reference = formatQuranReference(spotRef, locale);
  return <section className="card roots-spot">
    <div><h2 className="caption">{t("rootsSpot")}</h2>
      <a className="small" href={source} rel="noreferrer">{t("rootsBookQuote")} · <bdi dir="ltr">{reference}</bdi></a></div>
    {excerpt ? <ArabicText text={excerpt} citation={reference} verse={spotRef} mushaf={settings.script} positionOffset={spot.first - 1} /> :
      <p className="small muted" role="status">{t(error ? "hifzUnavailable" : "hifzLoading")}</p>}
  </section>;
}

function PatternDrill({ items, settings, now, reviewMode }: { items: Pattern[]; settings: Settings; now: Date; reviewMode: boolean }) {
  const { t } = useCopy();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const current = items[index];
  const options = [];
  if (current) {
    const position = patterns.indexOf(current);
    options.push(patterns[(position + 1) % patterns.length], patterns[(position + 3) % patterns.length]);
    options.splice(position % 3, 0, current);
  }

  async function answer(pattern: Pattern) {
    if (saving || selected) return;
    setSaving(true);
    setError(false);
    const grade: ReviewGrade = pattern.id === current.id ? "got-it" : "forgot";
    try {
      await saveLearningReview(reviewKey(current.id), grade, now, settings.city.timeZone);
      setSelected(pattern.id);
    } catch { setError(true); }
    finally { setSaving(false); }
  }

  return <div className="paths-page roots-page">
    <RootsHeading drill />
    {!current ? <section className="card compact-stack"><h2>{t(reviewMode ? "rootsSaved" : "rootsUpToDate")}</h2>
      <Link className="action" to={rootsPath}>{t("rootsTitle")}</Link></section> :
      <section className="card compact-stack paths-question">
        <p className="caption">{t("pathsCheckQuestion", { number: index + 1, total: items.length })}</p>
        <h2>{t("rootsWhich")}</h2>
        <ArabicText text={current.word} words={[{ root: content.root, transliteration: current.latin }]} />
        <div className="compact-stack" role="group" aria-label={t("rootsWhich")}>{options.map(option =>
          <div key={option.id} className="roots-option">
            <ArabicText text={option.pattern} compact />
            <button type="button" className="action light" aria-pressed={selected === option.id} disabled={saving || Boolean(selected)}
              onClick={() => void answer(option)}>{t("rootsType-" + option.id)}</button>
          </div>)}</div>
        {error && <p role="alert">{t("hifzSaveError")}</p>}
        {selected && <div className="compact-stack">
          <p role="status">{t(selected === current.id ? "rootsCorrect" : "rootsCompare", { type: t("rootsType-" + current.id) })}</p>
          <button type="button" className="action" onClick={() => { setSelected(undefined); setIndex(index + 1); }}>
            {t(index + 1 === items.length ? "pathsDone" : "hifzNext")}
          </button>
        </div>}
      </section>}
  </div>;
}

function StartPatternDrill({ settings, now, reviews }: { settings: Settings; now: Date; reviews: Reviews }) {
  const [lesson] = useState(() => {
    const due = patterns.filter(pattern => isDue(reviews[reviewKey(pattern.id)], now));
    return { due: due.slice(0, settings.mode === "maktab" ? 3 : 6), hasDue: due.length > 0 };
  });
  return <PatternDrill items={lesson.due} settings={settings} now={now} reviewMode={lesson.hasDue} />;
}

export function RootsPatterns({ settings, now }: { settings: Settings; now: Date }) {
  const { t } = useCopy();
  const [query] = useSearchParams();
  const reviews = useLiveQuery(() => getRecord("reviews", emptyReviews));
  const due = reviews && patterns.filter(pattern => isDue(reviews[reviewKey(pattern.id)], now)).length;
  if (query.has("practice")) return reviews ? <StartPatternDrill settings={settings} now={now} reviews={reviews} /> :
    <p role="status">{t("rootsLoading")}</p>;
  return <div className="paths-page roots-page">
    <RootsHeading drill={false} />
    <section className="card night roots-intro">
      <div className="compact-stack"><p className="caption">{t("rootsLabel")}</p><h2>{t("rootsWrite")}</h2>
        <p className="small muted">{t("rootsThreeLetters")}</p></div>
      <ArabicText text={content.root} />
    </section>
    <p className="muted roots-explanation"><StudyMessage id="rootsExplanation" arabic={content.patternLetters} /></p>
    <ol className="card roots-patterns" aria-label={t("rootsTitle")}>{patterns.map(item => <li key={item.id}>
      <ArabicText text={item.pattern} compact />
      <div><strong lang="en">{item.latin}</strong><p className="muted small">{t("rootsMeaning-" + item.id)}</p></div>
      <ArabicText text={item.word} words={[{ root: content.root, transliteration: item.latin }]} />
    </li>)}</ol>
    <QuranSpot settings={settings} />
    {reviews && (due ? <Link className="action" to={patternPracticePath}>{t("rootsStart", { count: settings.mode === "maktab" ? Math.min(3, due) : due })}</Link> :
      <p className="small muted">{t("rootsUpToDate")}</p>)}
    <section className="card compact-stack roots-course">
      <h2>{t("rootsMoreLessons")}</h2>
      <ol className="compact-stack grammar-index">{curriculum.lessons.map(lesson => <li key={lesson.id}>
        <Link className="row-between" to={`${rootsPath}/${lesson.id}`}><strong>{t(grammarLessonKey("roots", lesson.id, "title"))}</strong>
          {reviews?.[rootsReviewPrefix + lesson.id]?.correct > 0 && <span aria-label={t("pathsDone")}>✓</span>}</Link>
      </li>)}</ol>
    </section>
    <footer className="hifz-sources small muted">
      <a href={content.source} rel="noreferrer">{t("rootsDictionary")}</a>
      <a href={content.patternSource} rel="noreferrer">{t("rootsPatternSource")}</a>
    </footer>
  </div>;
}
