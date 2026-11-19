import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { SectionNav } from "@/components/Surface";
import { useRecord } from "@/hooks/use-awwab";
import { dateKey, formatDay } from "@/lib/dates";
import { coreVocabulary, loadMorphology } from "@/lib/morphology";
import { coreWordTotal, knownCoreQuranWords } from "@/lib/quran";
import { grades, isDue, reviewCard, type ReviewGrade, type Reviews } from "@/lib/reviews";
import { useCopy } from "@/lib/copy";
import { studyNames, studySearchTerm } from "@/lib/study-copy";
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

function pronunciation(word: string) {
  return wordAnatomy(word).syllables.map(item => item.tr).join("");
}

export function WordBank() {
  const { language, t } = useCopy();
  const numbers = new Intl.NumberFormat(language);
  const [corpus, setCorpus] = useState<Corpus>();
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(25);
  const [root, setRoot] = useState<string>();
  const [session, review] = useState<string>();
  const [reveal, setReveal] = useState(false);
  const reviews = useRecord<Reviews>("reviews", {});
  const knownVocabulary = useRecord<string[]>("word-bank-known", []);
  const knownVerses = useRecord<string[]>("words-known", []);
  const known = knownCoreQuranWords(knownVerses, knownVocabulary);
  const term = useDeferredValue(studySearchTerm(query));
  const now = new Date();
  useEffect(() => {
    let current = true;
    void loadMorphology().then(data => { if (current) setCorpus(data); }, () => { if (current) setError(true); });
    return () => { current = false; };
  }, []);

  const vocabulary = useMemo(() => corpus ? coreVocabulary(corpus.vocabulary) : [], [corpus]);
  const words = vocabulary.map(word => {
    const text = word.lemma ?? word.word;
    return { ...word, text, en: meanings[normalizeWord(text)], tr: pronunciation(text), kind: studyNames.wordKind(language, word.type), known: known.has(word.key), review: reviews[word.key] };
  });
  const filtered = words.filter(item => {
    if (filter === "known" && !item.known) return false;
    if (filter === "due" && (!item.review || !isDue(item.review, now))) return false;
    return !term || [item.text, item.key, item.en, item.tr, item.root, item.type, item.kind].some(value => value?.toLowerCase().includes(term));
  });
  const active = words.find(item => item.key === session);
  const due = words.filter(item => item.review && isDue(item.review, now));
  const maximum = vocabulary[0]?.count || 1;

  return <div className="stack">
    <SectionNav title={t("quranWordBank")} back="/learn" />
    <div className="equal-row">
      <div className="card"><h2>{numbers.format(known.size)}/{numbers.format(coreWordTotal)}</h2><small className="muted">{t("wordsKnown")}</small></div>
      <div className="card"><h2>{numbers.format(due.length)}</h2><small className="muted">{t("dueNow")}</small></div>
      <div className="card"><h2>{numbers.format(words.filter(item => item.review).length)}</h2><small className="muted">{t("inMyReview")}</small></div>
    </div>
    <section className="card stack">
      <h2>{t("frequentWords")}</h2>
      <div className="equal-row">
        <label className="field"><span className="with-icon"><Search size={18} /> {t("findWord")}</span><input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(25); }} /></label>
        <label className="field">{t("status")}<select value={filter} onChange={event => { setFilter(event.target.value); setLimit(25); }}><option value="all">{t("allWords")}</option><option value="known">{t("known")}</option><option value="due">{t("dueForReview")}</option></select></label>
      </div>
      {error && <p role="status">{t("corpusUnavailable")} <Link className="text-button" to="/learn/salah">{t("studyFatiha")}</Link></p>}
      {!corpus && !error && <p role="status">{t("openingCorpus")}</p>}
      {corpus && <div className="table-scroll"><table className="vocab-table"><thead><tr>{["word", "meaning", "root", "studyType", "frequency", "status", "nextReview", "actions"].map(column => <th key={column} scope="col">{t(column)}</th>)}</tr></thead>
        <tbody>{filtered.slice(0, limit).map(item => <tr key={`${item.key}:${item.type}`}>
          <td><ArabicText text={item.text} citation={item.verse} words={[{ transliteration: item.tr, gloss: item.en, root: item.root }]} compact /></td>
          <td lang="en">{item.en ?? "—"}</td>
          <td>{item.root ? <button className="action soft" onClick={() => setRoot(item.root)} aria-description={t("exploreRootOf", { name: item.tr })}>{pronunciation(item.root) || item.kind}</button> : "—"}</td>
          <td>{item.kind}</td>
          <td><progress value={item.count} max={maximum} aria-label={t("occurrences", { count: item.count })} /><small>{numbers.format(item.count)}</small></td>
          <td>{t(item.known ? "known" : item.review ? item.review.bucket : "newWord")}</td>
          <td>{item.review ? isDue(item.review, now) ? t("dueNow") : formatDay(dateKey(new Date(item.review.card.due)), { day: "numeric", month: "short" }, language) : "—"}</td>
          <td><button className="action light" onClick={() => { review(item.key); setReveal(false); document.getElementById("word-review")?.scrollIntoView(); }}>{t("review")}</button></td>
        </tr>)}</tbody>
      </table></div>}
      {filtered.length > limit && <button className="action soft" onClick={() => setLimit(value => value + 25)}>{t("moreWords")}</button>}
      {corpus && !filtered.length && <p className="muted" role="status">{t("noMatchingWords")}</p>}
    </section>
    <section className="card stack" id="word-review">
      <h2>{t("reviewWord")}</h2>
      {active ? <>
        <ArabicText text={active.text} citation={active.verse} />
        {reveal ? <p lang={active.en ? "en" : undefined}>{active.en || t("spellWordAloud")}</p> : <button className="action light" onClick={() => setReveal(true)}>{t("showCue")}</button>}
        <div className="equal-row">{(Object.keys(grades) as ReviewGrade[]).map(grade => <button className={`action ${grade === "got-it" ? "" : "light"}`} key={grade}
          onClick={async () => {
            try {
              await updateRecord<Reviews>("reviews", {}, old => ({ ...old, [active.key]: reviewCard(old[active.key], grade, new Date()) }));
              if (grade === "got-it") await updateRecord<string[]>("word-bank-known", [], old => [...new Set([...old, active.key])]);
              review(undefined);
              toast(t("wordReviewSaved"));
            } catch { toast.error(t("reviewSaveError")); }
          }}>{t(grade)}</button>)}</div>
      </> : <button className="action soft" disabled={due.length === 0} onClick={() => { review(due[0].key); setReveal(false); }}>{t("startDueReview")}</button>}
    </section>
    {root && <section className="card tint compact-stack">
      <h2>{t("rootExplorer")}</h2><ArabicText text={Array.from(root).join(" ")} />
      {corpus?.families.get(root)?.map(item => <div className="list-row" key={`${item.verse}:${item.position}`}>
        <span>{studyNames.wordKind(language, item.type)} · {item.verse}</span><ArabicText text={item.lemma ?? item.word} citation={item.verse} />
      </div>)}
    </section>}
    <Link className="action soft" to="/learn/fluency">{t("readInModernArabic")}</Link>
    <a className="text-button" href="https://corpus.quran.com/download/">Quranic Arabic Corpus 0.4 · Kais Dukes</a>
  </div>;
}
