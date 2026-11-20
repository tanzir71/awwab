import { useEffect, useRef, useState } from "react";
import { useCopy } from "@/lib/copy";
import { umrahGuidePack } from "@/lib/umrahGuideAudio";
import { useAudioPlayback } from "./use-audio-playback";

export function useUmrahVoice(stepId: string, automatic: boolean, paused: boolean) {
  const { language } = useCopy();
  const pack = umrahGuidePack(language);
  const reference = `${pack.id}:${stepId}`;
  const player = useAudioPlayback(pack.items.map(item => item.ref));
  const { pause, play, track, playing } = player;
  const available = player.has(reference);
  const active = playing && track === reference;
  const error = player.error && track === reference;
  const [following, setFollowing] = useState(false);
  const attempted = useRef<string>();

  useEffect(() => {
    if (track && track !== reference) pause();
    if (!automatic || !following || paused || !available || attempted.current === reference) return;
    attempted.current = reference;
    play(reference);
  }, [automatic, following, paused, available, reference, track, pause, play]);

  function listen() {
    attempted.current = reference;
    if (automatic && !active) setFollowing(true);
    play(reference);
  }

  function stopFollowing() {
    setFollowing(false);
    pause();
  }

  return { pack, player, available, active, error, automatic, following, listen, stopFollowing };
}
