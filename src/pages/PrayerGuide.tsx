import { Link, useParams } from "react-router-dom";
import { DesignIcon } from "@/components/DesignIcon";
import { RakatCards } from "@/components/PrayerTimeline";
import { SectionNav } from "@/components/Surface";
import { PrayerGuideAudio, PrayerGuideLostCount, PrayerGuideTopicCard } from "@/components/PrayerGuideSupport";
import { DesktopPrayerGuide } from "@/components/DesktopPrayerGuide";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { guideTopics } from "@/lib/guide-copy";
import { hadithCitation } from "@/lib/hadith";
import { guidedPrayers, guideReference, guideSource, prayerGuide, prayerGuideTopics } from "@/lib/prayerGuide";
import type { Reviews } from "@/lib/reviews";
import type { Settings } from "@/lib/storageService";
import { studyNames } from "@/lib/study-copy";
import notes from "../../docs/content/prayer-guide.json";

export function PrayerGuide({ settings, desktop }: { settings: Settings; desktop: boolean }) {
  const { id } = useParams();
  const reviews = useRecord<Reviews>("reviews", {});
  const prayer = guidedPrayers.find(item => item === id);
  const topic = prayerGuideTopics.find(item => item === id);
  const copy = useCopy();
  const { locale, t } = copy;
  const hanafi = guideReference(settings) === "hanafi";
  if (desktop && (prayer || topic)) return <DesktopPrayerGuide prayer={prayer} topic={topic} settings={settings} reviews={reviews} />;
  if (topic) return <div className="prayer-guide">
    <SectionNav title={t(guideTopics[topic].name)} back="/today" />
    <PrayerGuideTopicCard topic={topic} hanafi={hanafi} />
  </div>;
  if (!prayer) return <Link className="action soft" to="/today">{t("today")}</Link>;
  const name = t(prayer === "jumuah" ? "guideJumuah" : prayer);
  const number = new Intl.NumberFormat(locale);
  const { groups, fardCount, total, steps } = prayerGuide(prayer, settings, reviews);
  const context = `fromPrayer=${prayer}`;
  const preferences = `/you/prayer?${context}`;
  const audioSurahs = [
    { number: 1, transliteration: "Al-Fātiḥa" },
    ...steps.flatMap(step => step.suggestion ? [step.suggestion] : []),
  ];
  const sources = [guideSource.recitationSource, ...(fardCount > guideSource.firstSittingAfter ? [guideSource.firstSittingSource] : []), guideSource.finalSittingSource];

  return <div className="prayer-guide">
    <SectionNav title={t("howToPrayNamed", { name })} back="/today" backIcon={<DesignIcon name="guide-back" size={24} />}
      action={<Link className="icon-button" to={preferences} aria-label={t("prayerGuideSettings")}><DesignIcon name="guide-settings" size={24} /></Link>} />
    <div className="guide-content">
      <section className="card night guide-summary">
        <h2 className="caption">{t("guideTotal", { count: total })}</h2>
        <RakatCards groups={groups} settings={settings} />
        <p>{t("guideShortOnTime", { count: fardCount })}</p>
      </section>
      <Link className="guide-reference" to={preferences}>
        <span className="chip soft">{t(hanafi ? "prayerGuideHanafi" : "prayerGuideFard")}</span>
        <span className="small muted">{t(hanafi ? "prayerGuideFollowing" : "prayerGuideShared")}</span>
      </Link>
      {groups.some(group => group.type === "witr") && <p className="small muted reading-copy">{t("guideWitrDifference")}</p>}
      {prayer === "jumuah" && <p className="small muted reading-copy">{t("guideJumuahIntro")} <a href={notes.jumuah.url}>{hadithCitation(notes.jumuah, copy).full}</a></p>}
      <section className="guide-rakahs" aria-labelledby="guide-rakahs-heading">
        <h2 id="guide-rakahs-heading">{t("guideStepHeading", { count: fardCount })}</h2>
        <ol className="compact-stack" role="list">
          {steps.map(step => {
            const reading = t(prayer === "jumuah" ? "guideJumuahRecitation" : step.suggestion ? "guideFatihaShortSurah" : "guideFatihaOnly");
            const title = step.sitting ? t(step.sitting === "final" ? "guideThenFinalSit" : "guideThenSit", { reading }) : reading;
            const suggestion = prayer === "jumuah" ? undefined : step.suggestion;
            const surah = suggestion && studyNames.surah(settings.language, suggestion.number, suggestion.transliteration);
            return <li key={step.number} className="list-row guide-rakah" data-final={step.sitting === "final"}>
              <span className="icon-box" aria-hidden="true">{number.format(step.number)}</span>
              <div>
                <strong>{title}</strong>
                <small>{suggestion && <Link to={`/learn/surahs/${suggestion.number}?${context}`}>
                  {t(step.sitting ? "guideTrySurahShort" : "guideTrySurah", { name: surah, count: suggestion.words })}
                </Link>}
                  {suggestion && step.sitting && " · "}
                  {step.sitting ? t(step.sitting === "final" ? "guideFinalSitting" : "guideFirstSitting")
                    : !suggestion && prayer !== "jumuah" && (step.recitation === "silent" ? t("guideSilent", { name }) : t("guideSilentRakah"))}
                </small>
              </div>
            </li>;
          })}
        </ol>
      </section>
      <PrayerGuideLostCount />
      <div className="equal-row guide-actions">
        <PrayerGuideAudio surahs={audioSurahs} context={context} title={t("guidePracticeAudio")} />
        <Link className="action soft" to={`/learn/salah?${context}`}>{t("guideWordByWord")}</Link>
      </div>
      <nav className="guide-source-list small muted" aria-label={t("guideSources")}>
        {sources.map(({ collection, number, grade, url }) => {
          const citation = hadithCitation({ url, source: `${collection} ${number} · ${grade}` }, copy);
          return <a key={number} href={url}>{t("hadithCitationGradeFirst", citation)}</a>;
        })}
      </nav>
    </div>
  </div>;
}
