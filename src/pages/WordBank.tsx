import { useDeferredValue, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { SectionNav } from "@/components/Surface";
import { useRecord } from "@/hooks/use-awwab";
import { dateKey, formatDay } from "@/lib/dates";
import { loadMorphology } from "@/lib/morphology";
import { bucketNames, isDue, reviewCard, type ReviewGrade, type Reviews } from "@/lib/reviews";
import { updateRecord } from "@/lib/storageService";
import { normalizeWord, wordAnatomy } from "@/lib/wordAnatomy";

const meanings: Record<string, string> = {
  "الله": "Allah", "اللهُم": "O Allah", "رب": "Lord", "كتاب": "book", "قوم": "people",
  "يوم": "day", "قال": "say", "علم": "know", "ملك": "have authority", "رحم": "have mercy", "الرحمن": "the Most Compassionate",
  "هذا": "this", "ذلك": "that", "من": "from / whoever", "في": "in", "على": "over / upon", "إلى": "to", "عن": "from / about",
  "لا": "no", "ما": "what / that which", "كل": "every / all", "هو": "he", "هم": "they", "أنت": "you", "أنا": "I",
  "كان": "was / is", "آمن": "believe", "عمل": "do / act", "جعل": "make", "جاء": "come", "أتى": "come / bring",
  "خير": "good", "شر": "harm / evil", "سماء": "sky", "أرض": "earth", "قلب": "heart", "نفس": "self / soul",
  "دين": "religion / judgment", "عبد": "servant / worship", "حق": "truth / right", "رحمة": "mercy", "هدى": "guidance",
  "حمد": "praise", "نور": "light", "دنيا": "worldly life", "آخرة": "hereafter", "عذاب": "punishment", "نار": "fire",
  "جنة": "garden", "صلاة": "prayer", "غفر": "forgive", "صبر": "be patient", "صراط": "path", "مستقيم": "straight",
};

type Corpus = Awaited<ReturnType<typeof loadMorphology>>;
const reviewKey = (text: string) => `word:${normalizeWord(text)}`;
const grades: { label: string; id: ReviewGrade }[] = [{ label: "Forgot", id: "forgot" }, { label: "Shaky", id: "shaky" }, { label: "Got it", id: "got-it" }];

function pronunciation(word: string) {
  return wordAnatomy(word).syllables.map(item => item.tr).join("");
}

export function WordBank() {
  const [corpus, setCorpus] = useState<Corpus>();
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(25);
  const [root, setRoot] = useState<string>();
  const [session, review] = useState<string>();
  const [reveal, setReveal] = useState(false);
  const reviews = useRecord<Reviews>("reviews", {});
  const known = useRecord<string[]>("word-bank-known", []);
  const term = useDeferredValue(query.trim().toLowerCase());
  const now = new Date();
  useEffect(() => {
    let current = true;
    void loadMorphology().then(data => { if (current) setCorpus(data); }, () => { if (current) setError(true); });
    return () => { current = false; };
  }, []);

  const vocabulary = corpus?.vocabulary.slice(0, 125) ?? [];
  const words = vocabulary.map(word => {
    const text = word.lemma ?? word.word;
    const key = reviewKey(text);
    return { ...word, text, key, en: meanings[normalizeWord(text)], tr: pronunciation(text), known: known.includes(key), review: reviews[key] };
  });
  const filtered = words.filter(item => {
    if (filter === "known" && !item.known) return false;
    if (filter === "due" && (!item.review || !isDue(item.review, now))) return false;
    return !term || [item.text, item.key, item.en, item.tr, item.root, item.type].some(value => value?.toLowerCase().includes(term));
  });
  const active = words.find(item => item.key === session);
  const due = words.filter(item => item.review && isDue(item.review, now));
  const maximum = vocabulary[0]?.count || 1;

  return <div className="stack">
    <SectionNav title="Quran word bank" back="/learn" />
    <div className="equal-row">
      <div className="card"><h2>{known.length}/125</h2><small className="muted">words known</small></div>
      <div className="card"><h2>{due.length}</h2><small className="muted">due now</small></div>
      <div className="card"><h2>{words.filter(item => item.review).length}</h2><small className="muted">in my review</small></div>
    </div>
    <section className="card stack">
      <h2>Explore frequent words</h2>
      <div className="equal-row">
        <label className="field"><span className="with-icon"><Search size={18} /> Find a word</span><input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(25); }} /></label>
        <label className="field">Status<select value={filter} onChange={event => { setFilter(event.target.value); setLimit(25); }}><option value="all">All words</option><option value="known">Known</option><option value="due">Due for review</option></select></label>
      </div>
      {error && <p role="status">The corpus is unavailable on this device. <Link className="text-button" to="/learn/salah">Study Al-Fātiḥa word by word</Link></p>}
      {!corpus && !error && <p role="status">Opening the Quranic Arabic Corpus…</p>}
      {corpus && <div className="table-scroll"><table className="vocab-table"><thead><tr><th>Word</th><th>Meaning</th><th>Root</th><th>Type</th><th>Frequency</th><th>Status</th><th>Next review</th><th>Actions</th></tr></thead>
        <tbody>{filtered.slice(0, limit).map(item => <tr key={`${item.key}:${item.type}`}>
          <td><ArabicText text={item.text} citation={item.verse} words={[{ transliteration: item.tr, gloss: item.en, root: item.root }]} compact /></td>
          <td>{item.en ?? "—"}</td>
          <td>{item.root ? <button className="action soft" onClick={() => setRoot(item.root)} aria-label={`Explore root of ${item.tr}`}>{pronunciation(item.root) || item.type}</button> : "—"}</td>
          <td>{item.type}</td>
          <td><progress value={item.count} max={maximum} aria-label={`${item.count} occurrences`} /><small>{item.count}</small></td>
          <td>{item.known ? "Known" : item.review ? bucketNames[item.review.bucket] : "New"}</td>
          <td>{item.review ? isDue(item.review, now) ? "Due now" : formatDay(dateKey(new Date(item.review.card.due)), { day: "numeric", month: "short" }) : "—"}</td>
          <td><button className="action light" onClick={() => { review(item.key); setReveal(false); document.getElementById("word-review")?.scrollIntoView(); }}>Review</button></td>
        </tr>)}</tbody>
      </table></div>}
      {filtered.length > limit && <button className="action soft" onClick={() => setLimit(value => value + 25)}>Show more words</button>}
      {corpus && !filtered.length && <p className="muted" role="status">No words match these filters.</p>}
    </section>
    <section className="card stack" id="word-review">
      <h2>Review a word</h2>
      {active ? <>
        <ArabicText text={active.text} citation={active.verse} />
        {reveal ? <p>{active.en || "Read the form aloud, then check its letters."}</p> : <button className="action light" onClick={() => setReveal(true)}>Show cue</button>}
        <div className="equal-row">{grades.map(grade => <button className={`action ${grade.id === "got-it" ? "" : "light"}`} key={grade.id}
          onClick={async () => {
            try {
              await updateRecord<Reviews>("reviews", {}, old => ({ ...old, [active.key]: reviewCard(old[active.key], grade.id, new Date()) }));
              if (grade.id === "got-it") await updateRecord<string[]>("word-bank-known", [], old => [...new Set([...old, active.key])]);
              review(undefined);
              toast("Word review saved.");
            } catch { toast.error("This review could not be saved."); }
          }}>{grade.label}</button>)}</div>
      </> : <button className="action soft" disabled={due.length === 0} onClick={() => { review(due[0].key); setReveal(false); }}>Start a due review</button>}
    </section>
    {root && <section className="card tint compact-stack">
      <h2>Root explorer</h2><ArabicText text={Array.from(root).join(" ")} />
      {corpus?.families.get(root)?.map(item => <div className="list-row" key={`${item.verse}:${item.position}`}>
        <span>{item.type} · {item.verse}</span><ArabicText text={item.lemma ?? item.word} citation={item.verse} />
      </div>)}
    </section>}
    <Link className="action soft" to="/learn/fluency">Read in modern Arabic</Link>
    <a className="text-button" href="https://corpus.quran.com/download/">Quranic Arabic Corpus 0.4 · Kais Dukes</a>
  </div>;
}
