import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { SectionNav } from "@/components/Surface";
import { downloadAudioPack, listAudioPacks, type AudioPack } from "@/lib/audio";
import { db } from "@/lib/storageService";

export function AudioPacks() {
  const [params] = useSearchParams();
  const [packs, setPacks] = useState<AudioPack[]>();
  const [active, setActive] = useState<{ id: string; done: number; total: number }>();
  const [status, setStatus] = useState("");
  const refs = useLiveQuery(() => db.audio.toCollection().primaryKeys(), [], []);
  const selected = params.get("surah");
  useEffect(() => {
    const controller = new AbortController();
    void listAudioPacks(controller.signal).then(setPacks, () => {
      if (!controller.signal.aborted) setStatus("The audio catalogue is unavailable right now.");
    });
    return () => controller.abort();
  }, []);
  async function download(pack: AudioPack) {
    setActive({ id: pack.id, done: 0, total: pack.items.length });
    setStatus("");
    try {
      await downloadAudioPack(pack, (done, total) => setActive({ id: pack.id, done, total }));
      setStatus(`${pack.name} is available offline.`);
    } catch {
      setStatus("This recording could not be saved. Check your connection or device storage and try again.");
    } finally { setActive(undefined); }
  }
  const visible = packs?.slice().sort((a, b) => Number(b.id.endsWith("-" + selected)) - Number(a.id.endsWith("-" + selected)));
  return <div className="stack">
    <SectionNav title="Offline audio packs" back={selected ? `/learn/surahs/${selected}` : "/you"} />
    <p className="muted">Save a whole surah and its individual āyāt on this device. Open the surah in Listen mode to play or loop them.</p>
    {!packs && !status && <p role="status">Opening the audio catalogue…</p>}
    {packs?.length === 0 && <p className="card soft">You can add a reference recording from a file in the study view.</p>}
    {visible?.map(pack => {
      const available = pack.items.every(item => refs.includes(item.ref));
      return <section className="card compact-stack" key={pack.id}>
        <h2>{pack.name}</h2><p className="muted small">{pack.attribution} · {(pack.bytes / 1_000_000).toFixed(1)} MB</p>
        <div className="equal-row"><a className="text-button" href={pack.source}>Recording source</a><a className="text-button" href={pack.licenseUrl}>Recording licence</a></div>
        {active?.id === pack.id && <progress max={active.total} value={active.done} aria-label={`Downloading ${pack.name}`} />}
        <button className="action soft" disabled={Boolean(active) || available} onClick={() => void download(pack)}><Download size={17} />{available ? "Available offline" : "Download audio pack"}</button>
      </section>;
    })}
    {status && <p role="status" className="card tint">{status}</p>}
  </div>;
}
