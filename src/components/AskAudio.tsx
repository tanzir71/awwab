import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { DesignIcon } from "./DesignIcon";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { hasSharedSpeakAudio } from "@/lib/speakAskAudio";
import { updateRecord } from "@/lib/storageService";
import { askAudioKey, askAudioPack, askPlaybackVoice, askVoiceInstalled, downloadAskAudio, packVoices, playAskAudio } from "@/lib/umrahAskAudio";
import type { askDefaults, AskVoice } from "@/lib/umrahAsk";

const volumeKey = "umrah-ask-volume-hint";

export function AskAudioPack({ desktop = false }: { desktop?: boolean }) {
  const { t } = useCopy();
  const version = useRecord<number>(askAudioKey, 0);
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [failed, setFailed] = useState(false);
  const working = Boolean(progress);
  const ready = version === askAudioPack?.version;
  if (!askAudioPack) return desktop ? <span className="chip">{t("umrahPrepAudioPending")}</span> : null;
  const upgrading = version === 1 && askAudioPack.version === 2;
  const bytes = upgrading ? askAudioPack.credits?.male?.bytes ?? askAudioPack.bytes : askAudioPack.bytes;

  return <div className={desktop ? "ask-pack-desktop" : "card ask-pack compact-stack"}>
    {!desktop && <h2>{t("askHome")}</h2>}
    <p className="small muted">{t("fileSizeMB", { size: bytes / 1_000_000 })}
      {askAudioPack.generated && <> · {t("askGeneratedSpeech")}</>}
      {askAudioPack.credits ? packVoices.map(voice => {
        const credit = askAudioPack.credits[voice];
        return credit && <span key={voice}> · <a href={credit.source} rel="noreferrer">{credit.name}</a></span>;
      }) : askAudioPack.source && <> · <a href={askAudioPack.source} rel="noreferrer">{askAudioPack.attribution}</a></>}
    </p>
    <button type="button" className="action soft" disabled={working} onClick={() => {
      if (working) return;
      setFailed(false);
      setProgress({ done: 0, total: 1 });
      void downloadAskAudio((done, total) => setProgress({ done, total })).then(() =>
        updateRecord(askAudioKey, 0, () => askAudioPack.version)).catch(() => setFailed(true)).finally(() => setProgress(undefined));
    }}>{t(working ? "umrahPrepDownloading" : ready ? "askRepairPack" : upgrading ? "askDownloadSecondVoice" : "askDownloadAudio")}</button>
    {progress && <progress value={progress.done} max={progress.total} aria-label={t("umrahPrepDownloading")} />}
    {failed && <p className="small" role="alert">{t("askAudioError")}</p>}
  </div>;
}

export function AskVoicePicker({ preferred, change }: { preferred: AskVoice; change: (voice: AskVoice) => void }) {
  const { t } = useCopy();
  const version = useRecord<number>(askAudioKey, 0);
  return <label className="field">{t("askVoice")}
    <select value={askPlaybackVoice(version, preferred)} onChange={event => change(event.currentTarget.value as AskVoice)}>
      {packVoices.map(voice => <option key={voice} value={voice} disabled={voice === "male" && !askVoiceInstalled(version, voice)}>
        {t(voice === "male" ? "askMale" : "askFemale")}
      </option>)}
    </select>
  </label>;
}

export function AskAudioButton({ ids, settings, label, icon = true, light = false }: { ids: string[];
  settings: typeof askDefaults; label: string; icon?: boolean; light?: boolean }) {
  const { t } = useCopy();
  const version = useRecord<number>(askAudioKey, 0);
  const used = useRecord(volumeKey, false);
  const current = useRef<AudioContext>();
  const [status, setStatus] = useState("");
  const [playing, setPlaying] = useState(false);
  const id = useId();
  const clips = ids.join("/");
  const voice = askPlaybackVoice(version, settings.voice);
  const shared = hasSharedSpeakAudio(ids, settings.variety, voice);
  const pending = !shared && !askVoiceInstalled(version, voice);
  const description = status || (pending ? t(askAudioPack ? "askDownloadFirst" : "askAudioPending") : askAudioPack?.generated ? t("askGeneratedSpeech") : "");

  const stop = useCallback(() => {
    const context = current.current;
    current.current = undefined;
    if (context && context.state !== "closed") void context.close().catch(() => {});
  }, []);

  useLayoutEffect(() => {
    setStatus("");
    setPlaying(false);
    return stop;
  }, [clips, settings.variety, settings.slow, voice, stop]);

  function play() {
    if (current.current) {
      stop();
      setStatus("");
      setPlaying(false);
      return;
    }
    const context = new AudioContext();
    current.current = context;
    setPlaying(true);
    setStatus(used ? "" : t("askVolumeHint"));
    if (!used) void updateRecord(volumeKey, false, () => true).catch(() => {});
    void context.resume().then(() => {
      if (current.current === context) return playAskAudio(context, ids, settings.variety, voice, settings.slow);
    })
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
      aria-describedby={description ? id : undefined}>{icon && <DesignIcon name="ask-icon-volume" size={18} />}{playing ? t("askStop") : label}</button>
    {description && <p id={id} className="small muted" role={status ? "status" : undefined}>{description}</p>}
  </div>;
}
