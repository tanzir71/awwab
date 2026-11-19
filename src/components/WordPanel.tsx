import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "./ui/dialog";
import { ArabicText } from "./ArabicText";
import { DesignIcon } from "./DesignIcon";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { useRecord } from "@/hooks/use-awwab";
import { normalizeWord, splitArabicWords, wordAnatomy } from "@/lib/wordAnatomy";
import { useUi, type WordSelection } from "@/lib/uiState";
import { lookupMorphology } from "@/lib/morphology";
import { reviewCard, type Reviews } from "@/lib/reviews";
import { updateRecord, type Settings } from "@/lib/storageService";
import { message } from "@/lib/copy";
import { studyNames } from "@/lib/study-copy";
import { families, lettersForFamily } from "@/lib/takhti";
import { quranText } from "@/lib/quran";

type PanelLayout = "sheet" | "adult-reader" | "maktab-reader" | "side";

const markIcons: Record<string, string> = {
  "harakat-kasra": "ellipse",
  "harakat-sukoon": "ellipse1",
  "harakat-fatha": "ellipse2",
  "harakat-silent": "ellipse3",
};

function AnatomyHeading({ number, children, label }: { number: number; children: ReactNode; label?: string }) {
  return <h3 className="anatomy-heading" aria-label={label}><span aria-hidden="true">{number}</span>{children}</h3>;
}

function Anatomy({ selection, settings, layout }: { selection: WordSelection; settings: Settings; layout: PanelLayout }) {
  const t = message.bind(null, settings);
  const maktab = settings.mode === "maktab";
  const ampara = settings.spellStyle === "ampara-bn";
  const { letters, syllables, joining, curated, modern } = wordAnatomy(selection.word, selection.connected);
  const { pathname, search } = useLocation();
  const wordPinned = useUi(state => state.wordPinned);
  const toggleWordPin = useUi(state => state.toggleWordPin);
  const reviews = useRecord<Reviews>("reviews", {});
  const [morphology, setMorphology] = useState<Awaited<ReturnType<typeof lookupMorphology>>>();
  const [step, setStep] = useState(-1);
  const [spelling, setSpelling] = useState(false);
  const [adding, setAdding] = useState(false);
  const verseRef = selection.verse;
  const wordRef = "word:" + normalizeWord(selection.word);
  const playback = useAudioPlayback(verseRef ? [wordRef, verseRef] : [wordRef]);
  const audioRef = playback.has(wordRef) ? wordRef : verseRef;
  const chapter = verseRef?.split(":")[0];
  const sourceVerse = quranText[chapter]?.find(verse => verse.ref === verseRef);
  const wholeVerse = sourceVerse && splitArabicWords(sourceVerse.uthmani).length === 1;
  const id = "word:" + normalizeWord(morphology?.lemma ?? selection.word);
  const shouldHear = layout === "sheet";
  const canPlay = audioRef && playback.has(audioRef);

  useEffect(() => {
    let current = true;
    if (verseRef && selection.position) void lookupMorphology(verseRef, selection.position).then(word => {
      if (current) setMorphology(word);
    }).catch(() => {});
    return () => { current = false; };
  }, [verseRef, selection.position]);

  useEffect(() => {
    if (!spelling || step < 0) return;
    const timer = window.setTimeout(() => {
      if (step + 1 === letters.length) setSpelling(false);
      setStep(step + 1 === letters.length ? -1 : step + 1);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [spelling, step, letters.length]);

  const pronunciation = selection.transliteration ?? curated?.translit ?? syllables.map(item => item.tr).join("-");
  const gloss = selection.gloss ?? curated?.meaning;
  const root = curated?.root.letters.join(" ") ?? selection.root ?? (morphology?.root ? Array.from(morphology.root).join(" ") : "");
  const traceFamily = families.find(family => lettersForFamily(family.id).some(letter => letter.letter === letters[0]?.base));
  const tracePath = traceFamily ? "/learn/takhti/" + traceFamily.id + "?letter=" + encodeURIComponent(letters[0].base) : "/learn/takhti";
  const print = new URLSearchParams({ word: selection.word, back: pathname + search });
  if (selection.citation) print.set("source", selection.citation);
  if (gloss) print.set("meaning", gloss);
  const compact = layout === "adult-reader" || layout === "maktab-reader";
  const rootItems = layout === "maktab-reader" && curated ? curated.root.family.slice(1) : curated?.root.family;
  const modernExamples = layout === "maktab-reader" ? curated?.modern.examples.slice(1, 2) :
    layout === "adult-reader" && curated ? [curated.modern.examples[1], curated.modern.examples[0]] : curated?.modern.examples;
  const nonJoiners = [...new Set(letters.filter((tile, index) => index + 1 < letters.length && !tile.joinsNext).map(tile => tile.base))].join(" ");
  const pronunciationLabel = t(playback.playing ? "surahPause" : wholeVerse || audioRef === wordRef ? "anatomyHear" : "anatomyHearVerse");

  async function addReview() {
    if (adding) return;
    setAdding(true);
    try {
      const match = morphology ?? (verseRef && selection.position ? await lookupMorphology(verseRef, selection.position).catch(() => undefined) : undefined);
      const reviewId = "word:" + normalizeWord(match?.lemma ?? selection.word);
      await updateRecord<Reviews>("reviews", {}, saved => saved[reviewId] ? saved : {
        ...saved, [reviewId]: { ...reviewCard(undefined, "forgot", new Date()), bucket: "sabaq" },
      });
      toast(t("wordReviewAdded"));
    } catch { toast.error(t("wordSaveError")); }
    finally { setAdding(false); }
  }

  return <div className="anatomy-content" data-layout={layout}>
    <audio ref={playback.element} {...playback.events} hidden />
    {layout === "adult-reader" && <div className="row-between anatomy-panel-label"><h2>{t("wordAnatomy")}</h2>
      <button type="button" className="text-button" aria-pressed={wordPinned} onClick={toggleWordPin}>{t(wordPinned ? "anatomyUnpin" : "anatomyPin")}</button></div>}
    <header className="row-between anatomy-header">
      <div>{layout !== "adult-reader" && <p className="caption">{t(maktab && layout === "sheet" ? "anatomySpellIt" : "wordAnatomy")}</p>}
        <h2>{pronunciation || t("spellItOut")}</h2>
        <p className="muted small">{gloss && <span lang={selection.glossLanguage ?? "en"}>“{gloss}”</span>}{gloss && selection.citation && " · "}{selection.citation}</p>
        {selection.annotation && <p className="small">{selection.annotation.label}</p>}</div>
      <div className="anatomy-title"><ArabicText text={selection.word} citation={selection.citation} verse={verseRef}
        positionOffset={(selection.position ?? 1) - 1} words={[{ transliteration: pronunciation, root, gloss }]} showGlosses={false} /></div>
    </header>
    {shouldHear && <div className="equal-row anatomy-audio">
      {canPlay ? <button className="action soft" type="button" onClick={() => playback.play(audioRef)}>
        {!playback.playing && <span aria-hidden="true">▶️</span>}{pronunciationLabel}</button> :
        <Link className="action soft" to={chapter ? "/you/audio?surah=" + chapter : "/you/audio"}><span aria-hidden="true">▶️</span>{t("anatomyHear")}</Link>}
      <button className="action light" type="button" aria-pressed={spelling} onClick={() => {
        if (spelling) { setSpelling(false); setStep(-1); }
        else { setStep(0); setSpelling(true); }
      }}>{t("anatomySlow")}</button>
    </div>}
    {playback.error && <p className="small muted" role="status">{t("surahAudioError")}</p>}
    <section className="anatomy-section">
      <AnatomyHeading number={1}>{t(compact && layout === "adult-reader" ? "letters" : "anatomyLetters")}</AnatomyHeading>
      {!compact && <p className="muted small">{t("anatomyLettersHint")}</p>}
      <div className="letter-tiles anatomy-letter-tiles" dir="rtl" role="group" aria-label={t("letters")} tabIndex={0}>
        {letters.map((tile, index) => {
          const mark = tile.silent ? t("silent") : !tile.details.length ? t("noMark") : ampara ? tile.details.map(item => item.nameBn).join(" · ") : tile.mark;
          const markIcon = markIcons[tile.color];
          return <div key={index} className="letter-tile" data-silent={tile.silent} data-step={step === index} style={{ "--mark-color": "var(--c-" + tile.color + ")" } as CSSProperties}>
            <ArabicText text={tile.glyph} compact showGlosses={false} />
            <strong dir="auto" lang={ampara && tile.nameBn ? "bn" : "en"}>{ampara ? tile.nameBn ?? tile.name : tile.name}</strong>
            <small className="anatomy-mark" dir="auto">
              {markIcon && <DesignIcon name={(maktab ? "surah-maktab-" : "surah-adult-") + markIcon} size={6} />}{mark}
            </small>
            <strong dir="ltr" className="anatomy-sound">{tile.sound || "—"}</strong>
          </div>;
        })}
      </div>
      {spelling && step >= 0 && <span className="sr-only" role="status">{letters[step]?.name} {letters[step]?.mark} {letters[step]?.sound}</span>}
    </section>
    <section className="anatomy-section">
      <AnatomyHeading number={2}>{t("sounds")}{compact && <span className="anatomy-heading-detail">{syllables.filter(item => item.tr).map(item => item.tr).join(" · ")}</span>}</AnatomyHeading>
      {!compact && <>
        <p className="muted small">{t("anatomySoundsHint")}</p>
        <div className="anatomy-syllables" dir="rtl" role="group" aria-label={t("sounds")}>
          {syllables.map((item, index) => <div className="anatomy-syllable" key={index}><ArabicText text={item.ar} compact /><strong dir="ltr">{item.tr || "—"}</strong></div>)}
        </div>
        <p className="anatomy-joined-sound soft">= {pronunciation}</p>
      </>}
    </section>
    <section className="anatomy-section">
      <AnatomyHeading number={3}>{t("joining")}{compact && nonJoiners && <span className="anatomy-heading-detail with-icon">
        {t("anatomyCompactJoin")} <ArabicText text={nonJoiners} compact /></span>}
        {layout === "adult-reader" && <ArabicText text={selection.word} compact />}</AnatomyHeading>
      {!compact && <p className="small muted">{t("anatomyJoinHint")}</p>}
      {!compact && nonJoiners && <div className="small muted with-icon">{t("anatomyNeverJoin")} <ArabicText text={nonJoiners} compact /></div>}
      {layout !== "adult-reader" && <div dir="rtl" className="anatomy-joining" role="group" aria-label={t("joiningForms")} tabIndex={0}>
        {joining.map((tile, index) => <div className="anatomy-joining-tile" key={index}><ArabicText text={tile.form} compact />{!compact && <small>{t(tile.position)}</small>}</div>)}
      </div>}
      {!compact && <div className="anatomy-joined-example"><ArabicText text={selection.word} compact /></div>}
      {curated?.prefixes.length && layout === "adult-reader" ? <div className="anatomy-prefixes">
        <strong className="caption">{t("anatomyPrefixes")}</strong>
        {curated.prefixes.map(item => <span key={item.ar} className="with-icon"><ArabicText text={item.ar} compact /><small>{item.meaning}</small></span>)}
      </div> : null}
    </section>
    {root && <section className="anatomy-section anatomy-root">
      <AnatomyHeading number={4} label={t("rootFamily")}>{t("root")} <ArabicText text={root} compact />
        {compact && curated && <small>{curated.root.meaning}</small>}</AnatomyHeading>
      {!compact && <p className="small muted">{curated?.root.meaning && curated.root.meaning + " · "}{t("anatomyFamilyHint")}</p>}
      {rootItems && <div className="anatomy-family">{rootItems.map(item => <div className="anatomy-family-entry" key={item.ar}>
        <div><strong>{item.tr}</strong><small className="muted">{item.en}</small></div><ArabicText text={item.ar} compact words={[{ transliteration: item.tr, gloss: item.en }]} showGlosses={false} />
      </div>)}</div>}
      {!curated && morphology?.family.slice(0, 4).map(item => <div className="anatomy-family-entry" key={item.verse + ":" + item.position}>
        <div><strong>{studyNames.wordKind(settings.language, item.type)}</strong><small>{item.verse}</small></div>
        <ArabicText text={item.lemma ?? item.word} citation={item.verse} compact />
      </div>)}
      {!curated && morphology && <a className="small muted" href="https://corpus.quran.com/download/">Quranic Arabic Corpus 0.4</a>}
    </section>}
    <section className="anatomy-section">
      <AnatomyHeading number={5}>{t("anatomyQuranModern")}</AnatomyHeading>
      {!compact && <p className="small muted">{t("anatomySpellingHint")}</p>}
      <div className="equal-row anatomy-spellings">
        {[selection.word, modern].map((word, index) => <div key={index} className={index ? "tint" : "soft"}>
          <p className="caption">{t(index === 0 ? "quranSpelling" : "modernSpelling")}</p><ArabicText text={word} compact />
          {!compact && <small className="muted">{pronunciation}</small>}
        </div>)}
      </div>
      {modernExamples?.length ? <div className="anatomy-modern-list">
        {layout !== "maktab-reader" && <h4>{t("anatomyEveryday")}</h4>}
        {modernExamples.map(item => <div key={item.ar} className="anatomy-modern-sentence">
          <ArabicText text={item.ar} compact />
          <div>{!compact && <strong>{item.tr}</strong>}<p>{item.en}</p></div>
        </div>)}
      </div> : null}
    </section>
    <div className="equal-row anatomy-actions">
      <button className="action" type="button" disabled={adding || Boolean(reviews[id])} onClick={() => void addReview()}>{t(reviews[id] ? "anatomyAdded" : "addWordReview")}</button>
      {layout !== "maktab-reader" && <Link className={compact ? "action soft" : "action light"} to={tracePath}>{t("traceIt")}</Link>}
      {compact && <Link className={layout === "maktab-reader" ? "action light" : "action soft"} to={"/print/word-card?" + print}>
        {t(layout === "maktab-reader" ? "anatomyPrintWord" : "anatomyPrint")}</Link>}
    </div>
  </div>;
}

export function WordPanel({ desktop, settings, reader = false }: { desktop: boolean; settings: Settings; reader?: boolean }) {
  const word = useUi(state => state.word);
  const selectWord = useUi(state => state.selectWord);
  const t = message.bind(null, settings);
  const key = word ? [word.verse, word.position, word.word].join(":") : "";
  if (desktop) return word ? <aside className={reader ? "word-side anatomy-reader-panel" : "word-side card"} aria-label={t("wordAnatomy")}
    onKeyDown={event => { if (event.key === "Escape") selectWord(); }}>
    {!reader && <button className="icon-button anatomy-close" aria-label={t("closeWordAnatomy")} onClick={() => selectWord()}><X size={20} /></button>}
    <Anatomy key={key} selection={word} settings={settings} layout={reader ? settings.mode === "maktab" ? "maktab-reader" : "adult-reader" : "side"} />
  </aside> : null;
  return <Dialog open={Boolean(word)} onOpenChange={open => { if (!open) selectWord(); }}>
    {word && <DialogContent className="awwab-dialog word-sheet" aria-describedby={undefined} showCloseButton={false}>
      <DialogTitle className="sr-only">{t("wordAnatomy")}</DialogTitle>
      <DialogClose asChild><button type="button" className="anatomy-grip" aria-label={t("shareClose")} /></DialogClose>
      <Anatomy key={key} selection={word} settings={settings} layout="sheet" />
    </DialogContent>}
  </Dialog>;
}
