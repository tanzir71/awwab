import { useEffect, useId, useRef, useState } from "react";
import { DesignIcon } from "./DesignIcon";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { updateRecord } from "@/lib/storageService";
import { downloadAskAudio, playAskAudio, reviewedAskAudio } from "@/lib/umrahAskAudio";
import type { askDefaults } from "@/lib/umrahAsk";

const packKey = "umrah-ask-audio";
const volumeKey = "umrah-ask-volume-hint";

export function AskAudioPack({ desktop = false }: { desktop?: boolean }) {
  const { t } = useCopy();
  const version = useRecord<number>(packKey, 0);
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [failed, setFailed] = useState(false);
  const working = Boolean(progress);
  const ready = version === reviewedAskAudio?.version;
  if (!reviewedAskAudio) return desktop ? <span className="chip">{t("umrahPrepAudioPending")}</span> : null;

  return <div className={desktop ? "ask-pack-desktop" : "card ask-pack compact-stack"}>
    {!desktop && <h2>{t("askHome")}</h2>}
    <p className="small muted">{t("fileSizeMB", { size: reviewedAskAudio.bytes / 1_000_000 })} · {reviewedAskAudio.attribution}</p>
    <button type="button" className="action soft" disabled={working} onClick={() => {
      if (working) return;
      setFailed(false);
      setProgress({ done: 0, total: 1 });
      void downloadAskAudio((done, total) => setProgress({ done, total })).then(() =>
        updateRecord(packKey, 0, () => reviewedAskAudio.version)).catch(() => setFailed(true)).finally(() => setProgress(undefined));
    }}>{t(working ? "umrahPrepDownloading" : ready ? "askRepairPack" : "askDownloadAudio")}</button>
    {progress && <progress value={progress.done} max={progress.total} aria-label={t("umrahPrepDownloading")} />}
    {failed && <p className="small" role="alert">{t("askAudioError")}</p>}
  </div>;
}

export function AskAudioButton({ ids, settings, label, icon = true, light = false }: { ids: string[];
  settings: typeof askDefaults; label: string; icon?: boolean; light?: boolean }) {
  const { t } = useCopy();
  const version = useRecord<number>(packKey, 0);
  const used = useRecord(volumeKey, false);
  const current = useRef<AudioContext>();
  const [status, setStatus] = useState("");
  const [playing, setPlaying] = useState(false);
  const id = useId();
  const pending = !reviewedAskAudio || version !== reviewedAskAudio.version;
  const description = status || (pending ? t(reviewedAskAudio ? "askDownloadFirst" : "askAudioPending") : "");

  useEffect(() => () => { if (current.current) void current.current.close().catch(() => {}); }, []);

  function play() {
    if (current.current) {
      void current.current.close().catch(() => {});
      current.current = undefined;
      setStatus("");
      setPlaying(false);
      return;
    }
    const context = new AudioContext();
    current.current = context;
    setPlaying(true);
    setStatus(used ? "" : t("askVolumeHint"));
    if (!used) void updateRecord(volumeKey, false, () => true).catch(() => {});
    void context.resume().then(() => playAskAudio(context, ids, settings.variety, settings.voice, settings.slow))
      .catch(() => { if (current.current === context) setStatus(t("askAudioError")); })
      .finally(() => {
        if (current.current === context) {
          current.current = undefined;
          setPlaying(false);
        }
        if (context.state !== "closed") void context.close().catch(() => {});
      });
  }

  return <div className="ask-recording">
    <button type="button" className={light ? "action light" : "action"} disabled={pending} onClick={() => { try { play(); } catch { setStatus(t("askAudioError")); } }}
      aria-describedby={description ? id : undefined}>{icon && <DesignIcon name="ask-icon-volume" size={18} />}{t(playing ? "askStop" : label)}</button>
    {description && <p id={id} className="small muted" role={status ? "status" : undefined}>{description}</p>}
  </div>;
}
