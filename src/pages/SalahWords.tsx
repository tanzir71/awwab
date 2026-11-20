import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { QuranVerseMeaning } from "@/components/QuranStudySources";
import { SectionNav } from "@/components/Surface";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { prayerGuidePath } from "@/lib/prayerGuide";
import { coreWordCoverage, coreWordSource, coreWordTotal, countKnownQuranWords, fatihaMorphology, formatQuranReference, quranText } from "@/lib/quran";
import type { Settings } from "@/lib/storageService";
import { momentPath, setAyahFamiliar } from "@/lib/studyMilestones";
import { studyNames } from "@/lib/study-copy";
import { ayahGlossKey, salahGlossKey, salahPreviewKey } from "@/lib/study-gloss-messages.mjs";
import { splitArabicWords } from "@/lib/wordAnatomy";
import content from "../../docs/content/salah-words.json";

const previews = ["salahTakbir", "salahBowing", "salahProstration", "salahRising"].flatMap(id => {
  const index = content.sections.findIndex(section => section.preview?.id === id);
  return index < 0 ? [] : [{ section: content.sections[index], index }];
});
const fatiha = quranText[1];
const verseNotes: Record<string, { glosses: string[]; transliteration?: string }> = content.fatiha;

export function SalahWords({ settings }: { settings: Settings }) {
  const { language, locale, t, studyGloss } = useCopy();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [ayah, selectAyah] = useState(2);
  const [position, selectPosition] = useState(1);
  const [chooserOpen, setChooserOpen] = useState(false);
  const knownVerses = useRecord<string[]>("words-known", []);
  const knownVocabulary = useRecord<string[]>("word-bank-known", []);
  const verse = fatiha[ayah - 1];
  const reference = formatQuranReference(verse.ref, locale);
  const known = knownVerses.includes(verse.ref);
  const words = splitArabicWords(verse.uthmani);
  const notes = verseNotes[verse.ref];
  const details = words.map((_, index) => ({
    ...studyGloss(ayahGlossKey(verse.ref, index + 1)),
    root: fatihaMorphology[`${verse.ref}:${index + 1}`]?.root,
  }));
  const selected = details[position - 1];
  const studied = countKnownQuranWords(knownVerses, knownVocabulary);
  const number = new Intl.NumberFormat(locale);
  const coverage = new Intl.NumberFormat(locale, { style: "percent" }).format(coreWordCoverage);
  const lineSize = words.length <= 4 ? 4 : 3;
  const lines = Array.from({ length: Math.ceil(words.length / lineSize) }, (_, index) => words.slice(index * lineSize, (index + 1) * lineSize).join(" "));

  async function toggleFamiliar() {
    try {
      const earned = await setAyahFamiliar(verse.ref, !known);
      if (earned) navigate(momentPath("words", earned, true));
      else toast(t(known ? "salahVerseUnmarked" : "salahVerseSaved"));
    } catch {
      toast.error(t("saveError"));
    }
  }

  return <div className="salah-study">
    <SectionNav title={t("understandSalah")} back={prayerGuidePath(params.get("fromPrayer"), params.get("fromRakah")) ?? "/learn"}
      backIcon={<DesignIcon name="guide-back" size={24} />}
      action={<Link className="icon-button" to="/you/learning" aria-label={t("learningSettings")}><DesignIcon name="guide-settings" size={24} /></Link>} />
    <div className="salah-study-content">
      <header className="salah-intro"><h2>{t("salahWhatYouSay")}</h2><p className="muted">{t("salahIntro")}</p></header>
      <section className="card salah-verse">
        <div className="row-between">
          <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
            <DialogTrigger className="caption salah-pick" aria-label={`${t("salahPickAyah")} · ${t("salahAyahReference", { number: ayah })}`}>{t("salahAyahReference", { number: ayah })}</DialogTrigger>
            <DialogContent className="awwab-dialog">
              <DialogTitle>{t("fatihaWordByWord")}</DialogTitle>
              <DialogDescription className="muted">{t("markFamiliarHint")}</DialogDescription>
              <div className="salah-ayah-options" role="group" aria-label={t("salahPickAyah")}>
                {fatiha.map((item, index) => <button key={item.ref} type="button" className={`action ${ayah === index + 1 ? "" : "light"}`}
                  aria-label={t("salahAyahReference", { number: index + 1 })} aria-pressed={ayah === index + 1} onClick={() => {
                    selectAyah(index + 1);
                    selectPosition(1);
                    setChooserOpen(false);
                  }}>{number.format(index + 1)}</button>)}
              </div>
              <button type="button" className="action soft" onClick={() => void toggleFamiliar()}>
                {t(known ? "salahRemoveFamiliarAyah" : "salahFamiliarAyah", { number: ayah })}
              </button>
              <a className="text-button" href={`https://quran.com/${verse.ref.replace(":", "/")}`}><bdi>{reference}</bdi></a>
            </DialogContent>
          </Dialog>
          <span className="chip soft caption">{t("salahEveryRakah")}</span>
        </div>
        <ArabicText text={lines.join("\n")} citation={verse.ref} verse={verse.ref} selectedPosition={position} onWordSelected={selectPosition}
          words={details} />
        <p className="small muted">{notes.transliteration && <><bdi lang="ar-Latn">{notes.transliteration}</bdi> · </>}
          <a href={`https://quran.com/${verse.ref.replace(":", "/")}`}><bdi>{reference}</bdi></a>
        </p>
        <QuranVerseMeaning verse={verse} settings={settings} />
        <div className="salah-root small">
          <ArabicText text={words[position - 1]} compact citation={verse.ref} verse={verse.ref} positionOffset={position - 1}
            words={[selected]} showGlosses={false} />
          <bdi lang={selected?.glossLanguage}>{selected?.gloss}</bdi>
          {selected?.root && <div className="with-icon">{t("root")}
            <ArabicText text={[...selected.root].join(" ")} compact citation={verse.ref} />
          </div>}
        </div>
      </section>
      <section className="salah-positions">
        <div className="row-between"><h2>{t("salahThroughPrayer")}</h2>
          <Dialog>
            <DialogTrigger className="text-button">{t("salahPractice")}</DialogTrigger>
            <DialogContent className="awwab-dialog salah-practice">
              <DialogTitle>{t("salahPracticePositions")}</DialogTitle>
              <DialogDescription className="small muted">{t("prayerPositionNote")}</DialogDescription>
              {content.sections.map((section, sectionIndex) => <section className="card compact-stack" key={section.url + section.title}>
                <h2>{studyNames.prayerSection(language, section.title)}</h2>
                <a href={section.url} className="caption">{section.source}</a>
                {section.lines.map(([arabic, glosses], lineIndex) => <ArabicText key={lineIndex} text={String(arabic)} citation={section.source}
                  words={(glosses as string[]).map((_, index) => studyGloss(salahGlossKey(sectionIndex, lineIndex, index)))} />)}
              </section>)}
            </DialogContent>
          </Dialog>
        </div>
        <div className="compact-stack">{previews.map(({ section, index }) => {
          const [arabic, glosses] = section.lines[0];
          const meaning = studyGloss(salahPreviewKey(section.preview.id));
          return <article className="card salah-position" key={section.preview.id}>
            <div className="row-between">
              <div className="salah-position-label"><h3 className="caption">{t(section.preview.id)}</h3>
                <a className="small muted" href={section.url}>{section.source}</a>
              </div>
              <ArabicText text={String(arabic)} citation={section.source}
                words={(glosses as string[]).map((_, wordIndex) => studyGloss(salahGlossKey(index, 0, wordIndex)))} showGlosses={false} />
            </div>
            <p lang={meaning?.glossLanguage} dir="auto">{meaning?.gloss}</p>
          </article>;
        })}</div>
      </section>
      <section className="card tint salah-progress">
        <div className="row-between"><Link className="salah-progress-link" to="/learn/words">{t("salahCoreLearned")}</Link><strong>{number.format(studied)} / {number.format(coreWordTotal)}</strong></div>
        <progress value={studied} max={coreWordTotal} aria-label={t("salahCoreLearned")} />
        <p className="small muted">{t("salahCoreCoverage", { coverage })}</p>
        <div className="salah-source-links small"><a href={coreWordSource}>Quranic Arabic Corpus 0.4</a><a href="https://tanzil.net/docs/text_license">{t("tanzilCredit")}</a></div>
      </section>
    </div>
  </div>;
}
