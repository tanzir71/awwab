import { Link } from "react-router-dom";
import { BookOpen, Headphones, Languages, PenLine, ScrollText, Sparkles, Star } from "lucide-react";
import { ArabicText } from "@/components/ArabicText";
import { ListLink, SectionHeading } from "@/components/Surface";
import { useRecord } from "@/hooks/use-awwab";
import { addDays, dateKey, formatDay } from "@/lib/dates";
import { bucketNames, isDue, type Reviews } from "@/lib/reviews";
import type { Settings } from "@/lib/storageService";
import { families, lettersForFamily } from "@/lib/takhti";
import { normalizeWord, splitArabicWords } from "@/lib/wordAnatomy";
import qaida from "../../docs/content/qaida-lessons.json";
import surahs from "../../docs/content/surahs-for-salah.json";
import { quranText } from "@/lib/quran";
import { message } from "@/lib/copy";

const practice = surahs.surahs.slice(0, 12);
const labelFor = (id: string) => practice.find(item => item.number === Number(id))?.transliteration;
const nextLetter = (index: number) => lettersForFamily(families[index % families.length].id)[0];

export function Learn({ settings, desktop }: { settings: Settings; desktop: boolean }) {
  const t = message.bind(null, settings);
  const number = new Intl.NumberFormat(settings.language);
  const lessonNumber = useRecord("qaida-current", 1);
  const lesson = qaida.lessons.find(item => item.n === lessonNumber) ?? qaida.lessons[0];
  const row = useRecord(`qaida-row-${lesson.n}`, 0);
  const completed = useRecord<number[]>("qaida-complete", []);
  const activeDays = useRecord<string[]>("study-days", []);
  const known = useRecord<string[]>("words-known", []);
  const reviews = useRecord<Reviews>("reviews", {});
  const now = new Date();
  const date = dateKey(now, settings.city.timeZone);
  const due = Object.entries(reviews).filter(([, review]) => isDue(review, now));
  const forecast = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(date, i);
    return { day, count: Object.values(reviews).filter(review => dateKey(new Date(review.card.due), settings.city.timeZone) === day).length };
  });
  const knownVocabulary = useRecord<string[]>("word-bank-known", []);
  const words = new Set([
    ...quranText[1].filter(verse => known.includes(verse.ref)).flatMap(verse => splitArabicWords(verse.uthmani).map(normalizeWord)),
    ...knownVocabulary.map(item => item.replace(/^word:/, "")),
  ]).size;
  const reviewRef = due.find(([id]) => labelFor(id))?.[0] ?? "103";
  const letter = nextLetter(Number(date.slice(-2)));
  const maktab = settings.mode === "maktab";
  const dueCount = Math.max(1, ...forecast.map(item => item.count));
  const attempted = Object.values(reviews).reduce((sum, review) => sum + (review.attempts ?? 0), 0);
  const correct = Object.values(reviews).reduce((sum, review) => sum + (review.correct ?? 0), 0);
  const duration = maktab ? 3 : 5;
  const title = t("lessonTitle", { number: lesson.n, title: lesson.title });
  const rowLabel = t("lessonRow", { name: lesson.traditional, row: row + 1 });
  const reviewSurah = labelFor(reviewRef) ?? "Al-Asr";

  const cards = [
    { id: "recall", kind: "Sabqi", title: reviewSurah, detail: t("readThenRecall"), minutes: 2, path: `/learn/surahs/${reviewRef}` },
    { id: "qaida", kind: "Sabaq", title, detail: t("spellThenRead"), minutes: duration, path: `/learn/qaida/${lesson.n}` },
    { id: "salah", kind: t("words"), title: t("understandSalah"), detail: t("wordAnatomy"), minutes: 2, path: "/learn/salah" },
    { id: "takhti", kind: t("takhti"), title: t("practiseShapes"), detail: t("traceThenWrite"), minutes: 3, path: "/learn/takhti" },
    { id: "fluency", kind: t("fluency"), title: t("readModernArabic"), detail: t("readThenCheck"), minutes: 2, path: "/learn/fluency" },
  ];

  if (!desktop) return <div className="stack">
    <header><p className="caption">{t("learn")}</p><h1>{t("studyHome")}</h1></header>
    <section className="card night compact-stack">
      <p className="caption">{t("continueLearning")}</p><h2>{title}</h2>
      <p className="muted">{rowLabel}</p>
      <Link className="action light" to={`/learn/qaida/${lesson.n}`}>{t("resumeLesson", { duration })}</Link>
    </section>
    <div className="compact-stack">
      <ListLink to={`/learn/surahs/${reviewRef}`} icon={<Headphones size={20} />} title={t("recallSurah", { name: reviewSurah })} detail={due.length ? t("itemsDue", { count: due.length }) : t("shortSurah")} />
      <ListLink to="/learn/qaida" icon={<BookOpen size={20} />} title={t("nooraniQaida")} detail={t("lessonsPractised", { count: completed.length })} />
      <ListLink to="/learn/surahs" icon={<Headphones size={20} />} title={t("surahsForSalah")} detail={t("listenReadRecall")} />
      <ListLink to="/learn/salah" icon={<Sparkles size={20} />} title={t("understandSalah")} detail={t("tapToSpell")} />
      <ListLink to="/learn/takhti" icon={<PenLine size={20} />} title={t("takhti")} detail={t("learnLetterShapes")} />
      <ListLink to="/learn/fluency" icon={<Languages size={20} />} title={t("fluency")} detail={t("exploreArabic")} />
      <ListLink to="/learn/hadith" icon={<ScrollText size={20} />} title={t("hadith")} detail={t("searchHadith")} />
    </div>
  </div>;

  const path = <section className={`card compact-stack ${maktab ? "path-all" : "desk-span-2"}`}>
    <SectionHeading title={t("qaidaPath")} to="/learn/qaida" label={t("allLessons")} />
    <div className="qaida-path">
      {qaida.lessons.map(item => <Link key={item.n} className={`path-number ${item.n === lesson.n ? "current" : completed.includes(item.n) ? "done" : ""}`}
        to={`/learn/qaida/${item.n}`} aria-label={t("lessonTitle", { number: item.n, title: item.title })}>{number.format(item.n)}</Link>)}
    </div>
  </section>;
  const resume = <section className={`card night compact-stack learn-continue ${maktab ? "desk-span-2" : ""}`}>
    <p className="caption">{t("studyResumeHeading")}</p>
    <div className="row-between"><div><h2>{title}</h2><p className="muted">{rowLabel}</p></div>
      <ArabicText text="بَ بِ بُ" /></div>
    <Link className="action light justify-self-start" to={`/learn/qaida/${lesson.n}`}>{t("studyResume", { duration })}</Link>
  </section>;

  if (maktab) return <div className="maktab-desk stack">
    {resume}
    <section className="card compact-stack">
      <h2>{t("stickers")}</h2>
      <div className="equal-row">
        {([["firstLetter", completed.length >= 1], ["qaidaExplorer", completed.length >= 6], ["wordFinder", words >= 10]] as const).map(([text, earned]) => <div className={`card compact-stack ${earned ? "soft" : ""}`} key={text}><Star size={18} fill={earned ? "currentColor" : "none"} /><small>{t(text)}</small></div>)}
      </div>
    </section>
    <section className="card compact-stack"><h2>{t("letterOfTheDay")}</h2><ArabicText text={letter.letter} /><p>{settings.language === "bn" ? letter.nameBn : letter.name} · {letter.sound}</p><Link className="action soft" to="/learn/takhti">{t("traceIt")}</Link></section>
    <section className="card compact-stack"><h2>{t("surahPractice")}</h2><p>{reviewSurah}</p><Link className="action" to={`/learn/surahs/${reviewRef}`}>{t("practiseSurah")}</Link></section>
    <section className="card compact-stack"><h2>{t("wordsIKnow")}</h2><h3 className="numeral">{number.format(words)}</h3><Link className="action soft" to="/learn/salah">{t("findMoreWords")}</Link></section>
    {path}
  </div>;

  return <div className="learn-desk stack desk-card">
    {resume}
    <section className="card compact-stack"><p className="caption">{t("studyRhythm")}</p><h2>{t("studyDays", { count: activeDays.length })}</h2>
      <p className="muted">{t("studyDaysCount")}</p>
      <div className="equal-row week-strip">{Array.from({ length: 7 }, (_, i) => addDays(date, i - 6)).map(day => <span key={day} data-done={activeDays.includes(day)} title={day}>{formatDay(day, { weekday: "narrow" }, settings.language)}</span>)}</div>
    </section>
    <section className="card compact-stack"><p className="caption">{t("dueForReview")}</p><h2>{t("studyItems", { count: due.length })}</h2>
      <div className="equal-row">{(["sabaq", "sabqi", "manzil"] as const).map(bucket => <span className="counter-tile" key={bucket}><strong>{number.format(due.filter(([, review]) => review.bucket === bucket).length)}</strong><small>{bucketNames[bucket].split(" ")[0]}</small></span>)}</div>
      <Link className="text-button" to={`/learn/surahs/${reviewRef}`}>{t("startReview")}</Link>
    </section>
    <section className="card compact-stack desk-span-2">
      <SectionHeading title={t("todayStudyPlan")} to="/learn/qaida" label={t("browseLessons")} />
      <div className="table-scroll"><table><thead><tr>{["studyType", "studyItem", "studyMethod", "studyTime", "studyOpen"].map(key => <th key={key}>{t(key)}</th>)}</tr></thead>
        <tbody>{cards.map(item => <tr key={item.id}><td><span className="chip">{item.kind}</span></td><td>{item.title}</td><td>{item.detail}</td><td>{t("studyMinutes", { count: item.minutes })}</td><td><Link className="text-button" to={item.path} aria-label={t("startStudyItem", { name: item.title })}>{t("studyStart")}</Link></td></tr>)}</tbody>
      </table></div>
    </section>
    <section className="card compact-stack">
      <SectionHeading title={t("quranWords")} to="/learn/words" label={`${t("wordBank")} →`} />
      <p><strong className="numeral">{number.format(words)}</strong> {t("of125Words")}</p><progress value={Math.min(125, words)} max={125} aria-label={t("quranWordsKnown")} />
      <p className="muted">{t("startWithSalah")}</p>
      <ArabicText text="يَوْمٌ عِلْمٌ رَحْمَةٌ" compact />
    </section>
    <section className="card compact-stack">
      <div className="row-between"><h2>{t("reviewsAhead")}</h2><small className="muted">{t("sevenDays")}</small></div>
      <div className="forecast">{forecast.map(item => <div key={item.day} aria-label={`${item.day}: ${item.count} reviews`}><small>{number.format(item.count)}</small>
        <i style={{ "--height": `${Math.max(4, item.count / dueCount * 100)}%` } as React.CSSProperties} /><small>{formatDay(item.day, { weekday: "short" }, settings.language)}</small></div>)}</div>
      <p className="muted">{attempted ? t("recallScore", { count: Math.round(correct / attempted * 100) }) : t("recallHistory")}</p>
    </section>
    {path}
    <section className="card compact-stack">
      <SectionHeading title={t("surahsForSalah")} to="/learn/surahs" label={`${t("all")} →`} />
      {practice.slice(0, 5).map(item => <Link className="study-item" key={item.number} to={`/learn/surahs/${item.number}`}><span>{item.transliteration}</span><small>{t("wordCount", { count: item.words })}</small></Link>)}
    </section>
    <section className="card compact-stack">
      <SectionHeading title={t("takhtiWriting")} to="/learn/takhti" label={`${t("practise")} →`} />
      <div className="takhti-shortcuts">{families.map(item => <Link className="chip" key={item.id} to={`/learn/takhti/${item.id}`}>{item.title}</Link>)}</div>
    </section>
  </div>;
}
