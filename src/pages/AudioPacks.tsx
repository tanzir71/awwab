import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { SectionNav } from "@/components/Surface";
import { downloadAudioPack, listAudioPacks, type AudioPack } from "@/lib/audio";
import { db } from "@/lib/storageService";
import { useCopy } from "@/lib/copy";
import { prayerGuidePath } from "@/lib/prayerGuide";
import { studyNames } from "@/lib/study-copy";

export function AudioPacks() {
  const { language, t } = useCopy();
  const [params] = useSearchParams();
  const [packs, setPacks] = useState<AudioPack[]>();
  const [active, setActive] = useState<{ id: string; done: number; total: number }>();
  const [status, setStatus] = useState<{ id: string; name?: string }>();
  const refs = useLiveQuery(() => db.audio.toCollection().primaryKeys(), [], []);
  const selected = params.get("surah");
  useEffect(() => {
    const controller = new AbortController();
    void listAudioPacks(controller.signal).then(setPacks, () => {
      if (!controller.signal.aborted) setStatus({ id: "audioUnavailable" });
    });
    return () => controller.abort();
  }, []);
  async function download(pack: AudioPack, name: string) {
    setActive({ id: pack.id, done: 0, total: pack.items.length });
    setStatus(undefined);
    try {
      await downloadAudioPack(pack, (done, total) => setActive({ id: pack.id, done, total }));
      setStatus({ id: "audioOfflineDone", name });
    } catch {
      setStatus({ id: "audioDownloadError" });
    } finally { setActive(undefined); }
  }
  const visible = packs?.slice().sort((a, b) => Number(b.id.endsWith("-" + selected)) - Number(a.id.endsWith("-" + selected)));
  return <div className="stack">
    <SectionNav title={t("offlineAudio")} back={prayerGuidePath(params.get("fromPrayer"), params.get("fromRakah")) ?? (selected ? `/learn/surahs/${selected}?mode=listen` : "/you")} />
    <p className="muted">{t("offlineAudioHint")}</p>
    {!packs && !status && <p role="status">{t("openingAudio")}</p>}
    {packs?.length === 0 && <p className="card soft">{t("audioEmpty")}</p>}
    {visible?.map(pack => {
      const available = pack.items.every(item => refs.includes(item.ref));
      const name = studyNames.surah(language, Number(pack.id.slice(pack.id.lastIndexOf("-") + 1)), pack.name);
      return <section className="card compact-stack" key={pack.id}>
        <h2>{name}</h2><p className="muted small"><span lang="en">{pack.attribution}</span> · {t("fileSizeMB", { size: pack.bytes / 1_000_000 })}</p>
        <div className="equal-row"><a className="text-button" href={pack.source}>{t("recordingSource")}</a><a className="text-button" href={pack.licenseUrl}>{t("recordingLicence")}</a></div>
        {active?.id === pack.id && <progress max={active.total} value={active.done} aria-label={t("downloadingPack", { name })} />}
        <button className="action soft" disabled={Boolean(active) || available} onClick={() => void download(pack, name)}><Download size={17} />{t(available ? "availableOffline" : "downloadAudioPack")}</button>
      </section>;
    })}
    {status && <p role="status" className="card tint">{t(status.id, { name: status.name ?? "" })}</p>}
  </div>;
}
