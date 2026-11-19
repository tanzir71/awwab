import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { ArabicText } from "./ArabicText";
import { normalizeWord, wordAnatomy } from "@/lib/wordAnatomy";
import { useUi, type WordSelection } from "@/lib/uiState";
import { lookupMorphology } from "@/lib/morphology";
import { reviewCard, type Reviews } from "@/lib/reviews";
import { updateRecord, type Settings } from "@/lib/storageService";
import { message } from "@/lib/copy";
import { studyNames } from "@/lib/study-copy";

function Anatomy({ selection, settings }: { selection: WordSelection; settings: Settings }) {
  const t = message.bind(null, settings);
  const ampara = settings.spellStyle === "ampara-bn";
  const { letters, syllables, joining, curated, modern } = wordAnatomy(selection.word, selection.connected);
  const navigate = useNavigate();
  const selectWord = useUi(state => state.selectWord);
  const [morphology, setMorphology] = useState<Awaited<ReturnType<typeof lookupMorphology>>>();
  useEffect(() => {
    let current = true;
    setMorphology(undefined);
    if (selection.verse && selection.position) {
      void lookupMorphology(selection.verse, selection.position).then(word => {
        if (current) setMorphology(word);
      }).catch(() => {});
    }
    return () => { current = false; };
  }, [selection.verse, selection.position]);
  const pronunciation = selection.transliteration ?? curated?.translit ?? syllables.map(item => item.tr).join("-");
  const root = curated?.root.letters.join(" ") ?? selection.root ?? (morphology?.root ? Array.from(morphology.root).join(" ") : "");
  return <>
    <div className="row-between">
      <div><p className="caption">{t("wordAnatomy")}</p><h2>{pronunciation || t("spellItOut")}</h2><p className="muted">{selection.gloss ?? curated?.meaning} {selection.citation}</p></div>
      <div className="anatomy-title"><ArabicText text={selection.word} words={[{ transliteration: pronunciation, root }]} /></div>
    </div>
    <h3>{t("lettersRtl")}</h3>
    <div className="letter-tiles" dir="rtl" role="group" aria-label={t("letters")} tabIndex={0}>
      {letters.map((tile, i) => <div key={i} className="letter-tile">
        <span lang="ar" className="tile-glyph" style={{ color: `var(--c-${tile.color})` }}>{tile.glyph}</span>
        <strong dir="auto" lang={ampara && tile.nameBn ? "bn" : "en"}>{ampara ? tile.nameBn ?? tile.name : tile.name}</strong>
        <small dir="auto" lang={ampara && tile.details.length && !tile.silent ? "bn" : tile.details.length && !tile.silent ? "en" : settings.language}>
          {tile.silent ? t("silent") : !tile.details.length ? t("noMark") : ampara ? tile.details.map(mark => mark.nameBn).join(" · ") : tile.mark}
        </small>
        <strong dir="ltr">{tile.sound || "—"}</strong>
      </div>)}
    </div>
    <h3>{t("sounds")}</h3>
    <div dir="rtl" className="letter-tiles" role="group" aria-label={t("sounds")} tabIndex={0}>
      {syllables.map((item, i) => <div className="letter-tile" key={i}><span className="tile-glyph" lang="ar">{item.ar}</span><strong dir="ltr">{item.tr}</strong></div>)}
    </div>
    <h3>{t("joining")}</h3>
    <div dir="rtl" className="letter-tiles" role="group" aria-label={t("joiningForms")} tabIndex={0}>
      {joining.map((item, i) => <div className="letter-tile" key={i}><span className="tile-glyph" lang="ar">{item.form}</span><small>{t(item.position)}</small></div>)}
    </div>
    {root && <section className="compact-stack">
      <h3>{t("rootFamily")}</h3>
      <ArabicText text={root} />
      {curated && <><p>{curated.root.meaning}</p>
        {curated.root.family.map(item => <div className="list-row" key={item.ar}><span>{item.tr}<small>{item.en}</small></span><ArabicText text={item.ar} /></div>)}</>}
      {!curated && morphology?.family.slice(0, 4).map(item => <div className="list-row" key={`${item.verse}:${item.position}`}>
        <span>{studyNames.wordKind(settings.language, item.type)}<small>{item.verse}</small></span><ArabicText text={item.lemma ?? item.word} />
      </div>)}
      {morphology && <a className="small muted" href="https://corpus.quran.com/download/">Quranic Arabic Corpus 0.4</a>}
    </section>}
    <h3>{t("quranAndModern")}</h3>
    <div className="equal-row">{[selection.word, modern].map((word, i) => <div className="card soft" key={i}>
      <small>{t(i === 0 ? "quranSpelling" : "modernSpelling")}</small><br /> <ArabicText text={word} />
    </div>)}</div>
    {curated?.modern.examples.map(item => <div className="card" key={item.ar}><ArabicText text={item.ar} /><p>{item.en}</p></div>)}
    <div className="equal-row">
      <button className="action" onClick={async () => {
        const id = "word:" + normalizeWord(morphology?.lemma ?? selection.word);
        try {
          await updateRecord<Reviews>("reviews", {}, previous => previous[id] ? previous : { ...previous, [id]: { ...reviewCard(undefined, "forgot", new Date()), bucket: "sabaq" } });
          toast(t("wordReviewAdded"));
        } catch { toast.error(t("wordSaveError")); }
      }}>{t("addWordReview")}</button>
      <button className="action light" onClick={() => { selectWord(); navigate("/learn/takhti"); }}>{t("traceIt")}</button>
    </div>
  </>;
}

export function WordPanel({ desktop, settings }: { desktop: boolean; settings: Settings }) {
  const { word, selectWord } = useUi();
  if (desktop) return word ? <aside className="word-side card" aria-label={message(settings, "wordAnatomy")}>
    <button className="icon-button anatomy-close" aria-label={message(settings, "closeWordAnatomy")} onClick={() => selectWord()}><X size={20} /></button>
    <Anatomy selection={word} settings={settings} />
  </aside> : null;
  return <Dialog open={Boolean(word)} onOpenChange={open => { if (!open) selectWord(); }}>
    {word && <DialogContent className="awwab-dialog word-sheet" aria-describedby={undefined}>
      <DialogTitle className="sr-only">{message(settings, "wordAnatomy")}</DialogTitle>
      <Anatomy selection={word} settings={settings} />
    </DialogContent>}
  </Dialog>;
}
