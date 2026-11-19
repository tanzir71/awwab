import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Headphones, Repeat } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/storageService";
import { LocalRecorder } from "./LocalRecorder";

export function VerseAudio({ audioRef, label, compare = false }: { audioRef: string; label: string; compare?: boolean }) {
  const clip = useLiveQuery(() => db.audio.get(audioRef), [audioRef]);
  const [url, setUrl] = useState("");
  const [loop, setLoop] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const player = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!clip?.blob) { setUrl(""); return; }
    const url = URL.createObjectURL(clip.blob);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [clip]);

  return <div className="compact-stack no-print">
    {url ? <div className="compact-stack">
      <div className="row-between"><small className="muted">{clip.title || "Your reference recording"}</small>
        <button type="button" className="action light" aria-label={`Loop ${label}`} aria-pressed={loop} onClick={() => setLoop(value => !value)}><Repeat size={17} /></button>
      </div>
      <audio className="w-full" ref={player} controls loop={loop} preload="none" src={url} aria-label={`Reference audio for ${label}`} />
    </div> : <button type="button" className="action soft" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><Headphones size={17} /> Add reference audio</button>}
    {(expanded || url) && <label className="field small">{url ? "Replace audio file" : `Choose an audio file for ${label}`}
      <input type="file" accept="audio/*" onChange={async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("audio/") || file.size > 12_000_000) {
          toast.error("Choose an audio file smaller than 12 MB."); return;
        }
        try { await db.audio.put({ ref: audioRef, blob: file, title: file.name }); }
        catch { toast.error("The audio file could not be saved on this device."); }
      }} />
    </label>}
    {compare && <LocalRecorder />}
  </div>;
}
