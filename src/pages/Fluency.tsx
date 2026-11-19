import { useState } from "react";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { WordFamily } from "@/components/FluencyCards";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { dateKey } from "@/lib/dates";
import { fluencyPairs, fluencyRoots, fluencySigns } from "@/lib/fluency";
import { saveFluencyPractice } from "@/lib/studyMilestones";
import type { Settings } from "@/lib/storageService";

export function Fluency({ settings, now }: { settings: Settings; now: Date }) {
  const { t, language } = useCopy();
  const zone = settings.city.timeZone;
  const day = Number(dateKey(now, zone).slice(-2));
  const writingDay = day % 2 === 1;
  const root = writingDay ? "كتب" : "علم";
  const daily = fluencyRoots[root];
  const signs = fluencySigns.slice(writingDay ? 0 : 3, writingDay ? 3 : 6);
  const known = useRecord<string[]>("fluency-words", []);
  const [practice, setPractice] = useState(false);
  const [saving, setSaving] = useState<string>();
  const [revealed, setRevealed] = useState<string[]>([]);

  async function remember(word: string) {
    if (saving) return;
    setSaving(word);
    try {
      await saveFluencyPractice("fluency-words", word, !known.includes(word), new Date(), zone);
    } catch { toast.error(t("saveError")); }
    finally { setSaving(undefined); }
  }

  return <div className="fluency-page">
    <header className="fluency-title">
      <p className="caption">{t("fluency")}</p>
      <h1>{t("fluencyTitle")}</h1>
    </header>
    <section className="card fluency-daily">
      <div className="row-between">
        <h2 className="caption">{t("fluencyRootDay")}</h2>
        <ArabicText text={Array.from(root).join(" ")} />
      </div>
      <h3>“{daily[language]}”</h3>
      <WordFamily words={daily.family} />
      <p className="small">{t(writingDay ? "fluencyMaktabNote" : "wordBankOneRoot")}</p>
    </section>
    <section className="fluency-pairs">
      <h2>{t("fluencySameWord")}</h2>
      {fluencyPairs.map(pair => <article className="card equal-row fluency-pair" key={pair.verse}>
        <div className="fluency-pair-modern">
          <p className="caption">{t("fluencyModernLabel")}</p>
          <ArabicText text={pair.modern} />
          <p className="small muted">{language === "bn" ? pair.modernBn : pair.modernEn}</p>
        </div>
        <div>
          <p className="caption">{t("wordBankQuran")}</p>
          <ArabicText text={pair.quran} citation={pair.verse} verse={pair.verse} positionOffset={pair.position - 1} />
          <p className="small muted">{pair[language]} · {pair.verse}</p>
        </div>
      </article>)}
    </section>
    <section className="card fluency-signs">
      <h2>{t("fluencySignsTitle")}</h2>
      <p className="small muted">{t("fluencySignsHint")}</p>
      <div className="equal-row" dir="rtl">
        {signs.map(word => <div className="fluency-sign" key={word.ar}>
          <ArabicText text={word.ar} words={[{ anatomyWord: word.vowels, transliteration: word.tr, gloss: word.en }]} showGlosses={false} />
          <small className="muted" dir="auto">{word[language]}</small>
        </div>)}
      </div>
    </section>
    <button className="action" type="button" onClick={() => setPractice(true)}>{t("fluencyThreeWords")}</button>
    <Dialog open={practice} onOpenChange={setPractice}>
      <DialogContent className="awwab-dialog fluency-dialog" aria-describedby={undefined}>
        <DialogTitle>{t("fluencyThreeWords")}</DialogTitle>
        {signs.map(word => {
          const shown = revealed.includes(word.ar);
          return <section className="card compact-stack" key={word.ar}>
            <ArabicText text={shown ? word.vowels : word.ar} words={[{ anatomyWord: word.vowels, transliteration: word.tr, gloss: word.en }]} showGlosses={false}
              onWordSelected={() => setPractice(false)} />
            {shown && <p role="status">{word[language]}</p>}
            <div className="equal-row">
              <button className="action light" type="button" aria-expanded={shown}
                onClick={() => setRevealed(previous => shown ? previous.filter(item => item !== word.ar) : [...previous, word.ar])}>{t(shown ? "fluencyHideMeaning" : "fluencyShowMeaning")}</button>
              <button className="action" type="button" aria-pressed={known.includes(word.ar)} disabled={Boolean(saving)}
                onClick={() => void remember(word.ar)}>{t(known.includes(word.ar) ? "known" : "fluencyKnownSign")}</button>
            </div>
          </section>;
        })}
      </DialogContent>
    </Dialog>
  </div>;
}
