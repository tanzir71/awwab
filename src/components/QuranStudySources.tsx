import { useCopy } from "@/lib/copy";
import type { Settings } from "@/lib/storageService";

export function QuranStudySources({ script, english, morphology = false }: { script: Settings["script"] | "both"; english?: boolean; morphology?: boolean }) {
  const { t } = useCopy();
  return <footer className="hifz-sources small muted">
    {script !== "indopak" && <a href="https://tanzil.net/" rel="noreferrer">{t("hifzTanzil")}</a>}
    {script !== "uthmani" && <a href="https://github.com/DigitalKhatt/digitalkhatt-js" rel="noreferrer">{t("hifzIndopak")}</a>}
    {english && <a href="https://tanzil.net/trans/en.pickthall" rel="noreferrer">{t("hifzPickthall")}</a>}
    {morphology && <a href="https://corpus.quran.com/download/" rel="noreferrer">{t("readingRootSource")}</a>}
  </footer>;
}
