import { useDeferredValue, useEffect, useState } from "react";
import { BookOpen, ChevronRight, Headphones, Search } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { VerseAudio } from "@/components/VerseAudio";
import { SectionNav } from "@/components/Surface";
import { useDesktop, useRecord } from "@/hooks/use-awwab";
import { asset } from "@/lib/config";
import { prayerGuidePath } from "@/lib/prayerGuide";
import { qaidaRows } from "@/lib/qaidaPractice";
import { grades, isDue, type ReviewGrade, type Reviews } from "@/lib/reviews";
import { useCopy } from "@/lib/copy";
import { studyNames, studySearchTerm } from "@/lib/study-copy";
import { updateRecord, type Settings } from "@/lib/storageService";
import { finishQaidaLesson, momentPath, rememberQaidaPlace, saveSurahReview } from "@/lib/studyMilestones";
import { splitArabicWords, wordAnatomy } from "@/lib/wordAnatomy";
import alphabet from "../../docs/content/arabic-letters.json";
import qaida from "../../docs/content/qaida-lessons.json";
import surahs from "../../docs/content/surahs-for-salah.json";
import hadith from "../../docs/content/hadith-curated.json";
import { quranText } from "@/lib/quran";
import { useUi } from "@/lib/uiState";
import sample from "../../docs/content/word-anatomy.sample.json";
import { TraceBoard } from "./Takhti";

const fullChapters = surahs.surahs.slice(0, 12);
const supportedSurah = (number: number) => quranText[number];
const studyModes = ["listen", "read", "recall"] as const;

function wrapAyah(text: string) {
  const words = text.split(/\s+/);
  const result: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && (line.length + word.length > 33 || line.split(" ").length >= 4)) {
      result.push(line);
      line = "";
    }
    line = line ? `${line} ${word}` : word;
  }
  return [...result, line].filter(Boolean).join("\n");
}

function SurahList({ selected }: { selected?: number }) {
  const { language, t } = useCopy();
  const reviews = useRecord<Reviews>("reviews", {});
  const now = new Date();
  return <section className="compact-stack">
    {fullChapters.map(chapter => <Link className={`list-row ${chapter.number === selected ? "soft" : ""}`} key={chapter.number} to={`/learn/surahs/${chapter.number}`}>
      <span className="icon-box"><BookOpen size={19} /></span><span><strong>{studyNames.surah(language, chapter.number, chapter.transliteration)}</strong><small>{t("wordCount", { count: chapter.words })} · {t(reviews[chapter.number]?.bucket ?? "sabaq")}</small></span>
      {reviews[chapter.number] && isDue(reviews[chapter.number], now) ? <span className="chip soft">{t("due")}</span> : <ChevronRight size={18} />}
    </Link>)}
  </section>;
}

export function SurahReader({ settings }: { settings: Settings }) {
  const { t } = useCopy();
  const { id } = useParams();
  const surah = fullChapters.find(chapter => chapter.number === Number(id));
  if (!surah) return <div className="stack"><SectionNav title={t("surahsForSalah")} back="/learn" /><SurahList /></div>;
  return <SurahStudy key={id} surah={surah} settings={settings} />;
}

function SurahStudy({ surah, settings }: { surah: typeof fullChapters[number]; settings: Settings }) {
  const [params] = useSearchParams();
  const { language, t } = useCopy();
  const name = studyNames.surah(language, surah.number, surah.transliteration);
  const [mode, setMode] = useState<typeof studyModes[number]>(() => studyModes.find(mode => mode === params.get("mode")) ?? "read");
  const [hints, setHints] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const reviews = useRecord<Reviews>("reviews", {});
  const rememberedLines = useRecord<string[]>("surah-lines-known", []);
  const bucket = reviews[surah.number]?.bucket ?? "sabaq";
  const verses = supportedSurah(surah.number);
  const desktop = useDesktop();
  const selectWord = useUi(state => state.selectWord);
  useEffect(() => {
    if (!desktop) return;
    const first = verses[0];
    selectWord({ word: splitArabicWords(first.uthmani)[0], citation: first.ref, verse: first.ref, position: 1, connected: false });
  }, [desktop, selectWord, verses]);
  async function grade(value: ReviewGrade) {
    if (saving || saved) return;
    setSaving(true);
    try {
      const moved = await saveSurahReview(surah.number, value, new Date(), settings.city.timeZone);
      setSaved(true);
      if (moved) navigate(momentPath("surah", surah.number));
    } catch { toast.error(t("reviewSaveError")); }
    finally { setSaving(false); }
  }
  return <div className="study-workspace">
    <aside className="desktop-queue stack" aria-label={t("surahList")}><h2>{t("surahsForSalah")}</h2><SurahList selected={surah.number} /></aside>
    <div className="stack">
      <SectionNav title={t("chapterHeading", { name, number: surah.number })} back={prayerGuidePath(params.get("fromPrayer")) ?? "/learn/surahs"} />
      <div className="equal-row study-tabs" role="group" aria-label={t("studyMode")}>
        {studyModes.map(item => <button className={`action ${mode === item ? "light" : "plain"}`} aria-pressed={mode === item} key={item} onClick={() => { setMode(item); setSaved(false); }}>{t(item)}</button>)}
      </div>
      <p className="muted small"><span className="chip soft">{t(bucket)}</span> {t("chapterCounts", { verses: surah.ayahs, words: surah.words })}</p>
      <p className="small muted">{t("spellOutHint")}</p>
      {mode === "listen" && <section className="card stack">
        <h2 className="with-icon"><Headphones size={20} /> {t("practiseAloud")}</h2>
        <VerseAudio audioRef={`surah:${surah.number}`} label={name} compare />
        <Link to={`/you/audio?surah=${surah.number}`} className="text-button">{t("downloadRecitation")}</Link>
      </section>}
      {verses.map((verse, i) => {
        const reading = mode !== "recall" || i === 0;
        const recall = reading ? "read" : hints[verse.ref] ? "hint" : "hidden";
        return <section className={`card stack ${!reading && i > 1 ? "tint" : ""}`} key={verse.ref}>
          <header className="row-between"><a href={`https://quran.com/${verse.ref.replace(":", "/")}`} className="chip">{verse.ref}</a>
            {!reading && <button className="text-button" onClick={() => setHints(value => ({ ...value, [verse.ref]: !value[verse.ref] }))}>{t(hints[verse.ref] ? "hideInitials" : "showInitials")}</button>}
          </header>
          <div className="text-right"><ArabicText text={wrapAyah(verse[settings.script])} citation={verse.ref} verse={verse.ref} recall={recall} mushaf={settings.script}
            words={splitArabicWords(verse.uthmani).map(anatomyWord => ({ anatomyWord }))} /></div>
          <p className={reading ? "" : "muted"}>{!reading && `${t("cue")} · `}<span lang="en">{verse.english}</span></p>
          {mode === "listen" && <VerseAudio audioRef={verse.ref} label={t("verseLabel", { number: i + 1 })} compare />}
          {settings.mode === "maktab" && mode !== "read" && <button className={rememberedLines.includes(verse.ref) ? "action" : "action soft"} type="button" aria-pressed={rememberedLines.includes(verse.ref)}
            onClick={() => void updateRecord<string[]>("surah-lines-known", [], known =>
              known.includes(verse.ref) ? known.filter(ref => ref !== verse.ref) : [...known, verse.ref]).catch(() => toast.error(t("saveError")))}>
            {t("deskCanSayLine", { number: i + 1 })}
          </button>}
        </section>;
      })}
      <section className="compact-stack">
        <h2>{t("howDidItGo")}</h2>
        <div className="equal-row">
          {(Object.keys(grades) as ReviewGrade[]).map(value => <button className={`action ${value === "got-it" ? "" : "light"}`} key={value} disabled={saving || saved} onClick={() => void grade(value)}>{t(value)}</button>)}
        </div>
        {saved && <p className="muted" role="status">{t("reviewSaved")}</p>}
      </section>
      {surah.number !== 1 && <p className="card soft">{t("tryInMaghrib", { name })}</p>}
      <p className="muted small"><a href={settings.script === "indopak" ? "https://digitalkhatt.org" : "https://tanzil.net/docs/text_license"}>{t(settings.script === "indopak" ? "indopakCredit" : "tanzilCredit")}</a> · {t("englishTranslationCredit")}</p>
    </div>
  </div>;
}

export function Qaida({ settings }: { settings: Settings }) {
  const { language, t } = useCopy();
  const formatNumber = new Intl.NumberFormat(language);
  const { id } = useParams();
  const current = useRecord("qaida-current", 1);
  const completed = useRecord<number[]>("qaida-complete", []);
  const lesson = qaida.lessons.find(item => item.n === Number(id));
  if (!lesson) return <div className="stack">
    <SectionNav title={t("nooraniQaida")} back="/learn" />
    {qaida.lessons.map(item => <Link key={item.n} className="list-row" to={`/learn/qaida/${item.n}`}>
      <span className="icon-box">{formatNumber.format(item.n)}</span><span><strong>{studyNames.lesson(language, item.n, item.title)}</strong><small lang="en">{item.traditional}</small></span>
      {completed.includes(item.n) ? <span className="chip soft">{t("practised")}</span> : current === item.n ? <span className="chip soft">{t("continueAction")}</span> : <ChevronRight size={18} />}
    </Link>)}
  </div>;
  return <QaidaLesson key={id} lesson={lesson} settings={settings} />;
}

function QaidaLesson({ lesson, settings }: {
  lesson: typeof qaida.lessons[number]; settings: Settings;
}) {
  const { language, t } = useCopy();
  const title = studyNames.lesson(language, lesson.n, lesson.title);
  const storedRow = useRecord(`qaida-row-${lesson.n}`, 0);
  const [activeRow, setActiveRow] = useState<number>();
  const [answer, setAnswer] = useState<number>();
  const navigate = useNavigate();
  const completed = useRecord<number[]>("qaida-complete", []);
  const [saving, setSaving] = useState(false);
  const finished = completed.includes(lesson.n);
  const drill = lesson.n === 1 || lesson.n === 4 || lesson.n === 5;
  const ampara = settings.spellStyle === "ampara-bn";
  const options = lesson.n === 1 ? ampara ? ["বা", "তা", "ছা"] : ["Bāʾ", "Tāʾ", "Thāʾ"]
    : lesson.n === 4 ? ampara ? ["যবর", "যের", "পেশ"] : ["Fatha", "Kasra", "Ḍamma"]
    : lesson.n === 5 ? ["an", "in", "un"] : [1, 2, 3].map(count => t("letterCount", { count }));
  const prompt = lesson.n === 1 ? "ب" : lesson.n === 4 ? "بِ" : lesson.n === 5 ? "بٌ" : "قُلْ";
  const correct = lesson.n === 1 ? 0 : lesson.n === 5 ? 2 : 1;
  const rows = qaidaRows(lesson.n);
  const row = Math.max(0, Math.min(rows.length - 1, activeRow ?? storedRow));
  const rowLetters = rows[row];
  const firstGlyph = wordAnatomy(rowLetters.flat()[0]).letters[0]?.base;
  const traceLetter = alphabet.letters.find(item => item.letter === firstGlyph) ?? alphabet.letters[0];
  const isMaktab = settings.mode === "maktab";
  useEffect(() => {
    void rememberQaidaPlace(lesson.n).catch(() => toast.error(t("lessonSaveError")));
  }, [lesson.n, t]);

  function move(next: number) {
    setActiveRow(next);
    void rememberQaidaPlace(lesson.n, next).catch(() => toast.error(t("lessonSaveError")));
  }
  async function finish() {
    if (saving || finished) return;
    setSaving(true);
    try {
      const result = await finishQaidaLesson(lesson.n, new Date(), settings.city.timeZone);
      if (result) navigate(isMaktab && result.bookComplete ? momentPath("maktab", qaida.lessons.length) : momentPath("qaida", lesson.n));
    } catch { toast.error(t("lessonSaveError")); }
    finally { setSaving(false); }
  }

  return <div className="qaida-workspace">
    <aside className="qaida-queue card compact-stack" aria-label={t("qaidaLessons")}>
      <h2>{t("nooraniQaida")}</h2>
      {qaida.lessons.map(item => <Link key={item.n} className={`study-item ${item.n === lesson.n ? "soft" : ""}`}
        to={`/learn/qaida/${item.n}`} aria-current={item.n === lesson.n ? "step" : undefined}>{t("qaidaLessonNumber", { number: item.n, title: studyNames.lesson(language, item.n, item.title) })}</Link>)}
    </aside>
    <div className="stack">
    <SectionNav title={t("lessonTitle", { number: lesson.n, title })} back="/learn/qaida" />
    <div className="row-between"><p className="muted">{t("lessonAbout", { name: lesson.traditional, minutes: isMaktab ? 3 : 5 })}</p><span className="chip soft">{t("rowOf", { row: row + 1, total: rows.length })}</span></div>
    <section className="card stack">
      <h2>{t("readAlong")}</h2>
      <progress value={row + 1} max={rows.length} aria-label={t("lessonRows")} />
      <div className="drill-grid" dir="rtl">{rowLetters.flat().map((text, i) => {
        const tile = wordAnatomy(text).letters[0];
        return <div className="card soft compact-stack text-center" key={i}>
          <ArabicText text={text} />
          {drill && <small lang={ampara ? "bn" : "en"}>{ampara
            ? `${tile.nameBn ?? tile.name} ${tile.details.map(mark => mark.nameBn).join(" ")}`
            : [tile.name, ...tile.details.map(mark => mark.name)].join(" + ")}</small>}
          {drill && <strong>{tile.sound}</strong>}
        </div>;
      })}</div>
      <div className="equal-row">
        <button className="action light" disabled={row === 0} onClick={() => move(row - 1)}>{t("previousRow")}</button>
        <button className="action soft" disabled={row === rows.length - 1} onClick={() => move(row + 1)}>{t("nextRow")}</button>
      </div>
      <VerseAudio key={row} audioRef={`qaida:${lesson.n}:${row + 1}`} label={t("rowLabel", { row: row + 1 })} compare />
    </section>
    <section className="card stack">
      <h2>{t(lesson.n === 1 ? "whichLetter" : lesson.n === 4 ? "whichMark" : lesson.n === 5 ? "whichSound" : "howManyLetters")}</h2>
      <ArabicText text={prompt} />
      <div className="equal-row">{options.map((label, i) => <button type="button" key={label} className={`action ${answer === i ? "" : "light"}`} aria-pressed={answer === i} onClick={() => setAnswer(i)}>{label}</button>)}</div>
      {answer !== undefined && <p role="status">{t(answer === correct ? "quizCorrect" : "quizTryAgain")}</p>}
    </section>
    <section className="card tint compact-stack"><h2>{t("spotInQuran")}</h2>
      <ArabicText text={lesson.n === 3 ? rows[0][0][0] : quranText[112][0].uthmani} citation={lesson.n === 3 ? "2:1" : "112:1"} />
      <p className="muted small">{lesson.n === 3 ? "Al-Baqara 2:1" : "Al-Ikhlāṣ 112:1"}</p>
    </section>
    {finished ? <div className="equal-row"><Link className="action" to={lesson.n < 17 ? `/learn/qaida/${lesson.n + 1}` : "/learn"}>{t("continueLearning")}</Link>
      <Link className="action soft" to={momentPath("qaida", lesson.n)}>{t("shareMoment")}</Link></div> : <button className="action" disabled={saving} onClick={() => void finish()}>{t("saveLesson")}</button>}
    </div>
    <aside className="qaida-trace card stack" aria-label={t("takhtiWorkspace")}>
      <h2>{t("takhti")} · {language === "bn" ? traceLetter.nameBn : traceLetter.name}</h2>
      <ArabicText text={traceLetter.letter} />
      <TraceBoard letter={traceLetter} />
      <Link className="action soft" to="/print/takhti/boat">{t("printPracticeSheet")}</Link>
    </aside>
  </div>;
}

export function Hadith() {
  const { language, t } = useCopy();
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("curated");
  const [limit, setLimit] = useState(12);
  const [corpus, setCorpus] = useState<{ collection: string; items: Narration[] }>();
  const [error, setError] = useState("");
  const normalized = useDeferredValue(studySearchTerm(query));
  useEffect(() => {
    if (collection === "curated") return;
    const controller = new AbortController();
    void fetch(asset(`data/hadith-${collection}-v1.json`), { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error("Collection unavailable");
      return response.json();
    }).then(result => {
      if (!controller.signal.aborted) setCorpus({ collection, items: result.items });
    }, () => {
      if (!controller.signal.aborted) setError(collection);
    });
    return () => controller.abort();
  }, [collection]);
  const matches = hadith.items.filter(item => [item.summary, item.theme, item.collection, item.grade, String(item.number)].some(value => value.toLowerCase().includes(normalized)));
  const results = corpus?.collection === collection ? corpus.items.filter(item => [item.text, item.grade, String(item.number)].some(value => value.toLowerCase().includes(normalized))) : [];
  return <div className="stack">
    <SectionNav title={t("authenticHadith")} back="/learn" />
    <div className="card stack">
      <label className="field"><span className="with-icon"><Search size={18} /> {t("searchOffline")}</span><input value={query} onChange={event => { setQuery(event.target.value); setLimit(12); }} type="search" placeholder={t("hadithSearchHint")} aria-describedby={language === "bn" ? "hadith-search-help" : undefined} /></label>
      {language === "bn" && <p className="small muted" id="hadith-search-help">{t("englishHadithSearch")}</p>}
      <label className="field">{t("collection")}<select value={collection} onChange={event => { setCollection(event.target.value); setLimit(12); setError(""); }}>
        <option value="curated">{t("curatedReferences")}</option>
        {Object.entries(narrationCollections).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
    </div>
    {collection === "curated" && !matches.length && <p className="card tint" role="status">{t("hadithNotFound")}</p>}
    {collection === "curated" && matches.map(item => <article className="card stack" key={`${item.collection}:${item.number}`}>
      <a className="caption" href={item.url}>{item.collection} {item.number} · {item.grade}</a>
      <h2 lang="en">{item.summary.replace("He ﷺ", "The Prophet")}</h2>
    </article>)}
    {collection !== "curated" && (error === collection
      ? <p className="card tint" role="status">{t("collectionUnavailable")}</p>
      : corpus?.collection !== collection ? <p role="status">{t("openingCollection")}</p>
      : !results.length ? <p className="card tint" role="status">{t("hadithNotFound")}</p>
      : results.slice(0, limit).map(item => <article className="card stack" key={item.number}>
        <h2>{narrationCollections[item.collection]} {item.number}</h2>
        <p className="caption">{item.grade} · {item.grader}</p>
        <p lang="en">{item.text.split("ﷺ").map((part, i) => i ? <span key={i}><ArabicText text="صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ" compact />{part}</span> : part)}</p>
        <p className="muted small">{t("narrationReference", { book: item.book, number: item.inBook })}</p>
      </article>))}
    {results.length > limit && <button className="action soft" onClick={() => setLimit(value => value + 12)}>{t("moreNarrations")}</button>}
  </div>;
}

const narrationCollections = { abudawud: "Sunan Abi Dawud", ibnmajah: "Sunan Ibn Majah", nasai: "Sunan an-Nasa’i", tirmidhi: "Jamiʿ at-Tirmidhi" };
interface Narration { collection: keyof typeof narrationCollections; number: number; grade: string; grader: string; book: number; inBook: number; text: string }

export function Fluency() {
  const { t } = useCopy();
  return <div className="stack">
    <SectionNav title={t("quranAndModern")} back="/learn" />
    <section className="card soft stack">
      <p className="caption">{t("fluencyRoot")}</p>
      <ArabicText text={sample.root.letters.join(" ")} />
      <h2 lang="en">{sample.root.meaning}</h2>
      <ArabicText text={sample.word} citation={sample.verseKey} />
    </section>
    <section className="compact-stack">
      <h2>{t("withoutHarakat")}</h2>
      {sample.modern.examples.map(example => <div className="card stack" key={example.ar}>
        <ArabicText text={example.ar.replace(/\p{M}/gu, "").replace(/ٱ/g, "ا")} />
        <details><summary>{t("showVowels")}</summary><ArabicText text={example.ar} /><p lang="en">{example.en}</p></details>
      </div>)}
    </section>
  </div>;
}
