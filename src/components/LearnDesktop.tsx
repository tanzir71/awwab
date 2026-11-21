import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePrayerLogs, useQaidaPlace, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { addDays, dateKey, formatDay, formatTime } from "@/lib/dates";
import { calendarDefaults, hijriOn, hijriMonthName } from "@/lib/hijri";
import { currentPrayerSchedule } from "@/lib/prayerServices";
import { essentialPassageTitle } from "@/lib/paths-copy";
import { qaidaExamples, qaidaRows, parseQaidaReview } from "@/lib/qaidaPractice";
import { coreWordCoverage, coreWordTotal, formatQuranReference, knownCoreQuranWords, quranText } from "@/lib/quran";
import { isDue, type Reviews } from "@/lib/reviews";
import { prayerStatistics, updateRecord, type Settings } from "@/lib/storageService";
import { studyNames } from "@/lib/study-copy";
import { deskActivities, deskMinutes, isPathReview, reviewQueue, type DeskActivity, type MemoriseDesk } from "@/lib/studyDesk";
import { families, lettersForFamily } from "@/lib/takhti";
import alphabet from "../../docs/content/arabic-letters.json";
import qaida from "../../docs/content/qaida-lessons.json";
import surahs from "../../docs/content/surahs-for-salah.json";

const chapters = surahs.surahs.slice(0, 12);
const chapterNames: Record<number, string> = { 1: "Al-Fātiḥa", 103: "Al-ʿAsr", 112: "Al-Ikhlāṣ" };
const numberOfLessons = qaida.lessons.length;
const alphabetCycleStart = Date.UTC(2026, 10, 16);
type WordSample = { text: string; en: string; bn: string; transliteration?: string };
const adultExamples: WordSample[] = [
  { text: "يَوْم", transliteration: "yawm", en: "day", bn: "দিন" },
  { text: "عِلْم", transliteration: "ʿilm", en: "knowledge", bn: "জ্ঞান" },
  { text: "رَحْمَة", transliteration: "raḥma", en: "mercy", bn: "দয়া" },
];
const childExamples: (WordSample & { key: string })[] = [
  { key: "word:يوم", text: "يَوْم", en: "day", bn: "দিন" },
  { key: "word:رب", text: "رَبّ", en: "Lord", bn: "প্রতিপালক" },
  { key: "word:الله", text: "ٱللَّه", en: "Allah", bn: "আল্লাহ" },
];

function DeskHeading({ children, to, label }: { children: ReactNode; to?: string; label?: string }) {
  return <div className="row-between desk-heading"><h2>{children}</h2>{to && <Link to={to}>{label}</Link>}</div>;
}

function useDeskProgress(settings: Settings, now: Date) {
  const { t, language } = useCopy();
  const date = dateKey(now, settings.city.timeZone);
  const { lesson: current, row: savedRow } = useQaidaPlace();
  const lesson = qaida.lessons.find(item => item.n === current) ?? qaida.lessons[0];
  const rows = qaidaRows(lesson.n);
  const row = Math.min(savedRow, rows.length - 1) + 1;
  const completed = [...new Set(useRecord<number[]>("qaida-complete", []))];
  const activeDays = [...new Set(useRecord<string[]>("study-days", []))];
  const familiar = useRecord<string[]>("words-known", []);
  const vocabulary = useRecord<string[]>("word-bank-known", []);
  const writing = useRecord<string[]>("takhti-practised", []);
  const reviews = useRecord<Reviews>("reviews", {});
  const known = knownCoreQuranWords(familiar, vocabulary);
  const lessonName = studyNames.lesson(language, lesson.n, lesson.title);
  const preview = qaidaExamples(lesson.n).reverse();
  const progress = completed.includes(lesson.n) ? 1 : savedRow ? row / rows.length : 0;
  const focus = lesson.n === 4
    ? t(settings.spellStyle === "ampara-bn" ? "deskHarakat" : "deskHarakatStandard")
    : t("deskAboutRow", { row, total: rows.length });
  return { date, lesson, row, completed, activeDays, writing, reviews, known, lessonName, rows: rows.length, progress, preview, focus };
}

type DeskProgress = ReturnType<typeof useDeskProgress>;

function LessonPath({ completed, current, maktab = false }: { completed: number[]; current: number; maktab?: boolean }) {
  const { t, language, locale } = useCopy();
  const number = new Intl.NumberFormat(locale);
  return <ol className="desk-lesson-path" aria-label={t("qaidaPath")}>
    {qaida.lessons.map(lesson => {
      const name = studyNames.lesson(language, lesson.n, lesson.title);
      const done = completed.includes(lesson.n);
      const label = t("deskBriefLesson", { number: lesson.n, name });
      return <li key={lesson.n} data-done={done} data-current={lesson.n === current}>
        <Link to={"/learn/qaida/" + lesson.n} aria-current={lesson.n === current ? "step" : undefined}
          aria-label={done ? label + " · " + t("deskComplete") : label}>
          {done && maktab ? <DesignIcon name="maktab-desk-check" size={16} /> : number.format(lesson.n)}
        </Link>
      </li>;
    })}
  </ol>;
}

function WordSamples({ maktab, known }: { maktab: boolean; known: Set<string> }) {
  const { language, t } = useCopy();
  const samples = maktab ? childExamples.filter(item => known.has(item.key)) : adultExamples;
  if (maktab && !known.size) return <Link className="action soft" to="/learn/words">{t("findMoreWords")}</Link>;
  const remaining = maktab && samples.length < 3 ? [...known].filter(key => !childExamples.some(item => item.key === key))
    .slice(0, 3 - samples.length).map(key => ({ text: key.slice(key.indexOf(":") + 1), en: "", bn: "" })) : [];
  const items: WordSample[] = [...samples, ...remaining];
  return <div className="desk-word-samples" role="group" aria-label={t(maktab ? "wordsIKnow" : "deskNearPractice")}>
    {items.map(item => <div key={item.text} className="desk-word-sample">
      <span>{item.transliteration && <strong>{item.transliteration}</strong>}{item[language] && <small className="muted">{item[language]}</small>}</span>
      <ArabicText text={item.text} words={[{ gloss: item.en }]} compact showGlosses={false} />
    </div>)}
  </div>;
}

function CustomisePlan({ activities, hidden, items }: { activities: DeskActivity[]; hidden: DeskActivity[]; items: Record<DeskActivity, string> }) {
  const { t } = useCopy();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DeskActivity[]>([]);
  const [saving, setSaving] = useState(false);
  const hasActivity = activities.some(activity => !draft.includes(activity));
  async function apply() {
    setSaving(true);
    try {
      await updateRecord<DeskActivity[]>("study-plan-hidden", [], () => draft);
      setOpen(false);
    } catch { toast.error(t("saveError")); }
    finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" className="desk-heading-action" onClick={() => setDraft(hidden)}>{t("deskCustomise")}</button></DialogTrigger>
    <DialogContent className="awwab-dialog">
      <DialogTitle>{t("deskCustomisePlan")}</DialogTitle>
      <DialogDescription className="muted">{t("deskChooseActivities")}</DialogDescription>
      <div className="desk-plan-choices">
        {activities.map(activity => <label key={activity}><input type="checkbox" checked={!draft.includes(activity)}
          onChange={event => setDraft(previous => event.target.checked ? previous.filter(item => item !== activity) : [...previous, activity])} />
          {items[activity]}</label>)}
      </div>
      {!hasActivity && <p role="status">{t("deskChooseOne")}</p>}
      <button className="action" type="button" disabled={saving || !hasActivity} onClick={() => void apply()}>{t("deskSavePlan")}</button>
    </DialogContent>
  </Dialog>;
}

function AdultLearn({ progress, settings, now, memorise }: { progress: DeskProgress; settings: Settings; now: Date; memorise: MemoriseDesk }) {
  const { t, language, locale } = useCopy();
  const number = new Intl.NumberFormat(locale);
  const percentage = new Intl.NumberFormat(locale, { style: "percent" });
  const { date, lesson, row, rows, completed, activeDays, writing, reviews, known } = progress;
  const hidden = useRecord<DeskActivity[]>("study-plan-hidden", []);
  const queue = reviewQueue(reviews, now, settings.city.timeZone);
  const { due } = queue;
  const attempts = queue.attempts + memorise.attempts;
  const correct = queue.correct + memorise.correct;
  const forecast = queue.forecast.map(({ day, count }) => ({ day, count: count + (memorise.forecast.get(day) ?? 0) }));
  const dueCount = due.length + memorise.due.length;
  const nextPortion = memorise.due[0];
  const activities = deskActivities.filter(activity => activity !== "memorise" || nextPortion);
  const dueSurahs = due.filter(([id]) => chapters.some(item => item.number === Number(id)));
  const dueLetters = due.filter(([id]) => id.startsWith("letter:") || parseQaidaReview(id)).length;
  const dueExercises = due.filter(([id]) => isPathReview(id)).length;
  const recordedToday = (id: number) => Boolean(reviews[id]?.card.last_review &&
    dateKey(new Date(reviews[id].card.last_review), settings.city.timeZone) === date);
  const recall = chapters.find(item => recordedToday(item.number) && reviews[item.number]?.bucket !== "manzil") ??
    chapters.find(item => dueSurahs.some(([id, review]) => Number(id) === item.number && review.bucket !== "manzil")) ?? chapters[2];
  const kept = chapters.find(item => item.number !== recall.number && dueSurahs.some(([id, review]) => Number(id) === item.number && review.bucket === "manzil")) ??
    chapters.find(item => item.number !== recall.number && reviews[item.number]?.bucket === "manzil") ?? chapters[1];
  const chapterName = (item: typeof chapters[number]) => studyNames.surah(language, item.number, chapterNames[item.number] ?? item.transliteration);
  const family = [families[1], ...families].find(item => !writing.includes(item.id)) ?? families[1];
  const familyNumber = families.indexOf(family) + 1;
  const exampleLetters = lettersForFamily(family.id).slice(0, 3).map(item => item.letter).join(" ");
  const latestBefore = qaida.lessons.slice(0, lesson.n - 1).filter(item => completed.includes(item.n)).at(-1);
  const foundationComplete = latestBefore?.n === 3 && [1, 2, 3].every(id => completed.includes(id));
  const nextLesson = qaida.lessons[lesson.n];
  const weekday = new Date(date + "T00:00:00Z").getUTCDay();
  const monday = addDays(date, -((weekday + 6) % 7));
  const focus = lesson.n === 4 ? progress.focus + " · " + t("deskAboutRow", { row, total: rows }) : progress.focus;
  const passage = nextPortion?.passage;
  const passageName = passage?.id.startsWith("juz-") ? t("hifzJuz", { number: Number(passage.id.slice(4)) })
    : passage?.id.startsWith("surah-") ? studyNames.surah(language, passage.ranges[0].chapter, passage.title)
    : passage ? essentialPassageTitle(passage, t) : t("pathsMemorise");
  const labels = { recall: t("deskRecallWords", { name: chapterName(recall), count: recall.words }),
    qaida: t(row < rows ? "deskQaidaRows" : "deskQaidaRow", { number: lesson.n, start: row, end: rows, row }),
    memorise: nextPortion ? `${passageName} · ${formatQuranReference(nextPortion.portion.ref, locale)}` : passageName,
    salah: t("understandSalah"), manzil: t("deskRecite", { name: chapterName(kept) }), takhti: t("deskFamilyPosition", { number: familyNumber }),
    fluency: t("deskThreeSentences") };
  const plan = {
    recall: { type: "sabqi", method: t("deskRecallHints"), path: "/learn/surahs/" + recall.number + "?mode=recall", done: recordedToday(recall.number) },
    qaida: { type: "sabaq", method: t("spellThenRead"), path: "/learn/qaida/" + lesson.n, done: completed.includes(lesson.n) },
    memorise: nextPortion && { type: nextPortion.bucket, method: t(nextPortion.bucket === "sabaq" ? "readThenCheck" : "hifzRepeat"),
      path: nextPortion.to, done: false },
    salah: { type: "words", method: t("wordAnatomy"), path: "/learn/salah", done: false },
    manzil: { type: "manzil", method: t("deskListenRecall"), path: "/learn/surahs/" + kept.number + "?mode=listen", done: recordedToday(kept.number) },
    takhti: { type: "takhti", method: t("traceThenWrite"), path: "/learn/takhti/" + family.id, done: false },
    fluency: { type: "fluency", method: t("readThenCheck"), path: "/learn/fluency", done: false },
  } as const;
  const maximum = Math.max(10, ...forecast.map(item => item.count));
  return <div className="learn-desk">
    <section className="card night desk-resume desk-span-2">
      <div className="row-between desk-lesson-intro">
        <div><p className="caption">{t("studyResumeHeading")}</p><h2>{t("lessonTitle", { number: lesson.n, title: progress.lessonName })}</h2>
          <p className="muted" lang={language}>{focus}</p></div>
        <ArabicText text={progress.preview.slice().reverse().join(" ")} compact />
      </div>
      <div className="row-between desk-lesson-meter"><progress value={progress.progress} max={1} aria-label={t("lessonRows")} /><small className="muted">{percentage.format(progress.progress)}</small></div>
      <Link className="action light desk-resume-action" to={"/learn/qaida/" + lesson.n}><DesignIcon name="desk-play1" size={14} />{t("deskResume", { duration: deskMinutes.qaida })}</Link>
    </section>
    <section className="card desk-metric"><p className="caption">{t("deskStudyStreak")}</p><h2>{t("studyDays", { count: activeDays.length })}</h2>
      <p className="muted">{t("deskPausedStreak")}</p>
      <div className="week-strip equal-row">{Array.from({ length: 7 }, (_, index) => addDays(monday, index)).map(day =>
        <span key={day} data-done={activeDays.includes(day)} title={formatDay(day, { weekday: "long", month: "short", day: "numeric" }, locale)}>
          {formatDay(day, { weekday: "narrow" }, locale)}</span>)}</div>
    </section>
    <section className="card desk-metric"><p className="caption">{t("dueForReview")}</p><h2>{t("studyItems", { count: dueCount })}</h2>
      <p className="muted">{dueCount ? t("deskReviewEstimate", { minutes: due.length + dueSurahs.length + 2 * dueLetters +
        memorise.due.reduce((minutes, item) => minutes + item.minutes, 0),
        surahs: dueSurahs.length, letters: dueLetters, words: due.length - dueSurahs.length - dueLetters - dueExercises,
        exercises: dueExercises + memorise.due.length }) : t("deskNoReviews")}</p>
      <div className="equal-row desk-buckets">{(["sabaq", "sabqi", "manzil"] as const).map(bucket =>
        <div className="counter-tile" data-bucket={bucket} key={bucket}><strong>{number.format(due.filter(([, review]) => review.bucket === bucket).length +
          memorise.due.filter(item => item.bucket === bucket).length)}</strong>
          <small className="caption">{t(bucket).split(" · ")[0]}</small></div>)}</div>
    </section>
    <section className="card desk-span-2 desk-today-plan">
      <div className="row-between desk-heading"><h2>{t("todayStudyPlan")}</h2><CustomisePlan activities={activities} hidden={hidden} items={labels} /></div>
      <div className="table-scroll"><table>
        <thead><tr><th scope="col"><span className="sr-only">{t("status")}</span></th>
          {["studyType", "studyItem", "studyMethod", "studyTime", "studyOpen"].map(key => <th scope="col" key={key}>{key === "studyOpen" ? <span className="sr-only">{t(key)}</span> : t(key)}</th>)}</tr></thead>
        <tbody>{activities.filter(activity => !hidden.includes(activity)).map(activity => {
          const item = plan[activity];
          return <tr key={activity}><td>{item.done && <DesignIcon name="desk-check" size={14} />}</td>
            <td><span className="chip" data-bucket={item.type}>{t(item.type).split(" · ")[0]}</span></td>
            <td><div className="desk-plan-item">{labels[activity]}{activity === "salah" && <ArabicText text={quranText[1][1].uthmani.split(/\s+/)[0]} citation="1:2" verse="1:2" compact />}
              {activity === "takhti" && <ArabicText text={exampleLetters} compact />}</div></td>
            <td className="muted">{item.method}</td><td className="muted">{t("studyMinutes", { count: activity === "memorise" ? nextPortion.minutes : deskMinutes[activity] })}</td>
            <td>{item.done ? <span className="desk-done">{t("deskComplete")}</span> : <Link className="action soft" to={item.path}
              aria-label={t("startStudyItem", { name: labels[activity] })}>{t("studyStart")}</Link>}</td></tr>;
        })}</tbody>
      </table></div>
    </section>
    <section className="card desk-words">
      <DeskHeading to="/learn/words" label={t("wordBank") + " →"}>{t("quranWords")}</DeskHeading>
      <p className="desk-tally"><strong>{number.format(known.size)}</strong> {t("of125Words")}</p>
      <progress value={known.size} max={coreWordTotal} aria-label={t("quranWordsKnown")} />
      <p className="muted">{t("deskWordCoverage", { count: coreWordTotal, coverage: coreWordCoverage })}</p>
      <WordSamples maktab={false} known={known} />
    </section>
    <section className="card desk-reviews">
      <div className="row-between desk-heading"><h2>{t("reviewsAhead")}</h2><span>{t("sevenDays")}</span></div>
      <ol className="forecast">{forecast.map(({ day, count }, index) => <li key={day} data-today={index === 0}
        title={t("deskChartLabel", { day: formatDay(day, { weekday: "long" }, locale), count })}>
        <small>{number.format(count)}</small><i aria-hidden="true" style={{ "--bar-height": Math.max(2, 90 * count / maximum) + "px" } as CSSProperties} />
        <small className="caption">{formatDay(day, { weekday: "short" }, locale)}</small></li>)}</ol>
      <div className="row-between desk-accuracy"><strong>{t("deskReviewAccuracy")}</strong>
        <span>{attempts ? t("deskAccuracyWindow", { rate: correct / attempts }) : "—"}</span></div>
      <p className="muted">{t("deskSpacing")}</p>
    </section>
    <section className="card desk-qaida desk-span-2">
      <DeskHeading to="/learn/qaida" label={t("allLessons")}>{t("qaidaPath")}</DeskHeading>
      <LessonPath completed={completed} current={lesson.n} />
      <div className="desk-qaida-steps equal-row">
        {latestBefore && <Link to={"/learn/qaida/" + latestBefore.n} className="soft"><small className="caption">
          {foundationComplete ? t("deskFirstLessons") : t("deskLesson", { number: latestBefore.n })}</small>
          <strong>{foundationComplete ? t("deskFirstLetters") : studyNames.lesson(language, latestBefore.n, latestBefore.title)}</strong><small className="muted">{t("deskComplete")}</small></Link>}
        <Link className="tint" to={"/learn/qaida/" + lesson.n}><small className="caption">{t("deskLesson", { number: lesson.n })}</small>
          <strong>{progress.lessonName}</strong><small className="muted">{t("deskInProgress", { progress: progress.progress })}</small></Link>
        {nextLesson && <Link to={"/learn/qaida/" + nextLesson.n}><small className="caption">{t("deskLesson", { number: nextLesson.n })}</small>
          <strong>{studyNames.lesson(language, nextLesson.n, nextLesson.title)}</strong><small className="muted">{t("deskUpNext")}</small></Link>}
      </div>
    </section>
    <section className="card desk-chapters">
      <DeskHeading to="/learn/surahs" label={t("all") + " →"}>{t("surahsForSalah")}</DeskHeading>
      {chapters.slice(0, 5).map(chapter => {
        const review = reviews[chapter.number];
        const status = !review ? "deskNew" : isDue(review, now) ? "due" : review.bucket === "manzil" ? "deskKept" : "deskUpNext";
        return <Link key={chapter.number} to={"/learn/surahs/" + chapter.number}><span>{chapterName(chapter)}</span>
          <small className="muted">{t("wordCount", { count: chapter.words })}</small><span className="chip" data-status={status}>{t(status)}</span></Link>;
      })}
    </section>
    <section className="card desk-takhti">
      <DeskHeading to={"/learn/takhti/" + family.id} label={t("practise") + " →"}>{t("takhtiWriting")}</DeskHeading>
      <div className="desk-letter-grid" dir="rtl">{families.map(item => <div key={item.id} data-current={item.id === family.id} data-done={writing.includes(item.id)}>
        <ArabicText text={lettersForFamily(item.id).slice(0, 3).map(letter => letter.letter).join(" ")} compact /></div>)}</div>
      <Link className="muted small" to={"/print/takhti/" + family.id}>{t("deskFamilyPrint", { number: familyNumber, total: families.length })}</Link>
    </section>
  </div>;
}

function MaktabLearn({ progress, settings, now }: { progress: DeskProgress; settings: Settings; now: Date }) {
  const { t, language, locale } = useCopy();
  const number = new Intl.NumberFormat(locale);
  const { date, lesson, completed, activeDays, writing, reviews, known } = progress;
  const logs = usePrayerLogs();
  const calendar = useRecord("calendar", calendarDefaults);
  const lines = useRecord<string[]>("surah-lines-known", []);
  const { next } = currentPrayerSchedule(settings.city, settings.method, settings.school, now, logs);
  const hijri = hijriOn(date, settings.hijriAdjust, calendar.anchors);
  const today = formatDay(date, { weekday: "short", day: "numeric", month: "short" }, locale);
  const nextPrayer = Number.isFinite(next.starts.valueOf()) && t("deskTimeAt", { name: t(next.id), time: formatTime(next.starts, settings.city.timeZone, locale, true) });
  const chapter = chapters.find(item => reviews[item.number] && isDue(reviews[item.number], now)) ??
    chapters.find(item => lines.some(ref => ref.startsWith(item.number + ":"))) ?? chapters[3];
  const elapsedDays = (Date.parse(date) - alphabetCycleStart) / 86_400_000;
  const index = ((elapsedDays % alphabet.letters.length) + alphabet.letters.length) % alphabet.letters.length;
  const letter = alphabet.letters[index];
  const family = families.find(item => item.shapes.includes(letter.family));
  const stars = Math.floor(progress.progress * 5);
  const bookOne = [1, 2, 3].every(id => completed.includes(id));
  const earnedMoon = completed.length >= 5;
  const stickers = [
    { label: "firstLetter", icon: "sparkles", earned: completed.includes(1) || writing.length > 0 },
    { label: "deskBookOne", icon: "book1", earned: bookOne },
    { label: "deskFiveDays", icon: "star2", earned: activeDays.length >= 5 },
    { label: "deskMoon", icon: "moon", earned: earnedMoon },
    { label: "deskNeatWriter", icon: "pen", earned: writing.length >= 3 },
    { label: "deskKindHeart", icon: "heart", earned: prayerStatistics(logs, date).returns > 0 },
  ];
  return <div className="maktab-desk">
    <header className="desk-maktab-header">
      <div><p className="caption">{today} · {number.format(hijri.day)} {hijriMonthName(hijri.month, locale)}</p><h1>{t("deskLearnToday")}</h1></div>
      {nextPrayer && <Link className="chip" to="/today"><DesignIcon name="maktab-desk-clock1" size={16} />{nextPrayer}</Link>}
      <Link className="action soft" to={"/print/takhti/" + family.id}><DesignIcon name="maktab-desk-download1" size={16} />{t("printPracticeSheet")}</Link>
    </header>
    <div className="desk-maktab-lead">
      <section className="card night desk-lesson">
        <div className="row-between desk-lesson-intro">
          <div><p className="caption">{t("studyResumeHeading")}</p>
            <h2>{t("deskBriefLesson", { number: lesson.n, name: progress.lessonName })}</h2><p className="muted">{progress.focus}</p></div>
          <div className="desk-lesson-letters">{progress.preview.map((example, index) => <div key={index} data-harakat={lesson.n === 4 ? ["damma", "kasra", "fatha"][index] : undefined}>
            <ArabicText text={example} compact /></div>)}</div>
        </div>
        <div className="desk-lesson-actions">
          <Link className="action" to={"/learn/qaida/" + lesson.n}><DesignIcon name="maktab-desk-play" size={16} />{t("studyResume", { duration: deskMinutes.qaida })}</Link>
          <div className="desk-stars" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <DesignIcon key={index} name={index < stars ? "maktab-desk-star" : "maktab-desk-star1"} size={20} />)}</div>
          <small className="muted">{t("deskStars", { count: stars })}</small>
        </div>
      </section>
      <section className="card desk-stickers"><h2>{t("stickers")}</h2>
        <ul className="desk-sticker-grid">{stickers.map(sticker =>
          <li key={sticker.label} data-earned={sticker.earned}><DesignIcon name={"maktab-desk-" + sticker.icon} size={24} />
            <small>{t(sticker.label)}<span className="sr-only"> · {t(sticker.earned ? "deskComplete" : "deskUpNext")}</span></small></li>)}</ul>
        <p className="muted small">{t(earnedMoon ? "deskMoonEarned" : "deskMoonNext", { count: 5 - completed.length })}</p>
      </section>
    </div>
    <div className="desk-maktab-cards">
      <section className="card desk-letter"><h2>{t("letterOfTheDay")}</h2><div className="desk-letter-detail">
        <span className="tint"><ArabicText text={letter.letter} compact /></span>
        <div><p>{language === "bn" ? letter.nameBn : letter.name}</p>
          <small className="muted">{t(letter.letter === "ث" ? "deskThaSound" : "deskLetterSound", { sound: letter.sound })}</small>
          {letter.letter === "ث" && <small className="muted">{t("deskThaDots")}</small>}</div>
      </div><Link className="action soft" to={"/learn/takhti/" + family.id + "?letter=" + encodeURIComponent(letter.letter)}>{t("traceIt")}</Link></section>
      <section className="card desk-surah"><h2>{t("surahPractice")}</h2>
        <p>{t("deskSurahLines", { name: studyNames.surah(language, chapter.number, chapterNames[chapter.number] ?? chapter.transliteration), count: chapter.ayahs })}</p>
        <ul>{quranText[chapter.number].map((verse, index) => {
          const known = lines.includes(verse.ref) || reviews[chapter.number]?.bucket === "manzil";
          return <li key={verse.ref} data-known={known}><DesignIcon name={known ? "maktab-desk-star3" : "maktab-desk-star4"} size={16} />
            {t(known ? "deskCanSayLine" : "deskLine", { number: index + 1 })}</li>;
        })}</ul>
        <Link className="action" to={"/learn/surahs/" + chapter.number + "?mode=listen"}><DesignIcon name="maktab-desk-play1" size={14} />{t("deskListenRepeat")}</Link>
      </section>
      <section className="card desk-words"><h2>{t("wordsIKnow")}</h2>
        <Link className="desk-tally" to="/learn/words"><strong>{number.format(known.size)}</strong> {t("deskQuranWords")}</Link>
        <WordSamples maktab known={known} />
      </section>
    </div>
    <section className="card desk-qaida">
      <DeskHeading to={"/learn/qaida/" + lesson.n} label={t("deskLessonOf", { number: lesson.n, total: numberOfLessons })}>{t("qaidaPath")}</DeskHeading>
      <LessonPath completed={completed} current={lesson.n} maktab />
    </section>
  </div>;
}

export function LearnDesktop({ settings, now, memorise }: { settings: Settings; now: Date; memorise: MemoriseDesk }) {
  const progress = useDeskProgress(settings, now);
  return settings.mode === "maktab" ? <MaktabLearn progress={progress} settings={settings} now={now} /> :
    <AdultLearn progress={progress} settings={settings} now={now} memorise={memorise} />;
}
