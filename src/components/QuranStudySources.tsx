import { useCopy } from "@/lib/copy";
import { quranMeaningPreferences } from "@/lib/languagePreferences";
import { localeQuranEdition } from "@/lib/localePacks";
import { quranMeaningSource, type QuranVerse } from "@/lib/quran";
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

export function QuranVerseMeaning({ verse, settings, cue = false, reveal = false, english }: {
  verse: QuranVerse; settings: Pick<Settings, "language" | "quranMeanings" | "englishMeaning">;
  cue?: boolean; reveal?: boolean; english?: boolean;
}) {
  const { t } = useCopy();
  const preferences = quranMeaningPreferences(settings);
  const edition = reveal ? localeQuranEdition(settings.language) : preferences.local;
  const meaning = edition?.verses[verse.ref];
  const showEnglish = english ?? (preferences.english || (reveal && !meaning));
  if (!meaning && !showEnglish) return null;
  return <div className="quran-verse-meaning">
    {meaning && <>
      <p className="muted">{cue && <>{t("cue")} · </>}<bdi lang={settings.language} dir="auto">{meaning}</bdi></p>
      <a className="small" href={edition.source} dir="auto" rel="noreferrer">{edition.credit}</a>
    </>}
    {showEnglish && <>
      <p className="muted">{cue && !meaning && <>{t("cue")} · </>}<bdi lang="en" dir="ltr"><StudyText text={verse.english} /></bdi></p>
      <a className="small" href={quranMeaningSource} rel="noreferrer">{t("englishTranslationCredit")}</a>
    </>}
  </div>;
}
