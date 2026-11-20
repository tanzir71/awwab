import { ArabicText } from "@/components/ArabicText";
import { useCopy } from "@/lib/copy";
import type { HadithGrade } from "@/lib/hadith-catalogue";

const arabicRun = /(\p{Script=Arabic}[\p{Script=Arabic}\p{M}\u0640]*(?:[ \t]+\p{Script=Arabic}[\p{Script=Arabic}\p{M}\u0640]*)*)/gu;

export function GradeBadge({ grade }: { grade: HadithGrade }) {
  const { t } = useCopy();
  return <span className="hadith-grade" data-grade={grade.tier}>{t(grade.tier === "sahih" ? "hadithSahih" : "hadithHasan")}</span>;
}

export function HadithTranslation({ text, source, close, language = "en" }: {
  text: string; source: string; close?: () => void; language?: "en" | "bn";
}) {
  const paragraphs = text.replace(/ﷺ/gu, "صَلَّى ٱللَّهُ عَلَيْهِ وَسَلَّمَ").split(/\n+/g);
  return <div className="hadith-translation" lang={language} dir="ltr">{paragraphs.map((paragraph, index) =>
    <p key={index}>{paragraph.split(arabicRun).map((part, i) => i % 2
      ? <ArabicText key={i} text={part} compact citation={source} onWordSelected={close} />
      : part)}</p>)}</div>;
}

export function HadithSnippet({ text, language, full = false }: { text: string; language: "bn" | "en"; full?: boolean }) {
  return <span className={full ? undefined : "hadith-search-snippet"} lang={language} dir="ltr">{text.replace(arabicRun, "")}</span>;
}
