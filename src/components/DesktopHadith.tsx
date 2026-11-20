import { useDeferredValue, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { GradeBadge, HadithSnippet, HadithTranslation } from "@/components/HadithText";
import { HadithShare, type HadithShareData } from "@/components/HadithShare";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDesktop } from "@/hooks/use-awwab";
import { useHadithEditions, useHadithNarration } from "@/hooks/use-hadith";
import { useCopy } from "@/lib/copy";
import { curatedGrade, curatedHadithFor, desktopHadith, featuredArabic, hadithId, hadithName, hadithNumberLabel, hadithSource,
  hadithTopics, searchHadith, topicMatches, type CollectionScope, type CuratedNarration, type HadithTopic } from "@/lib/hadith";
import { collectionIds, editionUrl, type HadithGrade } from "@/lib/hadith-catalogue";
import { useUi } from "@/lib/uiState";
import { splitArabicWords } from "@/lib/wordAnatomy";

const topicLabels: Record<HadithTopic, string> = { all: "hadithAll", prayer: "hadithPrayer", repentance: "hadithRepentance",
  character: "hadithCharacter", family: "hadithFamily", knowledge: "hadithKnowledge" };
const collectionChoices: CollectionScope[] = ["all", "bukhari", "muslim", "tirmidhi", "abudawud", "ibnmajah", "nasai", "riyadussalihin"];
const grades = ["sahih", "hasan"] as const;
type GradeTier = HadithGrade["tier"];
type Result = { id: string; grade: HadithGrade; citation: string; text: string; lang: string; seed?: CuratedNarration };

function HadithFilters({ results, topic, onTopic, scope, onScope, selectedGrades, onGrade }: {
  results: Result[]; topic: HadithTopic; onTopic: (value: HadithTopic) => void; scope: CollectionScope; onScope: (value: CollectionScope) => void;
  selectedGrades: GradeTier[]; onGrade: (value: GradeTier) => void;
}) {
  const { language, t } = useCopy();
  const number = new Intl.NumberFormat(language);
  return <aside className="card hadith-desk-filters" aria-label={t("hadithFilter")}>
    <h2>{t("hadithFilter")}</h2>
    <fieldset><legend className="caption">{t("hadithGrade")}</legend>
      {grades.map(grade => <label key={grade} className="hadith-desk-check">
        <input type="checkbox" checked={selectedGrades.includes(grade)} onChange={() => onGrade(grade)} />
        {t(grade === "sahih" ? "hadithSahih" : "hadithHasan")}
      </label>)}
    </fieldset>
    <fieldset className="hadith-desk-topics"><legend className="caption">{t("hadithTopic")}</legend>
      {hadithTopics.map(value => <button type="button" key={value} aria-pressed={topic === value} onClick={() => onTopic(value)}>
        <span>{t(topicLabels[value])}</span><small>{number.format(results.filter(item => topicMatches(value, item.seed)).length)}</small>
      </button>)}
    </fieldset>
    <fieldset className="hadith-desk-collections"><legend className="caption">{t("collection")}</legend>
      {collectionChoices.map(value => <button key={value} type="button" aria-pressed={scope === value} onClick={() => onScope(value)}>
        {value === "all" ? t("hadithAllCollections") : value === "riyadussalihin" ? t("hadithRiyadSelections") : hadithName(value, language, true)}
      </button>)}
    </fieldset>
  </aside>;
}

function moveResults(event: KeyboardEvent<HTMLUListElement>) {
  if (!["j", "k"].includes(event.key) || event.ctrlKey || event.altKey || event.metaKey) return;
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) return;
  event.preventDefault();
  buttons[(index + (event.key === "j" ? 1 : buttons.length - 1)) % buttons.length].focus();
}

function DesktopHadithReading({ id, inDrawer, onShare, onWord }: {
  id: string; inDrawer?: boolean; onShare: (data: HadithShareData, trigger: HTMLElement) => void; onWord: () => void;
}) {
  const { language, t } = useCopy();
  const { actual, ref, seed, related, narration, status } = useHadithNarration(id);
  const [reference, setReference] = useState("");
  const [fullText, setFullText] = useState(false);
  const title = related ? `${t("hadithRiyad")} ${hadithNumberLabel(related.number, language)}`
    : ref ? `${hadithName(ref.collection, language, true)} ${hadithNumberLabel(ref.number, language)}` : t("hadithRead");
  const collection = ref && `${hadithName(ref.collection, language)} ${hadithNumberLabel(ref.number, language)}`;
  const grade = narration?.grade ?? (seed && curatedGrade(seed));
  const gradeText = grade && (grade.grader ? `${grade.label} (${grade.grader})` : grade.label);
  const originalSource = seed?.url ?? (narration && hadithSource(narration));
  const source = related?.url ?? originalSource;
  const citation = [collection, gradeText].filter(Boolean).join(" · ");
  const excerpt = seed?.excerptAr ?? (actual === "bukhari:1" ? featuredArabic : undefined);
  const arabic = !fullText && excerpt ? excerpt : narration?.arabic;
  const firstWord = arabic && splitArabicWords(arabic)[0];
  const english = !fullText && seed?.excerptEn ? seed.excerptEn : narration?.text;
  const narrator = seed?.narrator ?? /^Narrated\s+([^:\n]{2,70}):/i.exec(narration?.text ?? "")?.[1];
  const topic = seed && (seed.qudsi ? t("hadithRepentanceHope")
    : hadithTopics.slice(1).map(value => topicMatches(value, seed) ? t(topicLabels[value]) : undefined).filter(Boolean).join(" · "));
  const canShare = Boolean(grade && source && (seed || related || narration));

  async function copy() {
    const value = [related && title, citation, source].filter(Boolean).join(" · ");
    try { await navigator.clipboard.writeText(value); toast.success(t("hadithReferenceCopied")); }
    catch { setReference(value); }
  }

  function share(event: MouseEvent<HTMLButtonElement>) {
    if (!canShare) return;
    const summary = seed ? (language === "bn" ? seed.summaryBn : seed.summary).replace(/^Ḥadīth qudsī: /, "").replace("He ﷺ", "The Prophet")
      : related ? (language === "bn" ? related.summaryBn : related.summary) : undefined;
    const useExcerpt = language === "en" && Boolean(seed?.excerptEn);
    const translation = narration?.text.replace(/(?:\p{Script=Arabic}\p{M}*)+/gu, "").replace(/\s+/g, " ").trim();
    const quote = translation?.length > 260 ? translation.slice(0, 260).replace(/\s+\S*$/, "") + "…" : translation;
    const text = useExcerpt ? seed.excerptEn : summary ?? quote;
    onShare({ title, reference: citation, source, text, arabic: useExcerpt ? excerpt : undefined,
      textLanguage: language === "bn" && summary ? "bn" : "en", summary: !useExcerpt && Boolean(summary) }, event.currentTarget);
  }

  return <section className="card hadith-desk-reading" aria-label={title}>
    <header className="row-between">
      {inDrawer ? <DialogTitle>{title}</DialogTitle> : <h2>{title}</h2>}
      <div className="with-icon">
        {canShare && <button type="button" className="text-button" aria-haspopup="dialog" onClick={share}>{t("share")}</button>}
        {inDrawer && <DialogClose asChild><button type="button" className="icon-button" aria-label={t("shareClose")}><X size={18} /></button></DialogClose>}
      </div>
    </header>
    {related && <small className="muted"><a href={related.url}>{t("hadithRiyadDetail", { source: collection })}</a></small>}
    {arabic && <div className="hadith-desk-arabic"><ArabicText text={arabic} citation={citation} onWordSelected={onWord} /></div>}
    {narration && !arabic && <p className="small muted">{t("hadithArabicUnavailable")}</p>}
    {english ? <div>
      <HadithTranslation text={english} source={citation} close={onWord} />
      {!fullText && seed?.excerptEn && <small className="muted">{t(seed.qudsi ? "hadithQudsiExcerpt" : "hadithExcerpt")}</small>}
    </div> : <p role="status" className="small muted">{t(status === "missing" ? "hadithNotFound" : status === "unavailable" ? "collectionUnavailable" : "openingCollection")}</p>}
    {source && grade && <>
      <dl className="hadith-desk-metadata">
        <div><dt>{t("collection")}</dt><dd><a href={originalSource ?? source}>{collection}</a></dd></div>
        <div><dt>{t("hadithGrade")}</dt><dd>{gradeText}</dd></div>
        {narrator && <div><dt>{t("hadithNarrator")}</dt><dd>{narrator}</dd></div>}
        {topic && <div><dt>{t("hadithTopic")}</dt><dd>{topic}</dd></div>}
      </dl>
      <div className="equal-row hadith-desk-actions">
        <button type="button" className="action soft" disabled={!firstWord} onClick={() => {
          if (!firstWord) return;
          onWord();
          useUi.getState().selectWord({ word: firstWord, citation, connected: false });
        }}>{t("hadithPickAnatomy")}</button>
        <button type="button" className="action hadith-copy-reference" onClick={() => void copy()}>{t("hadithCopyReference")}</button>
        <button type="button" className="action" aria-haspopup="dialog" disabled={!canShare} onClick={share}>{t("hadithShareImage")}</button>
      </div>
      {reference && <label className="field">{t("hadithCopyReference")}<input readOnly value={reference} onFocus={event => event.currentTarget.select()} /></label>}
    </>}
    <p className="small muted">{t("hadithVerifyHint")}</p>
    <div className="hadith-desk-reading-links">
      {(excerpt || seed?.excerptEn) && narration && <button className="text-button" type="button" aria-expanded={fullText}
        onClick={() => setFullText(value => !value)}>{t(fullText ? "hadithReadExcerpt" : "hadithRead")}</button>}
      {ref && source && <a className="text-button hadith-desk-edition" href={editionUrl(ref.collection)}>{t("hadithOpenEdition")}</a>}
    </div>
  </section>;
}

export function DesktopHadith() {
  const { language, t } = useCopy();
  const [params, setParams] = useSearchParams();
  const requested = params.get("read");
  const [topicChoice, setTopic] = useState<HadithTopic>(() => requested ? "all" : undefined);
  const [scope, setScope] = useState<CollectionScope>("all");
  const [selectedGrades, setGrades] = useState<GradeTier[]>([...grades]);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [limit, setLimit] = useState(12);
  const [drawerOpen, setDrawerOpen] = useState(Boolean(requested));
  const [share, setShare] = useState<HadithShareData>();
  const restore = useRef<HTMLElement>();
  const drawerTrigger = useRef<HTMLElement>();
  const search = useDeferredValue(query.trim());
  const searchActive = Boolean(query.trim());
  const archiveActive = searchActive || scope !== "all";
  const topic = topicChoice ?? (archiveActive ? "all" : "repentance");
  const word = useUi(state => state.word);
  const wide = useDesktop(1280);
  const inline = wide && !word;
  const data = useHadithEditions(scope, archiveActive);
  const archived = useMemo(() => {
    if (!data || !archiveActive) return;
    return search || scope === "riyadussalihin" ? searchHadith(search, data.items, scope) : { matches: data.items, riyad: [] };
  }, [data, scope, search, archiveActive]);
  const asReference = (collection: Parameters<typeof hadithName>[0], number: string | number) => `${hadithName(collection, language, true)} ${hadithNumberLabel(number, language)}`;

  const candidates: Result[] = archiveActive ? [
    ...(archived?.riyad.map(item => ({ id: hadithId("riyadussalihin", item.number), grade: item.grade,
      citation: `${t("hadithRiyad")} ${hadithNumberLabel(item.number, language)}`, text: language === "bn" ? item.summaryBn : item.summary,
      lang: language, seed: curatedHadithFor(item.original) })) ?? []),
    ...(archived?.matches.map(item => {
      const id = hadithId(item.collection, item.number);
      const seed = curatedHadithFor(id);
      return { id, grade: item.grade, citation: asReference(item.collection, item.number), text: language === "bn" && seed ? seed.summaryBn : seed?.excerptEn ?? seed?.summary ?? item.text,
        lang: seed && language === "bn" ? "bn" : "en", seed };
    }) ?? []),
  ] : desktopHadith.map(seed => ({
    id: hadithId(seed.collection, seed.number), grade: curatedGrade(seed), citation: asReference(seed.collection, seed.number), lang: language, seed,
    text: language === "bn" ? seed.summaryBn : seed.excerptEn ?? seed.summary,
  }));
  const graded = candidates.filter(item => selectedGrades.includes(item.grade.tier));
  const entries = graded.filter(item => topicMatches(topic, item.seed));
  const selected = requested || entries[0]?.id;
  const resultTotal = archived ? archived.matches.length + archived.riyad.length : 0;

  function select(id?: string) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (id) next.set("read", id);
      else next.delete("read");
      return next;
    }, { replace: true });
  }

  function updateFilter(update: () => void) {
    update();
    setLimit(12);
    if (requested) select();
    setDrawerOpen(false);
  }

  function onShare(data: HadithShareData, trigger: HTMLElement) {
    restore.current = trigger;
    setShare(data);
  }

  function openWord() {
    setDrawerOpen(false);
  }

  const loading = archiveActive && (!data || search !== query.trim());
  return <div className="hadith-desktop" data-inline={inline}>
    <HadithFilters results={graded} topic={topic} onTopic={value => updateFilter(() => setTopic(value))}
      scope={scope} onScope={value => updateFilter(() => setScope(value))} selectedGrades={selectedGrades}
      onGrade={value => updateFilter(() => setGrades(values => values.includes(value) ? values.filter(item => item !== value) : [...values, value]))} />
    <div className="hadith-desk-results">
      <label className="card hadith-desk-search">
        <DesignIcon name="desk-eye" size={16} />
        <input type="search" aria-label={t("searchOffline")} placeholder={t("hadithSearchPrompt")} value={query} onChange={event => {
          const value = event.currentTarget.value;
          updateFilter(() => setQuery(value));
        }} />
      </label>
      {loading && <p role="status" className="small muted">{t("openingCollection")}</p>}
      {!loading && data?.missing > 0 && <p role="status" className="small muted">{t("hadithSomeUnavailable")}</p>}
      {!loading && !entries.length && !data?.missing && <p role="status" className="card">{t(searchActive && !resultTotal ? "hadithNotFound" : "hadithNoFilters")}</p>}
      {!loading && searchActive && entries.length > 0 && <p role="status" className="small muted">{t("hadithResults", { count: entries.length })}</p>}
      {!loading && <ul className="hadith-desk-list" onKeyDown={moveResults}>
        {entries.slice(0, limit).map(entry => <li key={entry.id}>
          <button type="button" className="card hadith-desk-result" aria-current={selected === entry.id ? "true" : undefined}
            aria-haspopup={!inline ? "dialog" : undefined} onClick={event => {
              useUi.getState().selectWord();
              drawerTrigger.current = event.currentTarget;
              select(entry.id);
              setDrawerOpen(!wide);
            }}>
            <HadithSnippet text={entry.text.replace(/^Ḥadīth qudsī: /, "").replace("He ﷺ", "The Prophet")} language={entry.lang} />
            <span className="hadith-item-source"><GradeBadge grade={entry.grade} /><small>{entry.citation}</small></span>
          </button>
        </li>)}
      </ul>}
      {!loading && entries.length > limit && <button type="button" className="action light" onClick={() => setLimit(value => value + 12)}>{t("moreNarrations")}</button>}
    </div>
    {inline && selected && <DesktopHadithReading key={selected} id={selected} onShare={onShare} onWord={openWord} />}
    {inline && !selected && <p className="card muted">{t("hadithBrowse")}</p>}
    <Dialog open={Boolean(share || (!inline && drawerOpen && selected))} onOpenChange={open => {
      if (!open && share) setShare(undefined);
      else if (!open) setDrawerOpen(false);
    }}>
      <DialogContent className={share ? "awwab-dialog hadith-share-dialog" : "awwab-dialog desktop-detail-drawer hadith-desk-drawer"}
        overlayClassName={share ? undefined : "desktop-detail-overlay"} showCloseButton={Boolean(share)} aria-describedby={undefined}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (useUi.getState().word) document.querySelector<HTMLButtonElement>(".word-side .anatomy-close")?.focus();
          else if (restore.current?.isConnected) restore.current.focus();
          else drawerTrigger.current?.focus();
          restore.current = undefined;
        }}>
        {share ? <><DialogTitle>{t("hadithShareTitle")}</DialogTitle><HadithShare data={share} /></>
          : selected && <DesktopHadithReading key={selected} id={selected} inDrawer onShare={onShare} onWord={openWord} />}
      </DialogContent>
    </Dialog>
  </div>;
}
