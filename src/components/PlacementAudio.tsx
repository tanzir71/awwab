import { useState } from "react";
import { DesignIcon } from "@/components/DesignIcon";
import { VerseAudio } from "@/components/VerseAudio";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { asset } from "@/lib/config";
import { useCopy } from "@/lib/copy";
import { placementAudio } from "@/lib/onboarding";
import recordings from "../../public/packs/audio/index.json";

const paths = Object.fromEntries(Object.entries(placementAudio).map(([ref, sample]) => [ref, asset(sample.path)]));

export function PlacementAudio({ reference, title, concise = false }: { reference: string; title: string; concise?: boolean }) {
  const { t } = useCopy();
  const [selecting, setSelecting] = useState(false);
  const player = useAudioPlayback([reference], paths);
  const available = player.has(reference);
  const pack = recordings.packs.find(item => item.id === placementAudio[reference]?.pack);

  return <div className="setup-audio">
    <button className="setup-hear" type="button" aria-expanded={!available ? selecting : undefined} onClick={() => {
      if (available) player.play(reference);
      else setSelecting(value => !value);
    }}>
      <span><DesignIcon name="onboarding-volume" size={18} /></span>
      {t(player.playing ? "setupPause" : available ? concise ? "setupHear" : "setupHeard" : "addAudio")}
    </button>
    <audio ref={player.element} preload="none" {...player.events} aria-label={t("referenceAudioFor", { name: title })} />
    {player.error && <small role="status">{t("setupPlaybackError")}</small>}
    {available && player.track && placementAudio[reference]?.generated && <small className="muted">{t("generatedSpeech")}</small>}
    {available && player.track && pack && <small className="muted">
      <a href={pack.source} target="_blank" rel="noreferrer" lang="en">{pack.speaker}</a> · <a href={pack.licenseUrl} target="_blank" rel="noreferrer" lang="en">{pack.attribution.split(" · ")[1]}</a>
      <br />{t("setupAudioExcerpt")}
    </small>}
    {!available && selecting && <VerseAudio audioRef={reference} label={title} startExpanded />}
  </div>;
}
