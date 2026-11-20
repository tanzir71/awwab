import { useCopy } from "@/lib/copy";
import { quranMeaningSource } from "@/lib/quran";
import type { Settings } from "@/lib/storageService";
import { StudyText } from "./StudyText";

export function QuranStudySources({ script, morphology = false }: { script: Settings["script"] | "both"; morphology?: boolean }) {
  const { t } = useCopy();
  return <footer className="hifz-sources small muted">
    {script !== "indopak" && <a href="https://tanzil.net/" rel="noreferrer">{t("hifzTanzil")}</a>}
    {script !== "uthmani" && <a href="https://github.com/DigitalKhatt/digitalkhatt-js" rel="noreferrer">{t("hifzIndopak")}</a>}
    {morphology && <a href="https://corpus.quran.com/download/" rel="noreferrer">{t("readingRootSource")}</a>}
  </footer>;
}

export function QuranVerseMeaning({ text, cue = false }: { text: string; cue?: boolean }) {
  const { t } = useCopy();
  return <div className="quran-verse-meaning">
    <p className="muted">{cue && <>{t("cue")} · </>}<bdi lang="en" dir="ltr"><StudyText text={text} /></bdi></p>
    <a className="small" href={quranMeaningSource} rel="noreferrer">{t("englishTranslationCredit")}</a>
  </div>;
}
