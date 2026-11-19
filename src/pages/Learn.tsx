import { Link } from "react-router-dom";
import { BookOpen, Headphones, Languages, PenLine, ScrollText, Sparkles } from "lucide-react";
import { LearnDesktop } from "@/components/LearnDesktop";
import { ListLink } from "@/components/Surface";
import { useQaidaPlace, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { isDue, type Reviews } from "@/lib/reviews";
import { patternPracticePath, patternReviewPrefix } from "@/lib/learningPaths";
import type { Settings } from "@/lib/storageService";
import { studyNames } from "@/lib/study-copy";
import { MaktabMap, Paths } from "./Paths";
import qaida from "../../docs/content/qaida-lessons.json";
import surahs from "../../docs/content/surahs-for-salah.json";

function LearnMobile({ settings, now }: { settings: Settings; now: Date }) {
  const { t, language } = useCopy();
  const { lesson: lessonNumber, row } = useQaidaPlace();
  const lesson = qaida.lessons.find(item => item.n === lessonNumber) ?? qaida.lessons[0];
  const completed = useRecord<number[]>("qaida-complete", []);
  const reviews = useRecord<Reviews>("reviews", {});
  const due = Object.keys(reviews).filter(id => isDue(reviews[id], now));
  const dueSurahs = due.filter(id => /^\d+$/.test(id));
  const duePatterns = due.filter(id => id.startsWith(patternReviewPrefix)).length;
  const chapter = surahs.surahs.slice(0, 12).find(item => due.includes(String(item.number))) ?? surahs.surahs[2];
  const reviewPath = "/learn/surahs/" + chapter.number;
  const reviewSurah = studyNames.surah(language, chapter.number, chapter.transliteration);
  const title = t("lessonTitle", { number: lesson.n, title: studyNames.lesson(language, lesson.n, lesson.title) });
  const rowLabel = t("lessonRow", { name: lesson.traditional, row: row + 1 });
  return <div className="stack">
    <header><Link className="text-button" to="/learn/paths">{t("paths")}</Link><h1>{t("pathsStudyLibrary")}</h1></header>
    <section className="card night compact-stack">
      <p className="caption">{t("continueLearning")}</p><h2>{title}</h2>
      <p className="muted">{rowLabel}</p>
      <Link className="action light" to={"/learn/qaida/" + lesson.n}>{t("resumeLesson", { duration: settings.mode === "maktab" ? 3 : 5 })}</Link>
    </section>
    <div className="compact-stack">
      <ListLink to={reviewPath} icon={<Headphones size={20} />} title={t("recallSurah", { name: reviewSurah })} detail={dueSurahs.length ? t("itemsDue", { count: dueSurahs.length }) : t("shortSurah")} />
      {duePatterns > 0 && <ListLink to={patternPracticePath} icon={<Languages size={20} />} title={t("rootsPractice")} detail={t("itemsDue", { count: duePatterns })} />}
      <ListLink to="/learn/qaida" icon={<BookOpen size={20} />} title={t("nooraniQaida")} detail={t("lessonsPractised", { count: completed.length })} />
      <ListLink to="/learn/surahs" icon={<Headphones size={20} />} title={t("surahsForSalah")} detail={t("listenReadRecall")} />
      <ListLink to="/learn/salah" icon={<Sparkles size={20} />} title={t("understandSalah")} detail={t("tapToSpell")} />
      <ListLink to="/learn/takhti" icon={<PenLine size={20} />} title={t("takhti")} detail={t("learnLetterShapes")} />
      <ListLink to="/learn/fluency" icon={<Languages size={20} />} title={t("fluency")} detail={t("exploreArabic")} />
      <ListLink to="/learn/hadith" icon={<ScrollText size={20} />} title={t("hadith")} detail={t("searchHadith")} />
    </div>
  </div>;
}

export function Learn({ settings, desktop, now, tools = false }: { settings: Settings; desktop: boolean; now: Date; tools?: boolean }) {
  if (tools) return <LearnMobile settings={settings} now={now} />;
  if (desktop) return <LearnDesktop settings={settings} now={now} />;
  return settings.mode === "maktab" ? <MaktabMap /> : <Paths desktop={false} />;
}
