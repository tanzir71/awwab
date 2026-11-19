import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

export function LocalRecorder() {
  const active = useRef<{ input: MediaStream; recorder: MediaRecorder }>();
  const mounted = useRef(true);
  const requesting = useRef(false);
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState("");
  const [message, setMessage] = useState("");

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
      setMessage("Recording is unavailable in this browser."); return;
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
      setMessage("");
    } catch {
      input?.getTracks().forEach(track => track.stop());
      setMessage("Allow microphone access to record your reading.");
    } finally {
      requesting.current = false;
    }
  }

  return <div className="compact-stack">
    <button type="button" className="action soft" onClick={() => {
      const recorder = active.current?.recorder;
      if (recorder?.state === "recording") recorder.stop();
      else void start();
    }}>{recording ? <><Square size={16} /> Stop recording</> : <><Mic size={17} /> Record &amp; compare</>}</button>
    {message && <p role="status" className="small muted">{message}</p>}
    {audio && <div className="compact-stack"><audio controls src={audio} aria-label="Your recording" /><button className="text-button" onClick={() => setAudio("")}>Clear recording</button></div>}
  </div>;
}
