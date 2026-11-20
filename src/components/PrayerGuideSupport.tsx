import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { VerseAudio } from "@/components/VerseAudio";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCopy } from "@/lib/copy";
import { guideTopics } from "@/lib/guide-copy";
import { hadithCitation } from "@/lib/hadith";
import type { PrayerGuideTopic } from "@/lib/prayerGuide";
import { studyNames } from "@/lib/study-copy";
import hadith from "../../docs/content/hadith-curated.json";
import notes from "../../docs/content/prayer-guide.json";

const lostCount = hadith.items.find(item => item.collection === "muslim" && item.number === "571a");

export function PrayerGuideAudio({ surahs, context, title, desktop = false }: {
  surahs: { number: number; transliteration: string }[]; context: string; title: string; desktop?: boolean;
}) {
  const { language, t } = useCopy();
  return <Dialog>
    <DialogTrigger className={desktop ? "guide-desk-audio-button" : "action"}>
      {desktop && <DesignIcon name="desk-play" size={17} />}{title}
    </DialogTrigger>
    <DialogContent className="awwab-dialog guide-audio" showCloseButton={false}>
      <div className="row-between"><DialogTitle>{title}</DialogTitle>
        <DialogClose className="icon-button" aria-label={t("qadaClose")}><X size={18} aria-hidden="true" /></DialogClose>
      </div>
      <DialogDescription className="muted small">{t("guideAudioNote")}</DialogDescription>
      {surahs.map(item => {
        const label = studyNames.surah(language, item.number, item.transliteration);
        return <section className="card compact-stack" key={item.number}>
          <h2>{label}</h2>
          <VerseAudio audioRef={`surah:${item.number}`} label={label} />
          <Link className="text-button" to={`/you/audio?surah=${item.number}&${context}`}>{t("downloadRecitation")}</Link>
        </section>;
      })}
    </DialogContent>
  </Dialog>;
}

export function PrayerGuideLostCount({ desktop = false, hanafi = false, topic = false }: { desktop?: boolean; hanafi?: boolean; topic?: boolean }) {
  const copy = useCopy();
  const { language, t } = copy;
  const citation = hadithCitation({ url: lostCount.url, source: `Muslim ${lostCount.number} · ${lostCount.grade}` }, copy);
  const hanafiLanguage = language === "bn" ? "bn" : "en";
  return <section className="card tint guide-lost" data-desktop={desktop}>
    <h2 className="with-icon">{!desktop && <DesignIcon name="guide-refresh" size={18} />}{t(topic ? "guideSahw" : desktop ? "guideLostShort" : "guideLostCount")}</h2>
    <p className={desktop ? "small reading-copy" : "small muted reading-copy"}>{t(desktop ? "guideLostDesktopHelp" : "guideLostCountHelp")}</p>
    <a href={lostCount.url} className="guide-citation">
      <span className="chip soft caption">{desktop ? citation.grade : t("hadithCitationGradeFirst", citation)}</span>
      {desktop && <> <span className="small muted">{citation.reference}</span></>}
    </a>
    {hanafi && <p className="small muted" lang={hanafiLanguage}>{notes.hanafiSahw[hanafiLanguage]} <a href={notes.hanafiSahw.url}>{notes.hanafiSahw.source}</a></p>}
  </section>;
}

export function PrayerGuideTopicCard({ topic, hanafi, desktop = false }: { topic: PrayerGuideTopic; hanafi: boolean; desktop?: boolean }) {
  const copy = useCopy();
  const { t } = copy;
  if (topic === "sahw") return <PrayerGuideLostCount hanafi={hanafi} desktop={desktop} topic />;
  const detail = { witr: "guideWitrDetail", eid: "guideEidDetail", janazah: "guideJanazahDetail" }[topic];
  const source = topic === "witr" ? notes.qunut : notes[topic];
  return <section className="card guide-topic-card">
    <h2>{t(guideTopics[topic].name)}</h2>
    <p className="reading-copy">{t(detail)}</p>
    {topic === "witr" && <>
      <p className="small muted">{t("guideQunutExcerpt")}</p>
      <ArabicText text={notes.qunut.arabic} citation={source.source} />
      <p className="small" lang="ar-Latn">{notes.qunut.transliteration}</p>
    </>}
    {topic === "eid" && <a className="small" href={notes.jumuah.url}>{hadithCitation(notes.jumuah, copy).full}</a>}
    <a className="small" href={source.url}>{hadithCitation(source, copy).full}</a>
  </section>;
}
