import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalAudio } from "@/lib/storageService";

export function useAudioPlayback(refs: string[]) {
  const clips = useLiveQuery(() => db.audio.bulkGet(refs), [refs.join("|")], []);
  const element = useRef<HTMLAudioElement>(null);
  const source = useRef<{ clip: LocalAudio; url: string }>();
  const [track, setTrack] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const player = element.current;
    return () => {
      player?.pause();
      if (source.current) URL.revokeObjectURL(source.current.url);
    };
  }, []);

  function has(ref: string) {
    return clips.some(clip => clip?.ref === ref);
  }

  function play(ref: string, speed = 1, loop = false) {
    const clip = clips.find(item => item?.ref === ref);
    const player = element.current;
    if (!player || !clip) return;
    if (source.current?.clip === clip && !player.paused) {
      player.pause();
      return;
    }
    const changing = source.current?.clip !== clip;
    if (changing) {
      const url = URL.createObjectURL(clip.blob);
      if (source.current) URL.revokeObjectURL(source.current.url);
      source.current = { clip, url };
      player.src = url;
      setTrack(ref);
      setElapsed(0);
      setDuration(0);
    }
    document.querySelectorAll("audio").forEach(audio => { if (audio !== player) audio.pause(); });
    player.playbackRate = speed;
    player.loop = loop;
    setError(false);
    void player.play().catch((reason: unknown) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(true);
    });
  }

  const events = {
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
    onTimeUpdate: () => setElapsed(element.current?.currentTime ?? 0),
    onLoadedMetadata: () => {
      const current = element.current?.duration;
      setDuration(Number.isFinite(current) ? current : 0);
    },
  };

  return { element, events, has, play, track, playing, elapsed, duration, error };
}
