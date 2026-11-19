import { useDeferredValue, useEffect, useState } from "react";
import { BookOpen, ChevronRight, Headphones, Search } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { LocalRecorder } from "@/components/LocalRecorder";
import { VerseAudio } from "@/components/VerseAudio";
import { SectionNav } from "@/components/Surface";
import { useDesktop, useRecord } from "@/hooks/use-awwab";
import { dateKey } from "@/lib/dates";
import { asset } from "@/lib/config";
import { bucketNames, isDue, reviewCard, type ReviewGrade, type Reviews } from "@/lib/reviews";
import { updateRecord, type Settings } from "@/lib/storageService";
import { splitArabicWords, wordAnatomy } from "@/lib/wordAnatomy";
import alphabet from "../../docs/content/arabic-letters.json";
import qaida from "../../docs/content/qaida-lessons.json";
import surahs from "../../docs/content/surahs-for-salah.json";
import hadith from "../../docs/content/hadith-curated.json";
import { quranText } from "@/lib/quran";
import { useUi } from "@/lib/uiState";
import sample from "../../docs/content/word-anatomy.sample.json";
import salah from "../../docs/content/salah-words.json";
import { TraceBoard } from "./Takhti";

const fullChapters = surahs.surahs.slice(0, 12);
const practiceWords = ["بَابٌ", "بِسْمِ", "قُلْ", "أَحَدٌ", "يَوْمٌ", "رَبِّ", "ٱلْعَصْرِ"];
const drillMarks = ["َ", "ِ", "ُ"];
const exercises: Record<number, string[]> = {
  2: ["بتث", "جحخ", "سشط", "درز", "فقي", "كتب"],
  3: ["الٓمٓ", "يسٓ", "طسمٓ", "طه", "كهيعصٓ"],
  6: practiceWords, 7: ["هَٰذَا", "مَٰلِكِ", "ٱلرَّحْمَٰنِ", "مُوسَىٰ"],
  8: ["بَا", "بِي", "بُو", "بَيْ", "بَوْ"], 9: ["خَيْرٌ", "سَلَامٌ", "نُورٌ", "رَيْبٌ"],
  10: ["أَبْ", "أَجْ", "أَدْ", "بِسْ", "قُلْ"], 11: ["ٱلْحَمْدُ", "رَبِّ", "نَعْبُدُ", "ٱهْدِنَا"],
  12: ["رَبَّ", "إِنَّ", "أُمُّ", "حَقٌّ"], 13: ["ٱلضُّحَىٰ", "رَبِّ", "ٱلنَّاسِ", "ٱلصَّمَدُ"],
  14: ["ٱلضَّآلِّينَ", "ٱلصَّآفَّٰتِ", "فَذَكِّرْ"], 15: ["جَآءَ", "إِنَّآ", "ٱلسَّمَآءِ"],
  16: ["مِنْ", "أَنْعَمْتَ", "مِنْ رَبِّهِمْ", "مِنْ خَيْرٍ", "مِنْ بَعْدِ"], 17: ["قُلْ هُوَ ٱللَّهُ أَحَدٌ", "ٱللَّهُ ٱلصَّمَدُ", "لَمْ يَلِدْ"],
};
const supportedSurah = (number: number) => quranText[number];
const labels: Record<ReviewGrade, string> = { forgot: "Forgot", shaky: "Shaky", "got-it": "Got it" };

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
  const reviews = useRecord<Reviews>("reviews", {});
  const now = new Date();
  return <section className="compact-stack">
    {fullChapters.map(chapter => <Link className={`list-row ${chapter.number === selected ? "soft" : ""}`} key={chapter.number} to={`/learn/surahs/${chapter.number}`}>
      <span className="icon-box"><BookOpen size={19} /></span><span><strong>{chapter.transliteration}</strong><small>{chapter.words} words · {bucketNames[reviews[chapter.number]?.bucket ?? "sabaq"]}</small></span>
      {reviews[chapter.number] && isDue(reviews[chapter.number], now) ? <span className="chip soft">Due</span> : <ChevronRight size={18} />}
    </Link>)}
  </section>;
}

export function SurahReader({ settings }: { settings: Settings }) {
  const { id } = useParams();
  const surah = fullChapters.find(chapter => chapter.number === Number(id));
  if (!surah) return <div className="stack"><SectionNav title="Surahs for salah" back="/learn" /><SurahList /></div>;
  return <SurahStudy key={id} surah={surah} settings={settings} />;
}

function SurahStudy({ surah, settings }: { surah: typeof fullChapters[number]; settings: Settings }) {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"Listen" | "Read" | "Recall">(params.get("mode") === "listen" ? "Listen" : params.get("mode") === "recall" ? "Recall" : "Read");
  const [hints, setHints] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState("");
  const [milestone, setMilestone] = useState(false);
  const [saving, setSaving] = useState(false);
  const reviews = useRecord<Reviews>("reviews", {});
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
      let moved = false;
      await updateRecord<Reviews>("reviews", {}, old => {
        const next = reviewCard(old[surah.number], value, new Date());
        moved = old[surah.number]?.bucket !== "manzil" && next.bucket === "manzil";
        return { ...old, [surah.number]: next };
      });
      await updateRecord<string[]>("study-days", [], old => [...new Set([...old, dateKey()])]);
      setMilestone(moved);
      setSaved("Review saved.");
    } catch { toast.error("This review could not be saved."); }
    finally { setSaving(false); }
  }
  return <div className="study-workspace">
    <aside className="desktop-queue stack" aria-label="Surah list"><h2>Surahs for salah</h2><SurahList selected={surah.number} /></aside>
    <div className="stack">
      <SectionNav title={`${surah.transliteration} · ${surah.number}`} back="/learn/surahs" />
      <div className="equal-row study-tabs" aria-label="Study mode">
        {(["Listen", "Read", "Recall"] as const).map(item => <button className={`action ${mode === item ? "light" : "plain"}`} aria-pressed={mode === item} key={item} onClick={() => { setMode(item); setSaved(""); }}>{item}</button>)}
      </div>
      <p className="muted small"><span className="chip soft">{bucketNames[bucket]}</span> {surah.ayahs} āyāt · {surah.words} words</p>
      <p className="small muted">Tap any word to spell it out letter by letter.</p>
      {mode === "Listen" && <section className="card stack">
        <h2 className="with-icon"><Headphones size={20} /> Practise aloud</h2>
        <VerseAudio audioRef={`surah:${surah.number}`} label={surah.transliteration} compare />
      </section>}
      {verses.map((verse, i) => {
        const reading = mode !== "Recall" || i === 0;
        const recall = reading ? "read" : hints[verse.ref] ? "hint" : "hidden";
        return <section className={`card stack ${!reading && i > 1 ? "tint" : ""}`} key={verse.ref}>
          <header className="row-between"><a href={`https://quran.com/${verse.ref.replace(":", "/")}`} className="chip">{verse.ref}</a>
            {!reading && <button className="text-button" onClick={() => setHints(value => ({ ...value, [verse.ref]: !value[verse.ref] }))}>{hints[verse.ref] ? "Hide first letters" : "Show first letters"}</button>}
          </header>
          <div className="text-right"><ArabicText text={wrapAyah(verse[settings.script])} citation={verse.ref} verse={verse.ref} recall={recall} mushaf={settings.script}
            words={splitArabicWords(verse.uthmani).map(anatomyWord => ({ anatomyWord }))} /></div>
          <p className={reading ? "" : "muted"}>{!reading && "Cue · "}{verse.english}</p>
          {mode === "Listen" && <VerseAudio audioRef={verse.ref} label={`āyah ${i + 1}`} />}
        </section>;
      })}
      <section className="compact-stack">
        <h2>How did that go?</h2>
        <div className="equal-row">
          {(Object.keys(labels) as ReviewGrade[]).map(value => <button className={`action ${value === "got-it" ? "" : "light"}`} key={value} disabled={saving || Boolean(saved)} onClick={() => void grade(value)}>{labels[value]}</button>)}
        </div>
        {saved && <p className="muted" role="status">{saved}</p>}
      </section>
      {surah.number !== 1 && <p className="card soft">Try reciting {surah.transliteration} in tonight’s Maghrib, in the second rakʿah.</p>}
      {milestone && <section className="card tint compact-stack"><h2>{surah.transliteration} has moved to Manzil</h2><p>Take a moment to see how far you’ve come.</p>
        <Link className="action soft" to={`/share?template=surah&milestone=${encodeURIComponent(`I learned ${surah.transliteration}`)}`}>Share this moment</Link></section>}
      <p className="muted small"><a href={settings.script === "indopak" ? "https://digitalkhatt.org" : "https://tanzil.net/docs/text_license"}>{settings.script === "indopak" ? "IndoPak by DigitalKhatt" : "Quran text by Tanzil"}</a> · English by M. M. Pickthall</p>
    </div>
  </div>;
}

export function Qaida({ settings }: { settings: Settings }) {
  const { id } = useParams();
  const current = useRecord("qaida-current", 1);
  const completed = useRecord<number[]>("qaida-complete", []);
  const lesson = qaida.lessons.find(item => item.n === Number(id));
  if (!lesson) return <div className="stack">
    <SectionNav title="Noorani Qaida" back="/learn" />
    {qaida.lessons.map(item => <Link key={item.n} className="list-row" to={`/learn/qaida/${item.n}`}>
      <span className="icon-box">{item.n}</span><span><strong>{item.title}</strong><small>{item.traditional}</small></span>
      {completed.includes(item.n) ? <span className="chip soft">Practised</span> : current === item.n ? <span className="chip soft">Continue</span> : <ChevronRight size={18} />}
    </Link>)}
  </div>;
  return <QaidaLesson key={id} lesson={lesson} settings={settings} />;
}

function QaidaLesson({ lesson, settings }: {
  lesson: typeof qaida.lessons[number]; settings: Settings;
}) {
  const storedRow = useRecord(`qaida-row-${lesson.n}`, 0);
  const [activeRow, setActiveRow] = useState<number>();
  const [answer, setAnswer] = useState<number>();
  const [finished, setFinished] = useState(false);
  const drill = lesson.n === 1 || lesson.n === 4 || lesson.n === 5;
  const marks = lesson.n === 4 ? drillMarks : lesson.n === 5 ? ["ً", "ٍ", "ٌ"] : [""];
  const options = lesson.n === 1 ? ["Bāʾ", "Tāʾ", "Thāʾ"] : lesson.n === 4 ? ["Fatha", "Kasra", "Ḍamma"] : lesson.n === 5 ? ["an", "in", "un"] : ["1 letter", "2 letters", "3 letters"];
  const prompt = lesson.n === 1 ? "ب" : lesson.n === 4 ? "بِ" : lesson.n === 5 ? "بٌ" : "قُلْ";
  const correct = lesson.n === 1 ? 0 : lesson.n === 5 ? 2 : 1;
  const rows = drill
    ? Array.from({ length: 10 }, (_, index) => alphabet.letters.slice(index * 3, index * 3 + 3).map(letter => marks.map(mark => letter.letter + mark)))
    : exercises[lesson.n].map(text => [[text]]);
  const row = Math.max(0, Math.min(rows.length - 1, activeRow ?? storedRow));
  const rowLetters = rows[row];
  const firstGlyph = wordAnatomy(rowLetters.flat()[0]).letters[0]?.base;
  const traceLetter = alphabet.letters.find(item => item.letter === firstGlyph) ?? alphabet.letters[0];
  const isMaktab = settings.mode === "maktab";
  function move(next: number) {
    setActiveRow(next);
    void updateRecord(`qaida-row-${lesson.n}`, 0, () => next);
  }
  async function finish() {
    try {
      await updateRecord<number[]>("qaida-complete", [], old => Array.from(new Set([...old, lesson.n])));
      await updateRecord("qaida-current", 1, () => Math.min(lesson.n + 1, 17));
      await updateRecord<string[]>("study-days", [], old => [...new Set([...old, dateKey()])]);
      setFinished(true);
    } catch { toast.error("Your lesson progress could not be saved."); }
  }

  return <div className="qaida-workspace">
    <aside className="qaida-queue card compact-stack" aria-label="Qaida lessons">
      <h2>Noorani Qaida</h2>
      {qaida.lessons.map(item => <Link key={item.n} className={`study-item ${item.n === lesson.n ? "soft" : ""}`}
        to={`/learn/qaida/${item.n}`} aria-current={item.n === lesson.n ? "step" : undefined}>{item.n}. {item.title}</Link>)}
    </aside>
    <div className="stack">
    <SectionNav title={`Qaida ${lesson.n} · ${lesson.title}`} back="/learn/qaida" />
    <div className="row-between"><p className="muted">{lesson.traditional} · about {isMaktab ? 3 : 5} minutes</p><span className="chip soft">Row {row + 1} of {rows.length}</span></div>
    <section className="card stack">
      <h2>{isMaktab ? "Read this row out loud" : "Read along"}</h2>
      <progress value={row + 1} max={rows.length} aria-label="Lesson rows" />
      <div className="drill-grid" dir="rtl">{rowLetters.flat().map((text, i) => {
        const tile = wordAnatomy(text).letters[0];
        return <div className="card soft compact-stack text-center" key={i}>
          <ArabicText text={text} />
          {drill && <small>{settings.spellStyle === "ampara-bn"
            ? `${tile.nameBn ?? tile.name} ${tile.details.map(mark => mark.nameBn).join(" ")}`
            : [tile.name, ...tile.details.map(mark => mark.name)].join(" + ")}</small>}
          {drill && <strong>{tile.sound}</strong>}
        </div>;
      })}</div>
      <div className="equal-row">
        <button className="action light" disabled={row === 0} onClick={() => move(row - 1)}>Previous row</button>
        <button className="action soft" disabled={row === rows.length - 1} onClick={() => move(row + 1)}>Next row</button>
      </div>
      <VerseAudio audioRef={`qaida:${lesson.n}:${row + 1}`} label={`row ${row + 1}`} compare />
    </section>
    <section className="card stack">
      <h2>{lesson.n === 1 ? "Which letter is this?" : lesson.n === 4 ? "Which haraka do you see?" : lesson.n === 5 ? "Which sound do you hear as you read?" : "How many letters do you see?"}</h2>
      <ArabicText text={prompt} />
      <div className="equal-row">{options.map((label, i) => <button type="button" key={label} className={`action ${answer === i ? "" : "light"}`} aria-pressed={answer === i} onClick={() => setAnswer(i)}>{label}</button>)}</div>
      {answer !== undefined && <p role="status">{answer === correct ? "You’ve got it." : "Take another look. Tap the word to see its letters."}</p>}
    </section>
    <section className="card tint compact-stack"><h2>Spot it in the Quran</h2>
      <ArabicText text={lesson.n === 3 ? exercises[3][0] : quranText[112][0].uthmani} citation={lesson.n === 3 ? "2:1" : "112:1"} />
      <p className="muted small">{lesson.n === 3 ? "Al-Baqara 2:1" : "Al-Ikhlāṣ 112:1"}</p>
    </section>
    {finished ? <div className="equal-row"><Link className="action" to={lesson.n < 17 ? `/learn/qaida/${lesson.n + 1}` : "/learn"}>Continue learning</Link>
      <Link className="action soft" to={`/share?template=${isMaktab && lesson.n === 17 ? "maktab" : "qaida"}&milestone=${encodeURIComponent(`Practised Qaida lesson ${lesson.n}`)}`}>Share this moment</Link></div> : <button className="action" onClick={() => void finish()}>Mark lesson practised</button>}
    </div>
    <aside className="qaida-trace card stack" aria-label="Takhti workspace">
      <h2>Takhti · {traceLetter.name}</h2>
      <ArabicText text={traceLetter.letter} />
      <TraceBoard letter={traceLetter} />
      <Link className="action soft" to="/print/takhti/boat">Print a practice sheet</Link>
    </aside>
  </div>;
}

const salahGlosses: Record<string, string[]> = {
  "1:1": ["In the name", "of Allah", "the Most Compassionate", "the Most Merciful"],
  "1:2": ["All praise", "is for Allah", "Lord", "of the worlds"],
  "1:3": ["the Most Compassionate", "the Most Merciful"],
  "1:4": ["Master", "of the Day", "of judgment"],
  "1:5": ["You alone", "we worship", "and You alone", "we ask for help"],
  "1:6": ["Guide us", "to the path", "that is straight"],
  "1:7": ["the path", "of those", "You blessed", "upon them", "other than", "those who earned anger", "upon them", "and not", "those who went astray"],
};

export function SalahWords({ settings }: { settings: Settings }) {
  const known = useRecord<string[]>("words-known", []);
  return <div className="stack">
    <SectionNav title="Understand your salah" back="/learn" />
    <section className="card night compact-stack"><h2>Al-Fātiḥa, word by word</h2><p className="muted">Tap any word to spell it out. Mark a line familiar once you can recall its meaning.</p></section>
    {quranText[1].map(verse => {
      const glosses = salahGlosses[verse.ref];
      const words = splitArabicWords(verse.uthmani);
      return <section className="card stack" key={verse.ref}>
        <a className="chip justify-self-start" href={`https://quran.com/${verse.ref.replace(":", "/")}`}>{verse.ref}</a>
        <ArabicText text={words.reduce((lines, word, i) => lines + (i === 0 ? "" : i % 2 === 0 ? "\n" : " ") + word, "")}
          citation={verse.ref} verse={verse.ref} words={words.map((_, i) => ({ gloss: glosses[i] }))} />
        <p>{verse.english}</p>
        <button className="action soft" aria-pressed={known.includes(verse.ref)} onClick={() => void updateRecord<string[]>("words-known", [], old =>
          old.includes(verse.ref) ? old.filter(item => item !== verse.ref) : [...old, verse.ref])}>{known.includes(verse.ref) ? "Familiar ✓" : "Mark words familiar"}</button>
      </section>;
    })}
    <section className="compact-stack">
      <h2>What you say in each position</h2>
      <p className="muted">These are narrated forms. Scholars differ on when to say some phrases in congregational prayer.</p>
      {salah.sections.map(section => <details className="card" key={section.title}>
        <summary><strong>{section.title}</strong></summary>
        <div className="stack">
          <a href={section.url} className="caption">{section.source}</a>
          {section.lines.map(([arabic, gloss], i) => <ArabicText key={i} text={String(arabic)} citation={section.source}
            words={(gloss as string[]).map(gloss => ({ gloss }))} />)}
        </div>
      </details>)}
    </section>
    <p className="small muted"><a href="https://tanzil.net/docs/text_license">Tanzil Quran text</a> · Pickthall translation</p>
  </div>;
}

export function Hadith() {
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("curated");
  const [limit, setLimit] = useState(12);
  const [corpus, setCorpus] = useState<{ collection: string; items: Narration[] }>();
  const [error, setError] = useState("");
  const normalized = useDeferredValue(query.trim().toLowerCase());
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
    <SectionNav title="Popular and authentic" back="/learn" />
    <div className="card stack">
      <label className="field"><span className="with-icon"><Search size={18} /> Search offline</span><input value={query} onChange={event => { setQuery(event.target.value); setLimit(12); }} type="search" placeholder="Collection, number or topic" /></label>
      <label className="field">Collection<select value={collection} onChange={event => { setCollection(event.target.value); setLimit(12); setError(""); }}>
        <option value="curated">Curated references</option>
        {Object.entries(narrationCollections).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
    </div>
    {collection === "curated" && !matches.length && <p className="card tint" role="status">Awwab couldn’t verify that narration in its offline collection.</p>}
    {collection === "curated" && matches.map(item => <article className="card stack" key={`${item.collection}:${item.number}`}>
      <a className="caption" href={item.url}>{item.collection} {item.number} · {item.grade}</a>
      <h2>{item.summary.replace("He ﷺ", "The Prophet")}</h2>
    </article>)}
    {collection !== "curated" && (error === collection
      ? <p className="card tint" role="status">This collection is unavailable. Open Awwab once online to prepare offline access.</p>
      : corpus?.collection !== collection ? <p role="status">Opening collection…</p>
      : !results.length ? <p className="card tint" role="status">Awwab couldn’t verify that narration in this offline collection.</p>
      : results.slice(0, limit).map(item => <article className="card stack" key={item.number}>
        <h2>{narrationCollections[item.collection]} {item.number}</h2>
        <p className="caption">{item.grade} · {item.grader}</p>
        <p>{item.text.split("ﷺ").map((part, i) => i ? <span key={i}><ArabicText text="صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ" compact />{part}</span> : part)}</p>
        <p className="muted small">Book {item.book}, narration {item.inBook} · Hadith API</p>
      </article>))}
    {results.length > limit && <button className="action soft" onClick={() => setLimit(value => value + 12)}>Show more narrations</button>}
  </div>;
}

const narrationCollections = { abudawud: "Sunan Abi Dawud", ibnmajah: "Sunan Ibn Majah", nasai: "Sunan an-Nasa’i", tirmidhi: "Jamiʿ at-Tirmidhi" };
interface Narration { collection: keyof typeof narrationCollections; number: number; grade: string; grader: string; book: number; inBook: number; text: string }

export function Fluency() {
  return <div className="stack">
    <SectionNav title="Quran and modern Arabic" back="/learn" />
    <section className="card soft stack">
      <p className="caption">Root of the day · Al-ʿAsr 103:1</p>
      <ArabicText text={sample.root.letters.join(" ")} />
      <h2>{sample.root.meaning}</h2>
      <ArabicText text={sample.word} citation={sample.verseKey} />
    </section>
    <section className="compact-stack">
      <h2>Read without harakat</h2>
      {sample.modern.examples.map(example => <div className="card stack" key={example.ar}>
        <ArabicText text={example.ar.replace(/\p{M}/gu, "").replace(/ٱ/g, "ا")} />
        <details><summary>Show vowels and meaning</summary><ArabicText text={example.ar} /><p>{example.en}</p></details>
      </div>)}
    </section>
  </div>;
}
