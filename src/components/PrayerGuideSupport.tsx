import { Link } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { VerseAudio } from "@/components/VerseAudio";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCopy } from "@/lib/copy";
import { guideTopics } from "@/lib/guide-copy";
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
    <DialogContent className="awwab-dialog guide-audio">
      <DialogTitle>{title}</DialogTitle>
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
  const { language, t } = useCopy();
  return <section className="card tint guide-lost" data-desktop={desktop}>
    <h2 className="with-icon">{!desktop && <DesignIcon name="guide-refresh" size={18} />}{t(topic ? "guideSahw" : desktop ? "guideLostShort" : "guideLostCount")}</h2>
    <p className={desktop ? "small" : "small muted"}>{t(desktop ? "guideLostDesktopHelp" : "guideLostCountHelp")}</p>
    <a href={lostCount.url} className="guide-citation">
      <span className="chip soft caption">{lostCount.grade}{!desktop && ` Muslim ${lostCount.number}`}</span>
      {desktop && <span className="small muted">Muslim {lostCount.number}</span>}
    </a>
    {hanafi && <p className="small muted">{notes.hanafiSahw[language]} <a href={notes.hanafiSahw.url}>{notes.hanafiSahw.source}</a></p>}
  </section>;
}

export function PrayerGuideTopicCard({ topic, hanafi }: { topic: PrayerGuideTopic; hanafi: boolean }) {
  const { t } = useCopy();
  if (topic === "sahw") return <PrayerGuideLostCount hanafi={hanafi} desktop topic />;
  const detail = { witr: "guideWitrDetail", eid: "guideEidDetail", janazah: "guideJanazahDetail" }[topic];
  const source = topic === "witr" ? notes.qunut : notes[topic];
  return <section className="card guide-topic-card">
    <h2>{t(guideTopics[topic].name)}</h2>
    <p>{t(detail)}</p>
    {topic === "witr" && <>
      <p className="small muted">{t("guideQunutExcerpt")}</p>
      <ArabicText text={notes.qunut.arabic} citation={source.source} />
      <p className="small" lang="ar-Latn">{notes.qunut.transliteration}</p>
    </>}
    {topic === "eid" && <a className="small" href={notes.jumuah.url}>{notes.jumuah.source}</a>}
    <a className="small" href={source.url}>{source.source}</a>
  </section>;
}
