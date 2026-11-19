import { useDeferredValue, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { SectionNav } from "@/components/Surface";
import { asset } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { studyNames, studySearchTerm } from "@/lib/study-copy";
import hadith from "../../docs/content/hadith-curated.json";
import { quranText } from "@/lib/quran";
import sample from "../../docs/content/word-anatomy.sample.json";

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
