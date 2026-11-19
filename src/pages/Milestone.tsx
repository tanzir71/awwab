import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { DesignIcon } from "@/components/DesignIcon";
import { ShareArtwork } from "@/components/ShareArtwork";
import { useRecord } from "@/hooks/use-awwab";
import { shareChapters, useShareCards } from "@/hooks/use-share-cards";
import { useCopy } from "@/lib/copy";
import type { Reviews } from "@/lib/reviews";
import { shareTemplates, type ShareModel } from "@/lib/share";
import type { Settings } from "@/lib/storageService";
import { studyNames } from "@/lib/study-copy";
import { type MomentTemplate, type WordMilestone } from "@/lib/studyMilestones";
import qaida from "../../docs/content/qaida-lessons.json";

export function Milestone({ settings, now }: { settings: Settings; now: Date }) {
  const { t, language } = useCopy();
  const { kind, number } = useParams();
  const [params] = useSearchParams();
  const value = Number(number);
  const template = shareTemplates.find(item => item.id === kind && item.id !== "return" && item.id !== "umrah");
  const cards = useShareCards(settings, now, template?.id, value);
  const reviews = useRecord<Reviews>("reviews", {});
  const earned = useRecord<WordMilestone[]>("word-milestones", []);
  const completed = useRecord<number[]>("qaida-complete", []);
  const model = useMemo<ShareModel>(() => template ? ({ template: template.id, format: "post", light: template.theme === "light",
    showPrayerNumbers: false, card: cards[template.id] }) : undefined, [template, cards]);
  const fromSalah = params.get("from") === "salah";
  const chapter = shareChapters.find(item => item.number === value);
  const lesson = qaida.lessons.find(item => item.n === value);
  const bookComplete = qaida.lessons.every(item => completed.includes(item.n));
  const nextStudy = t("continueLearning");

  let moment: { title: string; detail: string; close: string; next: string; continueLabel: string } | undefined;
  switch (kind as MomentTemplate) {
    case "surah":
      if (chapter && reviews[value]?.bucket === "manzil") {
        const name = studyNames.surah(language, value, value === 103 ? "Al-ʿAsr" : chapter.transliteration);
        const following = shareChapters.slice(shareChapters.indexOf(chapter) + 1).find(item => reviews[item.number]?.bucket !== "manzil");
        moment = { title: t("momentSurah", { name }), detail: t("momentSurahDetail", { name }), close: `/learn/surahs/${value}`,
          next: following ? `/learn/surahs/${following.number}` : "/learn/surahs",
          continueLabel: following ? t("momentNextSurah", { name: studyNames.surah(language, following.number, following.transliteration), count: following.words }) : nextStudy };
      }
      break;
    case "words":
      if (earned.includes(value as WordMilestone)) {
        const path = fromSalah ? "/learn/salah" : "/learn/words";
        moment = { title: t("momentWords", { count: value }), detail: t("momentWordsDetail"), close: path, next: path, continueLabel: nextStudy };
      }
      break;
    case "qaida":
      if (lesson && completed.includes(value)) {
        const name = studyNames.lesson(language, value, lesson.title);
        moment = { title: t("momentQaida", { number: value }), detail: t("momentQaidaDetail", { name }), close: `/learn/qaida/${value}`,
          next: value < qaida.lessons.length ? `/learn/qaida/${value + 1}` : "/learn", continueLabel: nextStudy };
      }
      break;
    case "maktab":
      if (bookComplete && value === qaida.lessons.length) moment = { title: t("momentMaktab"), detail: t("momentMaktabDetail"), close: "/learn/qaida", next: "/learn", continueLabel: nextStudy };
      break;
  }

  if (!moment || !model) return <div className="share-moment"><Link className="action soft" to="/learn">{nextStudy}</Link></div>;
  const share = `/share?template=${model.template}&value=${value}&from=moment${fromSalah ? "&study=salah" : ""}`;
  return <section className="share-moment" aria-labelledby="milestone-title">
    <Link className="icon-button share-close" aria-label={t("shareClose")} to={moment.close}><DesignIcon name="share-close" size={22} /></Link>
    <div className="moment-copy">
      <span className="moment-check"><DesignIcon name="share-moment-check" size={24} /></span>
      <h1 id="milestone-title">{moment.title}</h1>
      <p className="muted">{moment.detail}</p>
      <ShareArtwork model={model} label={t("shareCardLabel", { title: moment.title })} />
    </div>
    <div className="moment-actions">
      <Link className="action" to={share}>{t("shareThis")}</Link>
      <Link className="action light" to={moment.next}>{moment.continueLabel}</Link>
    </div>
  </section>;
}
