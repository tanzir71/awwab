import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { useCopy } from "@/lib/copy";

export function LocalRecorder({ label }: { label?: string } = {}) {
  const { t } = useCopy();
  const active = useRef<{ input: MediaStream; recorder: MediaRecorder }>();
  const mounted = useRef(true);
  const requesting = useRef(false);
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
  useEffect(() => () => { if (audio) URL.revokeObjectURL(audio); }, [audio]);

  async function start() {
    if (requesting.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("recordingUnavailable"); return;
    }
    requesting.current = true;
    let input: MediaStream | undefined;
    try {
      input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { input.getTracks().forEach(track => track.stop()); return; }
      const recorder = new MediaRecorder(input);
      const chunks: BlobPart[] = [];
      const timer = window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 120_000);
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        window.clearTimeout(timer);
        input.getTracks().forEach(track => track.stop());
        active.current = undefined;
        if (!mounted.current) return;
        setRecording(false);
        if (chunks.length) setAudio(URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType })));
      };
      recorder.start();
      active.current = { input, recorder };
      setRecording(true);
      setMessage(undefined);
    } catch {
      input?.getTracks().forEach(track => track.stop());
      if (mounted.current) setMessage("microphonePermission");
    } finally {
      requesting.current = false;
    }
  }

  return <div className="compact-stack">
    <button type="button" className="action soft" aria-label={label ? t(recording ? "stopRecordingNamed" : "recordCompareNamed", { name: label }) : undefined} onClick={() => {
      const recorder = active.current?.recorder;
      if (recorder?.state === "recording") recorder.stop();
      else void start();
    }}>{recording ? <Square size={16} /> : <Mic size={17} />} {t(recording ? "stopRecording" : "recordCompare")}</button>
    {message && <p role="status" className="small muted">{t(message)}</p>}
    {audio && <div className="compact-stack"><audio controls src={audio} aria-label={label ? t("yourRecordingFor", { name: label }) : t("yourRecording")} /><button className="text-button" onClick={() => setAudio("")}>{t("clearRecording")}</button></div>}
  </div>;
}
