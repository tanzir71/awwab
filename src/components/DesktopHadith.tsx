import { useDeferredValue, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { GradeBadge, HadithSnippet, HadithTranslation, LocalHadithTranslation } from "@/components/HadithText";
import { HadithShare, type HadithShareData } from "@/components/HadithShare";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDesktop } from "@/hooks/use-awwab";
import { useHadithEditions, useHadithNarration } from "@/hooks/use-hadith";
import { useCopy } from "@/lib/copy";
import { curatedGrade, curatedHadithFor, desktopHadith, featuredArabic, hadithGradeLabel, hadithId, hadithName, hadithReferenceLabel, hadithSource, hadithSummary,
  hadithTopics, localHadithMeaning, parseHadithId, searchHadith, topicMatches, type CollectionScope, type CuratedNarration, type HadithTopic } from "@/lib/hadith";
import { collectionIds, editionUrl, type HadithGrade } from "@/lib/hadith-catalogue";
import { useUi } from "@/lib/uiState";
import { splitArabicWords } from "@/lib/wordAnatomy";

const topicLabels: Record<HadithTopic, string> = { all: "hadithAll", prayer: "hadithPrayer", repentance: "hadithRepentance",
  character: "hadithCharacter", family: "hadithFamily", knowledge: "hadithKnowledge" };
const collectionChoices: CollectionScope[] = ["all", "bukhari", "muslim", "tirmidhi", "abudawud", "ibnmajah", "nasai", "riyadussalihin"];
const grades = ["sahih", "hasan"] as const;
type GradeTier = HadithGrade["tier"];
type Result = { id: string; grade: HadithGrade; citation: string; text: string; lang: string; verbatim?: boolean; seed?: CuratedNarration };

function HadithFilters({ results, topic, onTopic, scope, onScope, selectedGrades, onGrade }: {
  results: Result[]; topic: HadithTopic; onTopic: (value: HadithTopic) => void; scope: CollectionScope; onScope: (value: CollectionScope) => void;
  selectedGrades: GradeTier[]; onGrade: (value: GradeTier) => void;
}) {
  const { language, locale, t } = useCopy();
  const number = new Intl.NumberFormat(locale);
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
  const labels = useCopy();
  const { language, t } = labels;
  const { actual, ref, seed, related, narration, status } = useHadithNarration(id);
  const [reference, setReference] = useState("");
  const [fullText, setFullText] = useState(false);
  const title = related ? hadithReferenceLabel("riyadussalihin", related.number, labels)
    : ref ? hadithReferenceLabel(ref.collection, ref.number, labels, true) : t("hadithRead");
  const collection = ref && hadithReferenceLabel(ref.collection, ref.number, labels);
  const grade = narration?.grade ?? (seed && curatedGrade(seed));
  const gradeText = grade && hadithGradeLabel(grade, labels);
  const originalSource = seed?.url ?? (narration && hadithSource(narration));
  const source = related?.url ?? originalSource;
  const local = narration && localHadithMeaning(narration, language);
  const citation = [collection, gradeText].filter(Boolean).join(" · ");
  const excerpt = seed?.excerptAr ?? (actual === "bukhari:1" ? featuredArabic : undefined);
  const arabic = !local && !fullText && excerpt ? excerpt : narration?.arabic;
  const firstWord = arabic && splitArabicWords(arabic)[0];
  const summaryItem = related ?? seed;
  const summary = summaryItem && hadithSummary(summaryItem, language);
  const banglaSummary = summary?.language === "bn" ? summary.text : undefined;
  const showingSummary = !fullText && Boolean(banglaSummary);
  const englishExcerpt = !fullText && seed?.excerptEn;
  const translation = showingSummary ? banglaSummary : englishExcerpt || narration?.text;
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
    const useExcerpt = language === "en" && Boolean(seed?.excerptEn);
    const translation = (local?.text ?? narration?.text.replace(/(?:\p{Script=Arabic}\p{M}*)+/gu, ""))?.replace(/\s+/g, " ").trim();
    const quote = translation?.length > 260 ? translation.slice(0, 260).replace(/\s+\S*$/, "") + "…" : translation;
    const text = local ? quote : useExcerpt ? seed.excerptEn : summary?.text ?? quote;
    onShare({ title, reference: citation, source, text, arabic: useExcerpt ? excerpt : undefined,
      textLanguage: local?.language ?? (useExcerpt ? "en" : summary?.language ?? "en"),
      credit: local?.credit, summary: !local && !useExcerpt && Boolean(summary) }, event.currentTarget);
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
    {local ? <LocalHadithTranslation local={local} english={narration.text} citation={citation} close={onWord} /> : translation ? <div className="hadith-meaning">
      {language !== "en" && <p className="caption">{t(showingSummary ? "hadithBanglaSummary" : englishExcerpt ? "hadithEnglishExcerpt" : "hadithEnglishTranslation")}</p>}
      <HadithTranslation text={translation} source={citation} close={onWord} language={showingSummary ? "bn" : "en"} />
      {!showingSummary && englishExcerpt && <small className="muted">{t(seed.qudsi ? "hadithQudsiExcerpt" : "hadithExcerpt")}</small>}
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
      {!local && (banglaSummary || excerpt || seed?.excerptEn) && narration && <button className="text-button" type="button" aria-expanded={fullText}
        onClick={() => setFullText(value => !value)}>{t(fullText
          ? banglaSummary ? "hadithShowBanglaSummary" : "hadithReadExcerpt"
          : banglaSummary ? "hadithReadEnglish" : "hadithRead")}</button>}
      {ref && source && <a className="text-button hadith-desk-edition" href={editionUrl(ref.collection)}>{t("hadithOpenEdition")}</a>}
    </div>
  </section>;
}

export function DesktopHadith() {
  const labels = useCopy();
  const { language, t } = labels;
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
    return search || scope === "riyadussalihin" ? searchHadith(search, data.items, scope, language) : { matches: data.items, riyad: [] };
  }, [data, scope, search, archiveActive, language]);
  const candidates: Result[] = archiveActive ? [
    ...(archived?.riyad.map(item => {
      const local = localHadithMeaning(parseHadithId(item.original), language);
      const preview = local ?? hadithSummary(item, language);
      return { id: hadithId("riyadussalihin", item.number), grade: item.grade,
        citation: hadithReferenceLabel("riyadussalihin", item.number, labels), text: preview.text,
        lang: preview.language, verbatim: Boolean(local), seed: curatedHadithFor(item.original) };
    }) ?? []),
    ...(archived?.matches.map(item => {
      const id = hadithId(item.collection, item.number);
      const seed = curatedHadithFor(id);
      const local = localHadithMeaning(item, language);
      const preview = local ?? (seed ? hadithSummary(seed, language) : { text: item.text, language: "en" });
      return { id, grade: item.grade, citation: hadithReferenceLabel(item.collection, item.number, labels, true),
        text: preview.language === "en" ? seed?.excerptEn ?? preview.text : preview.text, lang: preview.language, verbatim: Boolean(local), seed };
    }) ?? []),
  ] : desktopHadith.map(seed => {
    const preview = hadithSummary(seed, language);
    return { id: hadithId(seed.collection, seed.number), grade: curatedGrade(seed),
      citation: hadithReferenceLabel(seed.collection, seed.number, labels, true), lang: preview.language, seed,
      text: preview.language === "en" ? seed.excerptEn ?? preview.text : preview.text };
  });
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
            <HadithSnippet text={entry.verbatim ? entry.text : entry.text.replace(/^Ḥadīth qudsī: /, "").replace("He ﷺ", "The Prophet")}
              language={entry.lang} verbatim={entry.verbatim} />
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
