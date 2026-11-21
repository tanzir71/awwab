import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { ModernReading, WordFamily } from "@/components/FluencyCards";
import { SectionNav } from "@/components/Surface";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDesktop, useRecord } from "@/hooks/use-awwab";
import { dateKey, formatDay } from "@/lib/dates";
import { focusListItem } from "@/lib/focusListItem";
import { fluencyRoots, wordBankSearch, wordGlosses } from "@/lib/fluency";
import { fluencyFamilyKey, fluencyRootKey, wordGlossKey } from "@/lib/fluency-messages.mjs";
import { coreVocabulary, loadMorphology } from "@/lib/morphology";
import { coreWordSource, coreWordTotal, knownCoreQuranWords } from "@/lib/quran";
import { grades, isDue, type ReviewGrade, type Reviews } from "@/lib/reviews";
import { useCopy } from "@/lib/copy";
import { studyNames } from "@/lib/study-copy";
import { updateRecord, type Settings } from "@/lib/storageService";
import { momentPath, saveWordReview } from "@/lib/studyMilestones";
import { wordAnatomy } from "@/lib/wordAnatomy";

type Corpus = Awaited<ReturnType<typeof loadMorphology>>;
const rootOfDay = "علم";
const filters = ["all", "due", "learning", "known"] as const;
const filterLabels = { all: "wordBankAll", due: "due", learning: "wordBankLearning", known: "known" } as const;
const sortLabels = { frequency: "wordBankSortFreq", arabic: "wordBankSortArabic", next: "wordBankSortDue" } as const;
const letterOrder = new Intl.Collator("ar", { sensitivity: "base" });

function pronunciation(word: string) {
  return wordAnatomy(word).syllables.map(item => item.tr).join("");
}

function RootExplorer({ root, corpus, pinned }: { root: string; corpus: Corpus | undefined; pinned: string }) {
  const { t, language } = useCopy();
  const curated = fluencyRoots[root];
  const family = curated?.family.map(word => ({ ...word, meaning: t(fluencyFamilyKey(root, word.tr)) }))
    ?? corpus?.families.get(root)?.slice(0, 6).map(item => {
      const ar = item.lemma || item.word;
      const key = wordGlosses[ar] ? ar : item.lemma?.replace(/\p{M}/gu, "") ?? "";
      const gloss = wordGlosses[key];
      return { ar, tr: gloss?.tr ?? pronunciation(ar), meaning: gloss ? t(wordGlossKey(key)) : studyNames.wordKind(language, item.type),
        verse: item.verse, position: item.position };
    }) ?? [];
  const isPinned = pinned === root;

  return <section className="card word-root-panel" aria-label={t("rootExplorer")}>
    <header className="row-between">
      <h2>{t("rootExplorer")}</h2>
      <button className="text-button" type="button" aria-pressed={isPinned} onClick={() => {
        void updateRecord("word-bank-root", "", value => value === root ? "" : root).catch(() => toast.error(t("saveError")));
      }}>{t(isPinned ? "wordBankUnpin" : "wordBankPin")}</button>
    </header>
    <div className="row-between word-root-label">
      <div>
        <h3><bdi lang="en">{curated?.tr ?? Array.from(root).map(pronunciation).join("-")}</bdi>
          {curated && <>{" · "}<bdi>{t(fluencyRootKey(root))}</bdi></>}</h3>
        <p className="small muted">{t("wordBankOneRoot")}</p>
      </div>
      <ArabicText text={Array.from(root).join(" ")} />
    </div>
    <WordFamily words={family} />
  </section>;
}

export function WordBank({ settings, desktop, now }: { settings: Settings; desktop: boolean; now: Date }) {
  const { language, locale, direction, t } = useCopy();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const numbers = new Intl.NumberFormat(locale);
  const zone = settings.city.timeZone;
  const [corpus, setCorpus] = useState<Corpus>();
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<keyof typeof sortLabels>("frequency");
  const [limit, setLimit] = useState(10);
  const [root, setRoot] = useState<string>();
  const [rootRow, setRootRow] = useState<string>();
  const [session, review] = useState<string>();
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const wide = useDesktop(1280);
  const compactDesktop = desktop && !wide;
  const [tab, setTab] = useState("words");
  const rootTab = useRef<HTMLButtonElement>(null);
  const reviews = useRecord<Reviews>("reviews", {});
  const knownVocabulary = useRecord<string[]>("word-bank-known", []);
  const knownVerses = useRecord<string[]>("words-known", []);
  const pinned = useRecord("word-bank-root", "");
  const known = knownCoreQuranWords(knownVerses, knownVocabulary);
  const activeRoot = root ?? (pinned || rootOfDay);
  const deferredQuery = useDeferredValue(query);
  const searchKey = (value: string) => wordBankSearch(value.toLocaleLowerCase(language));
  const term = searchKey(deferredQuery);
  const filter = filters.find(value => value === params.get("status")) ?? "all";

  useEffect(() => {
    let current = true;
    void loadMorphology().then(data => { if (current) setCorpus(data); }, () => { if (current) setError(true); });
    return () => { current = false; };
  }, []);

  const vocabulary = useMemo(() => corpus ? coreVocabulary(corpus.vocabulary).map(word => {
    const text = word.lemma ?? word.word;
    const gloss = wordGlosses[word.key.slice(5)];
    return { ...word, text, gloss, tr: gloss?.tr ?? pronunciation(text) };
  }) : [], [corpus]);
  const words = vocabulary.map(word => ({
    ...word,
    meaning: word.gloss ? t(wordGlossKey(word.key.slice(5))) : undefined,
    kind: studyNames.wordKind(language, word.type),
    state: known.has(word.key) ? "known" as const : reviews[word.key] ? "learning" as const : "new" as const,
    review: reviews[word.key],
    due: Boolean(reviews[word.key] && isDue(reviews[word.key], now)),
  }));
  const nextAt = (word: typeof words[number]) => word.review ? new Date(word.review.card.due).valueOf() : Infinity;
  const filtered = words.filter(item => {
    if (filter === "due" && !item.due) return false;
    if ((filter === "known" || filter === "learning") && item.state !== filter) return false;
    return !term || [item.text, item.key.slice(5), item.meaning, item.gloss?.en, item.gloss?.bn, item.tr, item.root, item.type, item.kind]
      .some(value => value && searchKey(value).includes(term));
  }).sort((first, second) => {
    if (sort === "arabic") return letterOrder.compare(first.text, second.text);
    if (sort === "next") return nextAt(first) - nextAt(second);
    return second.count - first.count;
  });
  const active = words.find(item => item.key === session);
  const due = words.filter(item => item.due);
  const learning = words.filter(item => item.state === "learning").length;
  const rootsMet = new Set(words.filter(item => item.state !== "new" && item.root).map(item => item.root)).size;
  const maximum = vocabulary[0]?.count || 1;
  const visible = filtered.slice(0, limit);
  const selectedRow = rootRow ?? words.find(word => word.root === activeRoot)?.key;
  const counts = { all: coreWordTotal, due: due.length, learning, known: known.size };

  function setFilter(value: typeof filters[number]) {
    setLimit(10);
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value === "all") next.delete("status");
      else next.set("status", value);
      return next;
    }, { replace: true });
  }

  function beginReview(key: string) {
    review(key);
    setReveal(false);
  }

  async function save(grade: ReviewGrade) {
    if (saving || !active) return;
    setSaving(true);
    try {
      const earned = await saveWordReview(active.key, grade, new Date(), zone);
      review(undefined);
      if (earned) navigate(momentPath("words", earned));
      else toast(t("wordReviewSaved"));
    } catch { toast.error(t("reviewSaveError")); }
    finally { setSaving(false); }
  }

  const metrics = [
    { title: "known", value: known.size, hint: t("wordBankOfCore", { count: coreWordTotal }) },
    { title: "wordBankLearning", value: learning, hint: t("wordBankDueToday", { count: due.length }) },
    { title: "wordBankRootsMet", value: rootsMet, hint: t("wordBankRootHint") },
    { title: "newWord", value: Math.max(0, coreWordTotal - known.size - learning), hint: t("wordBankNewHint") },
  ];
  const columnNames = ["word", "wordBankTranslit", "meaning", "root", "studyType", "wordBankHowOften", "status", "wordBankNext"];
  const primaryStatus = { known: "known", learning: "wordBankLearning", new: "newWord" } as const;

  const wordTable = (
      <section className="card word-bank-list" aria-label={t("frequentWords")}>
        <div className="word-bank-controls">
          <div className="word-bank-filters" role="group" aria-label={t("wordBankFilter")}>
            {filters.map(value => <button type="button" aria-pressed={filter === value} key={value} onClick={() => setFilter(value)}>
              {t(filterLabels[value])} {numbers.format(counts[value])}
            </button>)}
          </div>
          <label className="word-bank-search">
            <DesignIcon name="desk-eye" size={15} />
            <span className="sr-only">{t("wordBankSearch")}</span>
            <input type="search" placeholder={t("wordBankSearch")} value={query} onChange={event => { setQuery(event.target.value); setLimit(10); }} />
          </label>
          <label className="word-bank-sort">
            <span className="sr-only">{t("wordBankSort")}</span>
            <select value={sort} onChange={event => { setSort(event.target.value as typeof sort); setLimit(10); }}>
              {(Object.keys(sortLabels) as (keyof typeof sortLabels)[]).map(value => <option value={value} key={value}>{t(sortLabels[value])}</option>)}
            </select>
          </label>
        </div>
        {error && <p role="status">{t("corpusUnavailable")} <Link className="text-button" to="/learn/salah">{t("studyFatiha")}</Link></p>}
        {!corpus && !error && <p role="status">{t("openingCorpus")}</p>}
        {corpus && visible.length > 0 && <div className="word-bank-scroll" role="region" aria-label={t("frequentWords")} tabIndex={0}>
          <table className="word-bank-table" onKeyDown={desktop ? event => focusListItem(event, "tbody tr > td:first-child .word-chip") : undefined}>
            <thead><tr>{columnNames.map(column => <th key={column} scope="col" aria-sort={
              sort === "frequency" && column === "wordBankHowOften" ? "descending" :
              sort === "arabic" && column === "word" || sort === "next" && column === "wordBankNext" ? "ascending" : undefined
            }>{t(column)}</th>)}</tr></thead>
            <tbody>{visible.map(item => <tr key={item.key} data-root-selected={selectedRow === item.key}>
              <td><ArabicText text={item.text} citation={item.verse} verse={item.verse} positionOffset={item.position - 1}
                words={[{ transliteration: item.tr, gloss: item.meaning, glossLanguage: language, root: item.root }]} showGlosses={false} /></td>
              <td><strong lang="en">{item.tr}</strong></td>
              <td dir="auto">{item.meaning ?? "—"}</td>
              <td>{item.root ? <ArabicText text={Array.from(item.root).join(" ")} compact
                onWordSelected={() => {
                  setRoot(item.root);
                  setRootRow(item.key);
                  if (compactDesktop) {
                    setTab("roots");
                    rootTab.current?.focus();
                    return false;
                  }
                  if (activeRoot !== item.root || selectedRow !== item.key) return false;
                }} /> : "—"}</td>
              <td>{item.kind}</td>
              <td><progress value={item.count} max={maximum} aria-label={t("occurrences", { count: item.count })} title={numbers.format(item.count)} /></td>
              <td><button className="word-bank-state" data-state={item.state} aria-label={t("wordBankReviewWord", { status: t(primaryStatus[item.state]), word: item.tr })}
                onClick={() => beginReview(item.key)} type="button">{t(primaryStatus[item.state])}</button></td>
              <td data-due={item.due}>{item.review
                ? item.due ? t("today") : formatDay(dateKey(new Date(item.review.card.due), zone), { day: "numeric", month: "short" }, locale)
                : "—"}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        {corpus && !filtered.length && <p className="small muted" role="status">{t("noMatchingWords")}</p>}
        {filter === "due" && due.length > 0 && <button className="action" type="button" onClick={() => beginReview(due[0].key)}>{t("startDueReview")}</button>}
        {corpus && filtered.length > 0 && <div className="row-between word-bank-list-foot">
          <p className="small muted">{t("wordBankShowing", { visible: visible.length, count: filtered.length })}{sort === "frequency" && " · " + t("wordBankSortedByFreq")}</p>
          {filtered.length > limit && <button className="text-button" type="button" onClick={() => setLimit(value => value + 10)}>{t("moreWords")}</button>}
        </div>}
      </section>
  );
  const practice = <aside className="word-bank-aside">
    <RootExplorer root={activeRoot} corpus={corpus} pinned={pinned} />
    <ModernReading known={known} zone={zone} />
  </aside>;

  return <div className="word-bank">
    {!desktop && <SectionNav title={t("quranWordBank")} back="/learn" />}
    <div className="word-bank-metrics">
      {metrics.map(metric => <section className="card" key={metric.title}>
        <h2 className="caption">{t(metric.title)}</h2>
        <strong>{numbers.format(metric.value)}</strong>
        <p className="small muted">{metric.hint}</p>
      </section>)}
    </div>
    {compactDesktop ? <Tabs.Root className="workspace-tabs vocabulary-tabs" dir={direction} value={tab} onValueChange={setTab}>
      <Tabs.List className="study-tabs equal-row" aria-label={t("wordBankName")}>
        <Tabs.Trigger value="words">{t("frequentWords")}</Tabs.Trigger>
        <Tabs.Trigger value="roots" ref={rootTab}>{t("rootExplorer")}</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="words" forceMount>{wordTable}</Tabs.Content>
      <Tabs.Content value="roots" forceMount>{practice}</Tabs.Content>
    </Tabs.Root> : <div className="word-bank-layout">{wordTable}{practice}</div>}
    <footer className="row-between word-bank-footer">
      <Link className="text-button" to="/learn/fluency">{t("quranAndModern")}</Link>
      <a className="text-button" href={coreWordSource}>{t("fluencySources")}</a>
    </footer>
    <Dialog open={Boolean(active)} onOpenChange={open => { if (!open) review(undefined); }}>
      <DialogContent className="awwab-dialog word-bank-review" aria-describedby={undefined}>
        <DialogTitle>{t("reviewWord")}</DialogTitle>
        {active && <>
          <ArabicText text={active.text} citation={active.verse} verse={active.verse} positionOffset={active.position - 1}
            words={[{ transliteration: active.tr, gloss: active.meaning, glossLanguage: language, root: active.root }]} showGlosses={false}
            onWordSelected={() => review(undefined)} />
          <button className="action light" type="button" aria-expanded={reveal} onClick={() => setReveal(previous => !previous)}>
            {t(reveal ? "fluencyHideMeaning" : "showCue")}
          </button>
          {reveal && <p role="status" dir="auto">{active.meaning ?? t("spellWordAloud")}</p>}
          <div className="equal-row">{(Object.keys(grades) as ReviewGrade[]).map(grade => <button type="button" className={`action ${grade === "got-it" ? "" : "light"}`}
            key={grade} disabled={saving} onClick={() => void save(grade)}>{t(grade)}</button>)}</div>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
