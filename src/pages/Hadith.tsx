import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesktopHadith } from "@/components/DesktopHadith";
import { GradeBadge, HadithSnippet, HadithTranslation } from "@/components/HadithText";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCopy } from "@/lib/copy";
import { useHadithEditions, useHadithNarration } from "@/hooks/use-hadith";
import {
  curatedGrade, curatedHadith, featuredArabic, featuredHadith, hadithId, hadithName, hadithNumberLabel, hadithSource,
  parseHadithId, searchHadith, type CollectionScope,
} from "@/lib/hadith";
import { collectionIds, editionUrl } from "@/lib/hadith-catalogue";
import { splitArabicWords } from "@/lib/wordAnatomy";
import { useUi } from "@/lib/uiState";

const topics = ["all", "mercy", "prayer", "character"] as const;
type Topic = typeof topics[number];
const topicLabels = { all: "hadithAll", mercy: "hadithMercy", prayer: "hadithPrayer", character: "hadithCharacter" } as const;
const mercy = new Set(["bukhari:6464", "bukhari:528", "tirmidhi:3540", "muslim:2702a"]);

function HadithDetail({ id, close }: { id: string; close: () => void }) {
  const { language, t } = useCopy();
  const { actual, ref, seed, related, narration, status } = useHadithNarration(id);
  const [arabicOpen, setArabicOpen] = useState(false);

  const citation = ref ? `${hadithName(ref.collection, language)} ${hadithNumberLabel(ref.number, language)}` : "";
  const title = related ? `${t("hadithRiyad")} ${hadithNumberLabel(related.number, language)}` : citation || t("hadithRead");
  const grade = narration?.grade ?? (seed ? curatedGrade(seed) : undefined);
  const source = related?.url ?? seed?.url ?? (narration && hadithSource(narration));
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="awwab-dialog hadith-detail" aria-describedby={undefined}>
      <DialogTitle>{title}</DialogTitle>
      {grade && <div className="hadith-detail-meta">
        <GradeBadge grade={grade} />
        <p className="small muted">{grade.grader ? <span lang="en">{grade.label} · {grade.grader}</span> : citation}</p>
      </div>}
      {related && <p className="small muted">{t("hadithRiyadDetail", { source: citation })}</p>}
      {actual === hadithId(featuredHadith.collection, featuredHadith.number) &&
        <ArabicText text={featuredArabic} citation={citation} onWordSelected={close} />}
      {!narration ? <p className="small muted" role="status">{t(status === "missing" ? "hadithNotFound" : status === "unavailable" ? "collectionUnavailable" : "openingCollection")}</p> :
        <>
          <p className="caption">{t("hadithEnglishTranslation")}</p>
          <HadithTranslation text={narration.text} source={citation} close={close} />
          <p className="small muted">{t("narrationReference", { book: narration.book, number: narration.inBook })}</p>
          {narration.arabic && <details className="hadith-full-arabic" onToggle={event => setArabicOpen(event.currentTarget.open)}>
            <summary className="text-button">{t("hadithArabic")}</summary>
            {arabicOpen && <ArabicText text={narration.arabic} citation={citation} onWordSelected={close} />}
          </details>}
        </>}
      {seed?.alsoIn && parseHadithId(seed.alsoIn) && <p className="small muted">
        {t("hadithAlsoNarrated")}{" "}
        <a href={`https://sunnah.com/${seed.alsoIn}`}>{hadithName("muslim", language)} {hadithNumberLabel(seed.alsoIn.split(":")[1], language)}</a>
      </p>}
      {source && <div className="equal-row">
        <a className="action soft" href={source}>{t("hadithOpenSource")}</a>
        {ref && <a className="action light" href={editionUrl(ref.collection)}>{t("hadithOpenEdition")}</a>}
      </div>}
    </DialogContent>
  </Dialog>;
}

function ArchiveSearch({ onRead, initialQuery }: { onRead: (id: string) => void; initialQuery: string }) {
  const { language, t } = useCopy();
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<CollectionScope>("all");
  const [limit, setLimit] = useState(12);
  const data = useHadithEditions(scope, true);
  const input = useRef<HTMLInputElement>(null);
  const deferred = useDeferredValue(query);
  const search = deferred.trim();
  const result = useMemo(() => data?.scope === scope && search ? searchHadith(search, data.items, scope) : undefined, [data, scope, search]);
  const total = result ? result.matches.length + result.riyad.length : 0;

  useEffect(() => {
    input.current?.focus();
  }, []);

  return <div className="hadith-search">
    <label className="field">{t("searchOffline")}<input ref={input} type="search" value={query} placeholder={t("hadithSearchHint")} onChange={event => {
      setQuery(event.currentTarget.value);
      setLimit(12);
    }} /></label>
    <label className="field">{t("collection")}<select value={scope} onChange={event => {
      setScope(event.currentTarget.value as CollectionScope);
      setLimit(12);
    }}>
      <option value="all">{t("hadithAllCollections")}</option>
      {collectionIds.map(id => <option key={id} value={id}>{hadithName(id, language)}</option>)}
      <option value="riyadussalihin">{t("hadithRiyadSelections")}</option>
    </select></label>
    {language === "bn" && <p className="small muted">{t("hadithSearchBangla")}</p>}
    {scope === "riyadussalihin" && <p className="small muted">{t("hadithRiyadScope")}</p>}
    {data?.scope !== scope && <p role="status" className="small">{t("openingCollection")}</p>}
    {data?.scope === scope && data.missing > 0 && <p role="status" className="small">{t("hadithSomeUnavailable")}</p>}
    {result && total === 0 && data?.missing === 0 && <p role="status">{t("hadithNotFound")}</p>}
    {result && total > 0 && <>
      <p role="status" className="small muted">{t("hadithResults", { count: total })}</p>
      <div className="hadith-list">
        {result.riyad.slice(0, limit).map(item => <button className="card hadith-list-item" key={item.number} type="button"
          onClick={() => onRead(hadithId("riyadussalihin", item.number))}>
          <span>{language === "bn" ? item.summaryBn : item.summary}</span>
          <span className="hadith-item-source">
            <small>{t("hadithRiyad")} {hadithNumberLabel(item.number, language)}</small><GradeBadge grade={item.grade} />
          </span>
        </button>)}
        {result.matches.slice(0, Math.max(0, limit - result.riyad.length)).map(item => {
          const id = hadithId(item.collection, item.number);
          const seed = curatedHadith.find(entry => hadithId(entry.collection, entry.number) === id);
          const preview = seed ? (language === "bn" ? seed.summaryBn : seed.summary) : item.text;
          return <button className="card hadith-list-item" type="button" key={id} onClick={() => onRead(id)}>
            <HadithSnippet text={preview} language={seed ? language : "en"} />
            <span className="hadith-item-source">
              <small>{hadithName(item.collection, language, true)} {hadithNumberLabel(item.number, language)}</small>
              <GradeBadge grade={item.grade} />
            </span>
          </button>;
        })}
      </div>
      {total > limit && <button className="action light" type="button" onClick={() => setLimit(value => value + 12)}>{t("moreNarrations")}</button>}
    </>}
  </div>;
}

export function Hadith({ desktop }: { desktop: boolean }) {
  return desktop ? <DesktopHadith /> : <MobileHadith />;
}

function MobileHadith() {
  const { language, t } = useCopy();
  const [params, setParams] = useSearchParams();
  const [topic, setTopic] = useState<Topic>("mercy");
  const search = params.get("search") === "1" || params.has("q");
  const detail = params.get("read");
  const selectWord = useUi(state => state.selectWord);
  const featuredId = hadithId(featuredHadith.collection, featuredHadith.number);
  const featureSource = `${hadithName(featuredHadith.collection, language)} ${hadithNumberLabel(featuredHadith.number, language)}`;
  const otherSource = `${hadithName("muslim", language)} ${hadithNumberLabel("1907a", language)}`;
  const entries = curatedHadith.filter(item => {
    const id = hadithId(item.collection, item.number);
    return id !== featuredId && (topic === "all" || (topic === "mercy" ? mercy.has(id) : item.theme === topic));
  });

  function param(key: "search" | "read", value?: string) {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }

  return <div className="hadith-page">
    <header className="hadith-intro">
      <p className="caption">{t("hadith")}</p>
      <h1>{t("authenticHadith")}</h1>
      <p className="muted">{t("hadithIntro")}</p>
    </header>
    <div className="chips hadith-topics" role="group" aria-label={t("hadithTopics")}>
      {topics.map(value => <button type="button" key={value} className="chip" aria-pressed={topic === value} onClick={() => setTopic(value)}>{t(topicLabels[value])}</button>)}
    </div>
    <section className="card hadith-feature">
      <div className="hadith-feature-label"><p className="caption">{t("hadithAgreed")}</p><small>{t("hadithInBoth")}</small></div>
      <ArabicText text={featuredArabic} citation={featureSource} />
      <h2>“{t("hadithFeatureSummary")}”</h2>
      <p className="small">{featureSource} · {otherSource} · {t("hadithSahih")}</p>
      <div className="equal-row">
        <button className="action hadith-gold" type="button" onClick={() => param("read", featuredId)}>{t("hadithRead")}</button>
        <button className="action light" type="button" onClick={() =>
          selectWord({ word: splitArabicWords(featuredArabic)[0], citation: featureSource, connected: false })}>{t("hadithSpell")}</button>
      </div>
    </section>
    <section className="hadith-gallery">
      <div className="row-between hadith-gallery-title">
        <h2>{t(topic === "all" ? "hadithGalleryAll" : topicLabels[topic])}</h2>
        <span>{new Intl.NumberFormat(language).format(entries.length)}</span>
      </div>
      <div className="hadith-list">
        {entries.map(item => <button className="card hadith-list-item" type="button" key={hadithId(item.collection, item.number)}
          onClick={() => param("read", hadithId(item.collection, item.number))}>
          <span>{language === "bn" ? item.summaryBn : item.summary.replace(/^Ḥadīth qudsī: /, "").replace("He ﷺ", "The Prophet")}</span>
          <span className="hadith-item-source">
            <small>{hadithName(item.collection, language, true)} {hadithNumberLabel(item.number, language)}{item.qudsi && ` · ${t("hadithQudsi")}`}</small>
            <GradeBadge grade={curatedGrade(item)} />
          </span>
        </button>)}
      </div>
    </section>
    <section className="card hadith-search-panel">
      <h2>{t("hadithHeard")}</h2>
      <p className="small muted">{t("hadithSearchDescription")}</p>
      {search ? <ArchiveSearch initialQuery={params.get("q") ?? ""} onRead={id => param("read", id)} /> :
        <button className="action light" type="button" onClick={() => param("search", "1")}>{t("searchOffline")}</button>}
    </section>
    {detail && <HadithDetail key={detail} id={detail} close={() => param("read")} />}
  </div>;
}
