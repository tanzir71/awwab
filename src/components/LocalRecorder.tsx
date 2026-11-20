import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { useCopy } from "@/lib/copy";

let currentRecorder: MediaRecorder | undefined;

export function LocalRecorder({ label, compact = false, actionClass, actionLabel, icon, maxSeconds = 120, suspended = false }: {
  label?: string; compact?: boolean; actionClass?: string; actionLabel?: string; icon?: React.ReactNode; maxSeconds?: number; suspended?: boolean;
} = {}) {
  const { t } = useCopy();
  const active = useRef<{ input: MediaStream; recorder: MediaRecorder }>();
  const mounted = useRef(true);
  const requesting = useRef(false);
  const captureSuspended = useRef(suspended);
  const playback = useRef<HTMLAudioElement>(null);
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState("");
  const [message, setMessage] = useState<"recordingUnavailable" | "microphonePermission">();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const session = active.current;
      if (session?.recorder.state === "recording") session.recorder.stop();
      session?.input.getTracks().forEach(track => track.stop());
    };
  }, []);
  useEffect(() => {
    captureSuspended.current = suspended;
    if (!suspended) return;
    const session = active.current;
    if (session?.recorder.state === "recording") session.recorder.stop();
    session?.input.getTracks().forEach(track => track.stop());
    playback.current?.pause();
  }, [suspended]);
  useEffect(() => () => { if (audio) URL.revokeObjectURL(audio); }, [audio]);

  async function start() {
    if (requesting.current || captureSuspended.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("recordingUnavailable"); return;
    }
    requesting.current = true;
    let input: MediaStream | undefined;
    try {
      input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || captureSuspended.current) { input.getTracks().forEach(track => track.stop()); return; }
      const recorder = new MediaRecorder(input);
      const chunks: BlobPart[] = [];
      const timer = window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, maxSeconds * 1000);
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        window.clearTimeout(timer);
        input.getTracks().forEach(track => track.stop());
        if (currentRecorder === recorder) currentRecorder = undefined;
        active.current = undefined;
        if (!mounted.current) return;
        setRecording(false);
        if (chunks.length) setAudio(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType })));
      };
      if (currentRecorder?.state === "recording") currentRecorder.stop();
      document.querySelectorAll("audio").forEach(audio => audio.pause());
      recorder.start();
      currentRecorder = recorder;
      active.current = { input, recorder };
      setRecording(true);
      setMessage(undefined);
    } catch {
      input?.getTracks().forEach(track => track.stop());
      if (mounted.current && !captureSuspended.current) setMessage("microphonePermission");
    } finally {
      requesting.current = false;
    }
  }

  return <div className={compact ? "surah-record-control" : "compact-stack"}>
    <button type="button" className={actionClass ?? (compact ? "chip" : "action soft")} aria-label={label ? t(recording ? "stopRecordingNamed" : "recordCompareNamed", { name: label }) : undefined} onClick={() => {
      const recorder = active.current?.recorder;
      if (recorder?.state === "recording") recorder.stop();
      else void start();
    }}>{recording ? (!compact || actionClass) && <Square size={16} /> : icon ?? (!compact && !actionClass && <Mic size={17} />)} {recording ? t("stopRecording") : actionLabel ?? t(compact ? "surahRecord" : "recordCompare")}</button>
    {message && <p role="status" className="small muted">{t(message)}</p>}
    {audio && <div className="compact-stack"><audio ref={playback} controls src={audio} aria-label={label ? t("yourRecordingFor", { name: label }) : t("yourRecording")} /><button className="text-button" onClick={() => setAudio("")}>{t("clearRecording")}</button></div>}
  </div>;
}
