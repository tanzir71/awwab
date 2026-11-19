import { Link, useParams } from "react-router-dom";
import { DesignIcon } from "@/components/DesignIcon";
import { RakatCards } from "@/components/PrayerTimeline";
import { SectionNav } from "@/components/Surface";
import { VerseAudio } from "@/components/VerseAudio";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRecord } from "@/hooks/use-awwab";
import { message } from "@/lib/copy";
import { guideReference, guideSource, prayerGuide } from "@/lib/prayerGuide";
import type { Reviews } from "@/lib/reviews";
import type { Settings } from "@/lib/storageService";
import { studyNames } from "@/lib/study-copy";
import { prayerIds } from "@/types/Prayer";
import hadith from "../../docs/content/hadith-curated.json";

const lostCount = hadith.items.find(item => item.collection === "muslim" && item.number === "571a");

export function PrayerGuide({ settings }: { settings: Settings }) {
  const { id } = useParams();
  const reviews = useRecord<Reviews>("reviews", {});
  const prayer = prayerIds.find(item => item === id);
  const t = message.bind(null, settings);
  if (!prayer) return <Link className="action soft" to="/today">{t("today")}</Link>;
  const name = t(prayer);
  const number = new Intl.NumberFormat(settings.language);
  const { groups, fardCount, total, steps } = prayerGuide(prayer, settings, reviews);
  const hanafi = guideReference(settings) === "hanafi";
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
      {groups.some(group => group.type === "witr") && <p className="small muted">{t("guideWitrDifference")}</p>}
      <section className="guide-rakahs" aria-labelledby="guide-rakahs-heading">
        <h2 id="guide-rakahs-heading">{t("guideStepHeading", { count: fardCount })}</h2>
        <ol className="compact-stack" role="list">
          {steps.map(step => {
            const reading = t(step.suggestion ? "guideFatihaShortSurah" : "guideFatihaOnly");
            const title = step.sitting ? t(step.sitting === "final" ? "guideThenFinalSit" : "guideThenSit", { reading }) : reading;
            const suggestion = step.suggestion;
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
                    : !suggestion && (step.recitation === "silent" ? t("guideSilent", { name }) : t("guideSilentRakah"))}
                </small>
              </div>
            </li>;
          })}
        </ol>
      </section>
      <section className="card tint guide-lost">
        <h2 className="with-icon"><DesignIcon name="guide-refresh" size={18} />{t("guideLostCount")}</h2>
        <p className="small muted">{t("guideLostCountHelp")}</p>
        <a href={lostCount.url} className="guide-citation"><span className="chip soft caption">{lostCount.grade} Muslim {lostCount.number}</span></a>
      </section>
      <div className="equal-row guide-actions">
        <Dialog>
          <DialogTrigger className="action">{t("guidePracticeAudio")}</DialogTrigger>
          <DialogContent className="awwab-dialog guide-audio">
            <DialogTitle>{t("guidePracticeAudio")}</DialogTitle>
            <DialogDescription className="muted small">{t("guideAudioNote")}</DialogDescription>
            {audioSurahs.map(item => {
              const label = studyNames.surah(settings.language, item.number, item.transliteration);
              return <section className="card compact-stack" key={item.number}>
                <h2>{label}</h2>
                <VerseAudio audioRef={`surah:${item.number}`} label={label} />
                <Link className="text-button" to={`/you/audio?surah=${item.number}&${context}`}>{t("downloadRecitation")}</Link>
              </section>;
            })}
          </DialogContent>
        </Dialog>
        <Link className="action soft" to={`/learn/salah?${context}`}>{t("guideWordByWord")}</Link>
      </div>
      <nav className="guide-source-list small muted" aria-label={t("guideSources")}>
        {sources.map(source => <a key={source.number} href={source.url}>{source.grade} {source.collection} {source.number}</a>)}
      </nav>
    </div>
  </div>;
}
