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
import { updateRecord } from "@/lib/storageService";

function Anatomy({ selection, ampara }: { selection: WordSelection; ampara: boolean }) {
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
      <div><p className="caption">Word anatomy</p><h2>{pronunciation || "Spell it out"}</h2><p className="muted">{selection.gloss ?? curated?.meaning} {selection.citation}</p></div>
      <div className="anatomy-title"><ArabicText text={selection.word} words={[{ transliteration: pronunciation, root }]} /></div>
    </div>
    <h3>Letters · read right to left</h3>
    <div className="letter-tiles" dir="rtl">
      {letters.map((tile, i) => <div key={i} className="letter-tile">
        <span lang="ar" className="tile-glyph" style={{ color: `var(--c-${tile.color})` }}>{tile.glyph}</span>
        <strong dir="auto">{ampara ? tile.nameBn ?? tile.name : tile.name}</strong>
        <small dir="auto">{ampara && tile.details.length ? tile.details.map(mark => mark.nameBn).join(" · ") : tile.mark}</small>
        <strong dir="ltr">{tile.sound || "—"}</strong>
      </div>)}
    </div>
    <h3>Sounds</h3>
    <div dir="rtl" className="letter-tiles">
      {syllables.map((item, i) => <div className="letter-tile" key={i}><span className="tile-glyph" lang="ar">{item.ar}</span><strong dir="ltr">{item.tr}</strong></div>)}
    </div>
    <h3>Joining</h3>
    <div dir="rtl" className="letter-tiles">
      {joining.map((item, i) => <div className="letter-tile" key={i}><span className="tile-glyph" lang="ar">{item.form}</span><small>{item.position}</small></div>)}
    </div>
    {root && <section className="compact-stack">
      <h3>Root and family</h3>
      <ArabicText text={root} />
      {curated && <><p>{curated.root.meaning}</p>
        {curated.root.family.map(item => <div className="list-row" key={item.ar}><span>{item.tr}<small>{item.en}</small></span><ArabicText text={item.ar} /></div>)}</>}
      {!curated && morphology?.family.slice(0, 4).map(item => <div className="list-row" key={`${item.verse}:${item.position}`}>
        <span>{item.type}<small>{item.verse}</small></span><ArabicText text={item.lemma ?? item.word} />
      </div>)}
      {morphology && <a className="small muted" href="https://corpus.quran.com/download/">Quranic Arabic Corpus 0.4</a>}
    </section>}
    <h3>Quran and modern Arabic</h3>
    <div className="equal-row">{[selection.word, modern].map((word, i) => <div className="card soft" key={i}>
      <small>{i === 0 ? "Quran spelling" : "Modern spelling"}</small><br /> <ArabicText text={word} />
    </div>)}</div>
    {curated?.modern.examples.map(item => <div className="card" key={item.ar}><ArabicText text={item.ar} /><p>{item.en}</p></div>)}
    <div className="equal-row">
      <button className="action" onClick={async () => {
        const id = "word:" + normalizeWord(morphology?.lemma ?? selection.word);
        try {
          await updateRecord<Reviews>("reviews", {}, previous => previous[id] ? previous : { ...previous, [id]: { ...reviewCard(undefined, "forgot", new Date()), bucket: "sabaq" } });
          toast("Added to your word review.");
        } catch { toast.error("This word could not be saved."); }
      }}>Add to my review</button>
      <button className="action light" onClick={() => { selectWord(); navigate("/learn/takhti"); }}>Trace it</button>
    </div>
  </>;
}

export function WordPanel({ desktop, ampara }: { desktop: boolean; ampara: boolean }) {
  const { word, selectWord } = useUi();
  if (desktop) return word ? <aside className="word-side card" aria-label="Word anatomy">
    <button className="icon-button anatomy-close" aria-label="Close word anatomy" onClick={() => selectWord()}><X size={20} /></button>
    <Anatomy selection={word} ampara={ampara} />
  </aside> : null;
  return <Dialog open={Boolean(word)} onOpenChange={open => { if (!open) selectWord(); }}>
    {word && <DialogContent className="awwab-dialog word-sheet" aria-describedby={undefined}>
      <DialogTitle className="sr-only">Word anatomy</DialogTitle>
      <Anatomy selection={word} ampara={ampara} />
    </DialogContent>}
  </Dialog>;
}
