import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Headphones, Repeat } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/storageService";
import { useCopy } from "@/lib/copy";
import { LocalRecorder } from "./LocalRecorder";
import audioCatalogue from "../../public/packs/audio/index.json";

export function VerseAudio({ audioRef, label, compare = false, startExpanded = false, showAttribution = false }: {
  audioRef: string; label: string; compare?: boolean; startExpanded?: boolean; showAttribution?: boolean;
}) {
  const { t } = useCopy();
  const clip = useLiveQuery(() => db.audio.get(audioRef), [audioRef]);
  const [url, setUrl] = useState("");
  const [loop, setLoop] = useState(false);
  const [expanded, setExpanded] = useState(startExpanded);
  const original = showAttribution && clip?.attribution && audioCatalogue.packs.find(pack => pack.attribution === clip.attribution && pack.items.some(item => item.ref === audioRef));
  useEffect(() => {
    if (!clip?.blob) { setUrl(""); return; }
    const url = URL.createObjectURL(clip.blob);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [clip]);

  return <div className="compact-stack no-print">
    {url ? <div className="compact-stack">
      <div className="row-between"><small className="muted">{clip.title || t("referenceRecording")}</small>
        <button type="button" className="action light" aria-label={t("loopAudio", { name: label })} aria-pressed={loop} onClick={() => setLoop(value => !value)}><Repeat size={17} /></button>
      </div>
      <audio className="w-full" controls loop={loop} preload="none" src={url} aria-label={t("referenceAudioFor", { name: label })} />
      {original && <p className="small muted"><a href={original.source} rel="noreferrer">{original.speaker}</a> · <a href={original.licenseUrl} rel="noreferrer">{original.attribution.split(" · ")[1]}</a></p>}
      <button type="button" className="text-button justify-self-start" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{t("replaceAudio")}</button>
    </div> : !startExpanded && <button type="button" className="action soft" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><Headphones size={17} /> {t("addAudio")}</button>}
    {expanded && <label className="field small">{t("chooseAudioFor", { name: label })}
      <input type="file" accept="audio/*" onChange={async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("audio/") || file.size > 12_000_000) {
          toast.error(t("audioLimit")); return;
        }
        try {
          await db.audio.put({ ref: audioRef, blob: file, title: file.name });
          setExpanded(false);
        }
        catch { toast.error(t("audioSaveError")); }
      }} />
    </label>}
    {compare && <LocalRecorder label={label} />}
  </div>;
}
