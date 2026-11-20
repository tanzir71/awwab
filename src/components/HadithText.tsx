import { ArabicText } from "@/components/ArabicText";
import { useCopy } from "@/lib/copy";
import type { localHadithMeaning } from "@/lib/hadith";
import type { HadithGrade } from "@/lib/hadith-catalogue";

const arabicRun = /(\p{Script=Arabic}[\p{Script=Arabic}\p{M}\u0640]*(?:[ \t]+\p{Script=Arabic}[\p{Script=Arabic}\p{M}\u0640]*)*)/gu;

export function GradeBadge({ grade }: { grade: HadithGrade }) {
  const { t } = useCopy();
  return <span className="hadith-grade" data-grade={grade.tier}>{t(grade.tier === "sahih" ? "hadithSahih" : "hadithHasan")}</span>;
}

export function HadithTranslation({ text, source, close, language = "en", verbatim = false }: {
  text: string; source: string; close?: () => void; language?: string; verbatim?: boolean;
}) {
  const paragraphs = (verbatim ? text : text.replace(/ﷺ/gu, "صَلَّى ٱللَّهُ عَلَيْهِ وَسَلَّمَ")).split(/\n+/g);
  return <div className="hadith-translation" lang={language} dir={verbatim ? "auto" : "ltr"}>{paragraphs.map((paragraph, index) =>
    <p key={index}>{verbatim ? paragraph : paragraph.split(arabicRun).map((part, i) => i % 2
      ? <ArabicText key={i} text={part} compact citation={source} onWordSelected={close} />
      : part)}</p>)}</div>;
}

export function LocalHadithTranslation({ local, english, citation, close }: {
  local: NonNullable<ReturnType<typeof localHadithMeaning>>; english: string; citation: string; close?: () => void;
}) {
  const { t } = useCopy();
  return <div className="hadith-meaning">
    <p className="caption">{t("surahTranslation")}</p>
    <HadithTranslation text={local.text} language={local.language} source={citation} verbatim />
    <a className="small" href={local.source} dir="auto" rel="noreferrer">{local.credit}</a>
    <details className="hadith-english-disclosure">
      <summary className="text-button">{t("hadithReadEnglish")}</summary>
      <HadithTranslation text={english} source={citation} close={close} />
    </details>
  </div>;
}

export function HadithSnippet({ text, language, full = false, verbatim = false }: {
  text: string; language: string; full?: boolean; verbatim?: boolean;
}) {
  return <span className={full ? undefined : "hadith-search-snippet"} lang={language} dir={verbatim ? "auto" : "ltr"}>
    {verbatim ? text : text.replace(arabicRun, "")}
  </span>;
}
