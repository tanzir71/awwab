import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useCopy } from "@/lib/copy";
import { downloadAudioPack } from "@/lib/audio";
import { db } from "@/lib/storageService";
import { umrahGuidePack, type UmrahGuidePack } from "@/lib/umrahGuideAudio";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { DesignIcon } from "./DesignIcon";
import { VerseAudio } from "./VerseAudio";

function VoiceCredit({ pack }: { pack: UmrahGuidePack }) {
  const { t } = useCopy();
  return <p className="small muted">
    <bdi lang={pack.language}>{pack.name}</bdi> · {t("askGeneratedSpeech")} · <a href={pack.source} rel="noreferrer">{pack.speaker}</a>
    {pack.dataset && <> · <a href={pack.dataset} rel="noreferrer">AI4Bharat Rasa</a></>}
  </p>;
}

export function UmrahGuideDownload({ pack }: { pack: UmrahGuidePack }) {
  const { t } = useCopy();
  const installed = useLiveQuery(() => db.audio.where("ref").anyOf(pack.items.map(item => item.ref)).count(), [pack.id]);
  const [progress, setProgress] = useState<number>();
  const [failed, setFailed] = useState(false);
  const ready = installed === pack.items.length;
  const working = progress !== undefined;
  const size = t("fileSizeMB", { size: pack.bytes / 1_000_000 });

  function download() {
    setFailed(false);
    setProgress(0);
    void downloadAudioPack(pack, setProgress).catch(() => setFailed(true)).finally(() => setProgress(undefined));
  }

  return <div className="compact-stack">
    <VoiceCredit pack={pack} />
    {ready ? <span className="chip soft">{t("umrahPrepDownloaded")}</span> :
      <button className="action soft" type="button" disabled={working} onClick={download}>
        {working ? t("umrahPrepDownloading") : t("umrahGuideDownload", { size })}
      </button>}
    {working && <progress value={progress} max={pack.items.length} aria-label={t("umrahPrepDownloading")} />}
    {failed && <p role="alert" className="small">{t("umrahGuideDownloadError")}</p>}
  </div>;
}

export function UmrahGuideVoice({ step, title }: { step: { id: string; narration: { en: string; bn: string } }; title: string }) {
  const { t, language } = useCopy();
  const pack = umrahGuidePack(language);
  const ref = `${pack.id}:${step.id}`;
  const player = useAudioPlayback([ref]);
  const hasAudio = player.has(ref);

  return <section className="card tint compact-stack umrah-guide-voice">
    <h2 className="with-icon"><DesignIcon name="umrah-prep-volume" size={16} />{t("umrahGuideVoice")}</h2>
    <audio ref={player.element} preload="none" hidden {...player.events} />
    {hasAudio ? <>
      <VoiceCredit pack={pack} />
      <button className="action" type="button" onClick={() => player.play(ref)}>
        {t(player.playing ? "umrahGuidePause" : "umrahGuideListen")}
      </button>
    </> : <UmrahGuideDownload key={pack.id} pack={pack} />}
    {player.error && <p role="alert" className="small">{t("askAudioError")}</p>}
    <details className="small">
      <summary>{t("umrahGuideTranscript")}</summary>
      <p lang={pack.language}>{step.narration[pack.language]}</p>
    </details>
    <details className="small">
      <summary>{t("umrahGuidePersonalAudio")}</summary>
      <VerseAudio audioRef={`umrah:${step.id}`} label={title} />
    </details>
  </section>;
}
