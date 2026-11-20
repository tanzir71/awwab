import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { QuranStudySources, QuranVerseMeaning } from "@/components/QuranStudySources";
import { StudyText } from "@/components/StudyText";
import { useDesktop, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { dateKey, formatDay } from "@/lib/dates";
import { focusListItem } from "@/lib/focusListItem";
import { essentialPassages, getHifzPassage, groupPortions, nextPortion, passageLabel, portionBucket, portionPlan, recitalProgress, studyChapters,
  studyPhrases, studyQuran, verseText, type HifzPassage, type HifzPlans, type HifzPortion, type HifzReviews, type JuzRecital,
  type JuzRecitals, type StudyQuran } from "@/lib/hifz";
import { essentialPassageTitle } from "@/lib/paths-copy";
import { formatQuranReference, type QuranVerse } from "@/lib/quran";
import { saveHifzPlan, saveJuzRecitalRating, savePortionReview } from "@/lib/studyMilestones";
import { studyNames } from "@/lib/study-copy";
import type { ReviewGrade } from "@/lib/reviews";
import { getRecord, type Settings } from "@/lib/storageService";

const dates = { month: "short", day: "numeric", year: "numeric" } as const;
const emptyPlans: HifzPlans = {};
const emptyReviews: HifzReviews = {};
const bucketCopy = { sabaq: "hifzSabaq", sabqi: "hifzSabqi", manzil: "hifzManzil" };
const recordGrades: ReviewGrade[] = ["forgot", "shaky", "got-it"];
const base = (id: string) => `/learn/hifz/${id}`;

function legacyLevel(passage: HifzPassage) {
  return passage.id.startsWith("juz-") ? 5 : passage.id.startsWith("surah-") ? (passage.ranges[0].chapter >= 78 ? 2 : 5)
    : /^(?:al-kahf|friday-fajr|jumuah-prayer|eid-prayer|witr)$/.test(passage.id) ? 4 : 3;
}

function PassageHeading({ title, subtitle, back }: { title: string; subtitle?: string; back: string }) {
  const { t } = useCopy();
  return <header className="hifz-heading">
    <Link className="hifz-back" to={back} aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>
    <div><h1>{title}</h1>{subtitle && <p className="small muted">{subtitle}</p>}</div>
  </header>;
}

function VerseRead({ verse, settings }: { verse: QuranVerse; settings: Settings }) {
  const { locale } = useCopy();
  const { opening } = verseText(verse, settings.script);
  return <article className="card compact-stack hifz-verse">
    <strong className="small"><bdi>{formatQuranReference(verse.ref, locale)}</bdi></strong>
    {opening && <ArabicText text={opening} citation="1:1" verse="1:1" mushaf={settings.script} />}
    <ArabicText text={studyPhrases(verse, settings.script)} citation={verse.ref} verse={verse.ref} mushaf={settings.script} preserveSeparators />
    <QuranVerseMeaning verse={verse} settings={settings} />
  </article>;
}


function StudyPortion({ item, position, title, passage, settings, now, minutes, directory }: { item: HifzPortion; position: number; title: string;
  passage: HifzPassage; settings: Settings; now: Date; minutes: number; directory: ReactNode }) {
  const { t, locale, direction } = useCopy();
  const desktop = useDesktop();
  const wide = useDesktop(1280);
  const reviews = useRecord<HifzReviews>("hifz-portions", emptyReviews);
  const [visible, show] = useState(true);
  const [saving, markSaving] = useState(false);
  const [status, setStatus] = useState("");
  const progress = reviews[item.id];
  const zone = settings.city.timeZone;
  const today = dateKey(now, zone);
  const bucket = portionBucket(progress, today);
  const reference = formatQuranReference(item.ref, locale);
  async function rate(grade: ReviewGrade) {
    if (saving) return;
    markSaving(true);
    setStatus("");
    try { await savePortionReview(passage.id, item.id, grade, now, zone, minutes); setStatus(t("hifzSaved")); }
    catch { setStatus(t("hifzSaveError")); }
    finally { markSaving(false); }
  }
  const study = <div className="compact-stack hifz-main">
    <section className="card compact-stack hifz-study-controls">
      <div className="row-between"><span className="chip soft">{t(bucketCopy[bucket])}</span><button className="text-button" type="button" aria-expanded={visible}
        onClick={() => show(!visible)}>{t(visible ? "hifzRepeat" : "hifzRead")}</button></div>
      <p className="small muted">{t("hifzDays", { count: progress?.correctDays.length ?? 0 })}</p>
      {bucket === "manzil" && <p className="small muted">{t("hifzReviewDue", { day: formatDay(dateKey(new Date(progress.review.card.due), zone), dates, locale) })}</p>}
    </section>
    {visible && item.verses.map(verse => <VerseRead key={verse.ref} verse={verse} settings={settings} />)}
    {!visible && <div className="card hifz-hidden"><strong><bdi>{reference}</bdi></strong><span className="small muted">{t("hifzRepeat")}</span></div>}
    <div className="equal-row hifz-grade-buttons" role="group" aria-label={t("hifzRepeat")}>
      {recordGrades.map(grade => <button type="button" key={grade} disabled={saving}
        className={`action${grade === "got-it" ? "" : " light"}`} onClick={() => void rate(grade)}>{t(grade)}</button>)}
    </div>
    {status && <p className="small muted" role="status">{status}</p>}
  </div>;

  return <div className="hifz-page hifz-portion-page compact-stack">
    <PassageHeading title={t("hifzPortionTitle", { number: position })} subtitle={`${title} · ${reference}`} back={base(passage.id)} />
    {!desktop ? study : wide ? <div className="hifz-workspace">{study}{directory}</div> :
      <Tabs.Root className="workspace-tabs" dir={direction} defaultValue="reader">
        <Tabs.List className="study-tabs equal-row" aria-label={title}>
          <Tabs.Trigger value="reader">{t("surahReader")}</Tabs.Trigger>
          <Tabs.Trigger value="portions">{t("hifzPortions")}</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="reader">{study}</Tabs.Content>
        <Tabs.Content className="hifz-side-tab" value="portions">{directory}</Tabs.Content>
      </Tabs.Root>}
    <QuranStudySources script={settings.script} />
  </div>;
}

function RecitalPrompt({ item, position, focus, settings, save }: {
  item: HifzPortion; position: number; focus: Ref<HTMLHeadingElement>; settings: Settings; save: (grade: ReviewGrade) => Promise<void>;
}) {
  const { t, language, locale } = useCopy();
  const [visible, show] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const chapter = studyChapters.get(Number(item.verses[0].ref.split(":")[0]));

  async function rate(grade: ReviewGrade) {
    setSaving(true);
    setError(false);
    try { await save(grade); }
    catch { setError(true); }
    finally { setSaving(false); }
  }

  return <div className="compact-stack">
    <section className="card compact-stack hifz-recital-prompt">
      <h2 ref={focus} tabIndex={-1}>{t("hifzPortionTitle", { number: position })}</h2>
      <p className="small muted">{studyNames.surah(language, chapter.number, chapter.title)} · <bdi>{formatQuranReference(item.ref, locale)}</bdi></p>
      <p>{t("hifzRecitalPrompt")}</p>
      <button className="action light" type="button" aria-expanded={visible} onClick={() => show(value => !value)}>
        {t(visible ? "hifzRecitalHide" : "hifzRecitalReveal")}
      </button>
    </section>
    {visible && item.verses.map(verse => <VerseRead key={verse.ref} verse={verse} settings={settings} />)}
    <div className="equal-row hifz-grade-buttons" role="group" aria-label={t("hifzRecitalRating")}>
      {recordGrades.map(grade => <button type="button" key={grade} disabled={saving}
        className={grade === "got-it" ? "action" : "action light"} onClick={() => void rate(grade)}>{t(grade)}</button>)}
    </div>
    {error && <p role="alert">{t("hifzSaveError")}</p>}
  </div>;
}

function WeeklyRecital({ juz, passage, title, portions, recital, settings, now }: {
  juz: number; passage: HifzPassage; title: string; portions: HifzPortion[]; recital?: JuzRecital; settings: Settings; now: Date;
}) {
  const { t, locale } = useCopy();
  const zone = settings.city.timeZone;
  const state = recitalProgress(portions, recital, dateKey(now, zone));
  const item = state.next;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [item?.id]);
  const progress = t("hifzRecitalProgress", { count: state.count, total: portions.length });
  return <div className={`hifz-page compact-stack${item ? " hifz-recital-page" : ""}`}>
    <PassageHeading title={t("hifzWeeklyRecital")} subtitle={`${title} · ${formatQuranReference(passageLabel(passage), locale)}`} back={base(passage.id)} />
    {item ? <div className="hifz-recital-grid">
      <section className="card compact-stack hifz-recital-summary">
        <h2>{t("hifzRecitalProgressTitle")}</h2>
        <p>{progress}</p>
        <progress aria-label={progress} value={state.count} max={portions.length} />
        <p className="small muted">{t("hifzRecitalResumeHint")}</p>
        <Link className="text-button justify-self-start" to={base(passage.id)}>{t("hifzRecitalPause")}</Link>
      </section>
      <RecitalPrompt key={item.id} item={item} position={portions.indexOf(item) + 1} focus={heading} settings={settings}
        save={grade => saveJuzRecitalRating(juz, portions, item.id, grade, now, zone)} />
    </div> : <section className="card soft compact-stack hifz-recital-summary">
      <h2 ref={heading} tabIndex={-1}>{t("hifzRecitalComplete")}</h2>
      {recital?.last && <>
        <p>{t("hifzRecitalResult", { count: recital.last.remembered, total: recital.last.total })}</p>
        <p className="small muted">{t("hifzRecitalLast", { day: formatDay(recital.last.day, dates, locale) })}</p>
      </>}
      {state.availableOn && <p className="small muted">{t("hifzRecitalAvailable", { day: formatDay(state.availableOn, dates, locale) })}</p>}
      <Link className="action light" to={base(passage.id)}>{t("hifzYourPlan")}</Link>
    </section>}
    <QuranStudySources script={settings.script} />
  </div>;
}

function PassagePlan({ passage, portions, settings, now }: { passage: HifzPassage; portions: HifzPortion[]; settings: Settings; now: Date }) {
  const { t, language, locale, direction } = useCopy();
  const desktop = useDesktop();
  const wide = useDesktop(1280);
  const stored = useRecord<HifzPlans>("hifz-plans", emptyPlans);
  const reviews = useRecord<HifzReviews>("hifz-portions", emptyReviews);
  const juz = passage.id.startsWith("juz-") ? Number(passage.id.slice(4)) : undefined;
  const recital = useLiveQuery(() => juz ? getRecord<JuzRecitals>("hifz-juz-recitals", {}) : Promise.resolve(undefined), [juz]);
  const [error, showError] = useState(false);
  const { portion } = useParams();
  const today = dateKey(now, settings.city.timeZone);
  const start = stored[passage.id]?.start ?? today;
  const maktab = settings.mode === "maktab";
  const minutes = maktab ? Math.min(stored[passage.id]?.minutes ?? 3, 3) : stored[passage.id]?.minutes ?? 7;
  const options = (maktab ? [1, 2, 3] : [3, 5, 7, 10, 15, 20, 30]);
  const choices = [...new Set([...options, minutes])].sort((a, b) => a - b);
  const plan = useMemo(() => portionPlan(portions, minutes, start), [portions, minutes, start]);
  const due = nextPortion(portions, reviews, now, today);
  const done = portions.filter(item => Boolean(reviews[item.id]?.learnedOn)).length;
  const firstVerse = portions[0].verses[0];
  const firstWord = verseText(firstVerse, settings.script).text.split(/\s+/)[0];
  const essential = essentialPassages.find(item => item.id === passage.id);
  const virtueNote = /^(ya-sin|al-waqiah)$/.test(passage.id) ? "hifzWeakNarrations"
    : essential?.source?.grade.startsWith("scholars differ") ? "hifzScholarsDiffer" : undefined;
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  const title = juz ? t("hifzJuz", { number: juz })
    : passage.id.startsWith("surah-") ? studyNames.surah(language, passage.ranges[0].chapter, passage.title) : essentialPassageTitle(passage, t);
  const subtitle = [formatQuranReference(passageLabel(passage), locale), t("hifzAyahs", { count: passage.ayahs }),
    essential?.level === 3 && t("hifzEssentialLabel")].filter(Boolean).join(" · ");
  const position = Number(portion);
  const item = portions[position - 1];
  const dueIndex = portions.indexOf(due);
  const upcoming = due && portions.slice(dueIndex + 1).find(entry => !reviews[entry.id]?.learnedOn);

  function selectMinutes(value: number) {
    showError(false);
    void saveHifzPlan(passage.id, value, today).catch(() => showError(true));
  }

  if (juz && portion === "recital") return recital
    ? <WeeklyRecital juz={juz} passage={passage} title={title} portions={portions} recital={recital[juz]} settings={settings} now={now} />
    : <p role="status">{t("hifzLoading")}</p>;
  const weekly = juz && recital ? recitalProgress(portions, recital[juz], today) : undefined;

  const portionLinks = <div className="compact-stack hifz-portion-list" onKeyDown={focusListItem}>
    {portions.map((entry, index) => {
      const review = reviews[entry.id];
      const bucket = portionBucket(review, today);
      const state = entry === due ? "today" : review?.learnedOn ? "done" : "open";
      const label = <><strong><bdi>{formatQuranReference(entry.ref, locale)}</bdi></strong>
        <small>{review || state === "today" ? t(bucketCopy[bucket]) : formatDay(plan.dates[index].from, { month: "short", day: "numeric" }, locale)}</small>
        {(state !== "open" || entry === upcoming) && <span className="chip">{t(state === "today" ? "hifzToday" : state === "done" ? "pathsDone" : "hifzNext")}</span>}</>;
      return entry === item
        ? <div key={entry.id} className="hifz-portion-row" data-state={state} aria-current="page">{label}</div>
        : <Link key={entry.id} className="hifz-portion-row" data-state={state} to={`${base(passage.id)}/${index + 1}`}
          onClick={() => { if (!stored[passage.id]) selectMinutes(minutes); }}>{label}</Link>;
    })}
  </div>;

  if (item) return <StudyPortion key={item.id} item={item} position={position} title={title} passage={passage} settings={settings}
    now={now} minutes={minutes} directory={<aside className="card compact-stack hifz-portions hifz-portion-directory">
      <h2>{t("hifzPortions")}</h2>{portionLinks}{error && <p role="alert">{t("hifzSaveError")}</p>}
    </aside>} />;

  const summary = <section className="card night compact-stack hifz-summary">
      <div className="row-between"><div className="compact-stack"><p className="caption">{t("hifzYourPlan")}</p>
        <h2>{t("hifzPlanSize", { portions: portions.length, days: plan.days })}</h2>
        <p className="muted small">{t("hifzPlanRange", { minutes, end: formatDay(plan.end, dates, locale) })}</p>
      </div><ArabicText text={firstWord} mushaf={settings.script} citation={firstVerse.ref} verse={firstVerse.ref} /></div>
      <progress value={done} max={portions.length} aria-label={t("hifzCovered", { count: done, total: portions.length })} />
  </section>;
  const caveat = virtueNote && <p className="small muted">{t(virtueNote)}</p>;
  const hasNotes = Boolean(weekly || passage.source);
  const notes = <>
    {weekly && <section className="card compact-stack hifz-recital-summary">
      <h2>{t("hifzWeeklyRecital")}</h2>
      <p className="small muted">{weekly.availableOn ? t("hifzRecitalAvailable", { day: formatDay(weekly.availableOn, dates, locale) })
        : weekly.count ? t("hifzRecitalProgress", { count: weekly.count, total: portions.length }) : t("hifzRecitalHint")}</p>
      <Link className="action light" to={`${base(passage.id)}/recital`}>
        {t(weekly.availableOn ? "hifzRecitalView" : weekly.count ? "hifzRecitalResume" : "hifzRecitalStart")}
      </Link>
    </section>}
    {passage.source && <section className="card compact-stack hifz-why"><h2>{t("hifzWhy")}</h2><p><StudyText text={passage.why} /></p>
      <p className="small muted"><span className="chip soft">{t(passage.source.grade === "hasan" ? "hifzHasan" : "hifzSahih")}</span> {passage.source.ref}</p>
    </section>}
  </>;
  const roster = <section className="card compact-stack hifz-portions">
      <header className="row-between"><h2>{t("hifzPortions")}</h2>
        <label className="hifz-minutes"><span>{t("hifzMinutes")}</span><select aria-label={t("hifzMinutes")} value={minutes}
          onChange={event => selectMinutes(Number(event.currentTarget.value))}>
          {choices.map(value => <option key={value} value={value}>{number.format(value)}</option>)}
        </select></label></header>
      {portionLinks}
      {error && <p role="alert">{t("hifzSaveError")}</p>}
  </section>;
  const next = due ? <Link className="action hifz-next" to={`${base(passage.id)}/${dueIndex + 1}`}
      onClick={() => { if (!stored[passage.id]) selectMinutes(minutes); }}>
      {t((reviews[due.id]?.learnedOn ? "hifzReview" : "hifzStart"), { number: dueIndex + 1, ref: formatQuranReference(due.ref, locale) })}
  </Link> : <p className="small muted" role="status">{t("hifzAllDone")}</p>;

  return <div className="hifz-page hifz-plan-page compact-stack">
    <PassageHeading title={title} subtitle={subtitle} back={`/learn/paths/memorise/${legacyLevel(passage)}`} />
    {!desktop || !hasNotes ? <>{summary}{notes}{caveat}{roster}{next}</> : wide ? <div className="hifz-workspace">
      <div className="compact-stack hifz-main">{summary}{caveat}{roster}{next}</div>
      <aside className="compact-stack hifz-side">{notes}</aside>
    </div> : <Tabs.Root className="workspace-tabs" dir={direction} defaultValue="plan">
      <Tabs.List className="study-tabs equal-row" aria-label={title}>
        <Tabs.Trigger value="plan">{t("hifzYourPlan")}</Tabs.Trigger>
        <Tabs.Trigger value="notes">{t(weekly ? "hifzWeeklyRecital" : "hifzWhy")}</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="plan"><div className="compact-stack hifz-main">{summary}{caveat}{roster}{next}</div></Tabs.Content>
      <Tabs.Content className="compact-stack hifz-side-tab" value="notes">{notes}</Tabs.Content>
    </Tabs.Root>}
    <QuranStudySources script={settings.script} />
  </div>;
}

export function Hifz({ settings, now }: { settings: Settings; now: Date }) {
  const { id } = useParams();
  const { t } = useCopy();
  const [edition, setEdition] = useState<StudyQuran>();
  const [error, failed] = useState(false);
  const [request, retry] = useState(0);
  const passage = useMemo(() => getHifzPassage(id), [id]);
  const portions = useMemo(() => passage && edition ? groupPortions(passage, edition) : undefined, [passage, edition]);
  useEffect(() => {
    if (!passage) return;
    let current = true;
    void studyQuran().then(data => { if (current) setEdition(data); }, () => { if (current) failed(true); });
    return () => { current = false; };
  }, [passage, request]);

  if (!passage) return <div className="hifz-page compact-stack"><PassageHeading title={t("pathsMemorise")} back="/learn/paths/memorise" /></div>;
  if (portions?.length) return <PassagePlan key={passage.id} passage={passage} portions={portions} settings={settings} now={now} />;
  return <div className="hifz-page compact-stack">
    <PassageHeading title={essentialPassageTitle(passage, t)} subtitle={passageLabel(passage)} back={`/learn/paths/memorise/${legacyLevel(passage)}`} />
    <p role="status" className="card">{t(error ? "hifzUnavailable" : "hifzLoading")}</p>
    {error && <button type="button" className="action light" onClick={() => { failed(false); retry(value => value + 1); }}>{t("pathsCheckAgain")}</button>}
  </div>;
}
