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

const practice = surahs.surahs.slice(0, 12);
const labelFor = (id: string) => practice.find(item => item.number === Number(id))?.transliteration;
const nextLetter = (index: number) => lettersForFamily(families[index % families.length].id)[0];

export function Learn({ settings, desktop }: { settings: Settings; desktop: boolean }) {
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

  const cards = [
    { id: "recall", kind: "Sabqi", title: labelFor(reviewRef), detail: "Read, then recall", time: "2 min", path: `/learn/surahs/${reviewRef}` },
    { id: "qaida", kind: "Sabaq", title: `Qaida ${lesson.n} · ${lesson.title}`, detail: "Spell, then read", time: `${duration} min`, path: `/learn/qaida/${lesson.n}` },
    { id: "salah", kind: "Words", title: "Understand your salah", detail: "Word anatomy", time: "2 min", path: "/learn/salah" },
    { id: "takhti", kind: "Takhti", title: "Practise letter shapes", detail: "Trace, then write", time: "3 min", path: "/learn/takhti" },
    { id: "fluency", kind: "Fluency", title: "Read modern Arabic", detail: "Read, then check", time: "2 min", path: "/learn/fluency" },
  ];

  if (!desktop) return <div className="stack">
    <header><p className="caption">Learn</p><h1>{maktab ? "Let’s learn today" : "Pick up where you left off"}</h1></header>
    <section className="card night compact-stack">
      <p className="caption">Continue learning</p><h2>Qaida {lesson.n} · {lesson.title}</h2>
      <p className="muted">{lesson.traditional} · Row {row + 1}</p>
      <Link className="action light" to={`/learn/qaida/${lesson.n}`}>Resume · about {duration} min</Link>
    </section>
    <div className="compact-stack">
      <ListLink to={`/learn/surahs/${reviewRef}`} icon={<Headphones size={20} />} title={`Recall ${labelFor(reviewRef)}`} detail={due.length ? `${due.length} items due` : "Start with a short surah"} />
      <ListLink to="/learn/qaida" icon={<BookOpen size={20} />} title="Noorani Qaida" detail={`${completed.length} of 17 lessons practised`} />
      <ListLink to="/learn/surahs" icon={<Headphones size={20} />} title="Surahs for salah" detail="Listen, read and recall" />
      <ListLink to="/learn/salah" icon={<Sparkles size={20} />} title="Understand your salah" detail="Tap a word to spell it out" />
      <ListLink to="/learn/takhti" icon={<PenLine size={20} />} title="Takhti" detail="Learn Arabic letter shapes" />
      <ListLink to="/learn/fluency" icon={<Languages size={20} />} title="Fluency" detail="Explore Quranic and modern Arabic" />
      <ListLink to="/learn/hadith" icon={<ScrollText size={20} />} title="Hadith" detail="Search the curated collection offline" />
    </div>
  </div>;

  const path = <section className={`card compact-stack ${maktab ? "path-all" : "desk-span-2"}`}>
    <SectionHeading title={maktab ? "My Qaida path" : "Noorani Qaida path"} to="/learn/qaida" label="All lessons →" />
    <div className="qaida-path">
      {qaida.lessons.map(item => <Link key={item.n} className={`path-number ${item.n === lesson.n ? "current" : completed.includes(item.n) ? "done" : ""}`}
        to={`/learn/qaida/${item.n}`} aria-label={`Lesson ${item.n}: ${item.title}`}>{item.n}</Link>)}
    </div>
  </section>;
  const resume = <section className={`card night compact-stack learn-continue ${maktab ? "desk-span-2" : ""}`}>
    <p className="caption">{maktab ? "Today’s lesson" : "Continue where you left off"}</p>
    <div className="row-between"><div><h2>Qaida {lesson.n} · {lesson.title}</h2><p className="muted">{lesson.traditional} · Row {row + 1}</p></div>
      <ArabicText text="بَ بِ بُ" /></div>
    <Link className="action light justify-self-start" to={`/learn/qaida/${lesson.n}`}>{maktab ? "Start lesson" : "Resume"} · {duration} min</Link>
  </section>;

  if (maktab) return <div className="maktab-desk stack">
    {resume}
    <section className="card compact-stack">
      <h2>My stickers</h2>
      <div className="equal-row">
        {[["First letter", completed.length >= 1], ["Qaida explorer", completed.length >= 6], ["Word finder", words >= 10]].map(([text, earned]) => <div className={`card compact-stack ${earned ? "soft" : ""}`} key={String(text)}><Star size={18} fill={earned ? "currentColor" : "none"} /><small>{text}</small></div>)}
      </div>
    </section>
    <section className="card compact-stack"><h2>Letter of the day</h2><ArabicText text={letter.letter} /><p>{letter.name} · {letter.sound}</p><Link className="action soft" to="/learn/takhti">Trace it</Link></section>
    <section className="card compact-stack"><h2>Surah practice</h2><p>{labelFor(reviewRef)}</p><Link className="action" to={`/learn/surahs/${reviewRef}`}>Practise this surah</Link></section>
    <section className="card compact-stack"><h2>Words I know</h2><h3 className="numeral">{words}</h3><Link className="action soft" to="/learn/salah">Find more words</Link></section>
    {path}
  </div>;

  return <div className="learn-desk stack desk-card">
    {resume}
    <section className="card compact-stack"><p className="caption">Study rhythm</p><h2>{activeDays.length} {activeDays.length === 1 ? "day" : "days"}</h2>
      <p className="muted">Every day you study counts.</p>
      <div className="equal-row week-strip">{Array.from({ length: 7 }, (_, i) => addDays(date, i - 6)).map(day => <span key={day} data-done={activeDays.includes(day)} title={day}>{formatDay(day, { weekday: "narrow" })}</span>)}</div>
    </section>
    <section className="card compact-stack"><p className="caption">Due for review</p><h2>{due.length} {due.length === 1 ? "item" : "items"}</h2>
      <div className="equal-row">{(["sabaq", "sabqi", "manzil"] as const).map(bucket => <span className="counter-tile" key={bucket}><strong>{due.filter(([, review]) => review.bucket === bucket).length}</strong><small>{bucketNames[bucket].split(" ")[0]}</small></span>)}</div>
      <Link className="text-button" to={`/learn/surahs/${reviewRef}`}>Start review</Link>
    </section>
    <section className="card compact-stack desk-span-2">
      <SectionHeading title="Today’s plan" to="/learn/qaida" label="Browse lessons" />
      <div className="table-scroll"><table><thead><tr><th>Type</th><th>Item</th><th>Method</th><th>Time</th><th>Open</th></tr></thead>
        <tbody>{cards.map(item => <tr key={item.id}><td><span className="chip">{item.kind}</span></td><td>{item.title}</td><td>{item.detail}</td><td>{item.time}</td><td><Link className="text-button" to={item.path} aria-label={`Start ${item.title}`}>Start</Link></td></tr>)}</tbody>
      </table></div>
    </section>
    <section className="card compact-stack">
      <SectionHeading title="Quran words" to="/learn/words" label="Word bank →" />
      <p><strong className="numeral">{words}</strong> of 125 words</p><progress value={words} max={125} aria-label="Quran words known" />
      <p className="muted">Start with the words you read in salah.</p>
      <ArabicText text="يَوْمٌ عِلْمٌ رَحْمَةٌ" compact />
    </section>
    <section className="card compact-stack">
      <div className="row-between"><h2>Reviews ahead</h2><small className="muted">7 days</small></div>
      <div className="forecast">{forecast.map(item => <div key={item.day} aria-label={`${item.day}: ${item.count} reviews`}><small>{item.count}</small>
        <i style={{ "--height": `${Math.max(4, item.count / dueCount * 100)}%` } as React.CSSProperties} /><small>{formatDay(item.day, { weekday: "short" })}</small></div>)}</div>
      <p className="muted">{attempted ? `${Math.round(correct / attempted * 100)}% marked Got it` : "Complete a review to see your recall history."}</p>
    </section>
    {path}
    <section className="card compact-stack">
      <SectionHeading title="Surahs for salah" to="/learn/surahs" label="All →" />
      {practice.slice(0, 5).map(item => <Link className="study-item" key={item.number} to={`/learn/surahs/${item.number}`}><span>{item.transliteration}</span><small>{item.words} words</small></Link>)}
    </section>
    <section className="card compact-stack">
      <SectionHeading title="Takhti · writing" to="/learn/takhti" label="Practise →" />
      <div className="takhti-shortcuts">{families.map(item => <Link className="chip" key={item.id} to={`/learn/takhti/${item.id}`}>{item.title}</Link>)}</div>
    </section>
  </div>;
}
