import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Copy, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { SectionNav } from "@/components/Surface";
import { usePrayerLogs } from "@/hooks/use-awwab";
import { addDays, dateKey } from "@/lib/dates";
import { downloadFile } from "@/lib/download";
import { drawShare, imageFile, shareFormats, shareTemplates, shareUrl, type ShareFormat, type TemplateId } from "@/lib/share";
import type { Settings } from "@/lib/storageService";

export function Share({ settings, now }: { settings: Settings; now: Date }) {
  const [params] = useSearchParams();
  const [id, select] = useState<TemplateId>(() => shareTemplates.find(item => item.id === params.get("template"))?.id ?? "return");
  const [format, setFormat] = useState<ShareFormat>("story");
  const [light, setLight] = useState(() => shareTemplates.find(item => item.id === id).theme === "light");
  const [counts, showCounts] = useState(false);
  const [status, setStatus] = useState("");
  const [file, setFile] = useState<File>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const logs = usePrayerLogs();
  const template = shareTemplates.find(item => item.id === id);
  const date = dateKey(now, settings.city.timeZone);
  const activity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) counts.set(log.date, (counts.get(log.date) ?? 0) + 1);
    return Array.from({ length: 371 }, (_, i) => counts.get(addDays(date, i - 370)) ?? 0);
  }, [logs, date]);
  const milestone = params.get("milestone")?.slice(0, 80);
  const title = id === params.get("template") && milestone ? milestone : template.label;
  const text = id === params.get("template") && milestone ? `${milestone} with awwab.` : `${template.detail} · awwab`;
  const prayerCount = logs.length;
  useEffect(() => {
    const surface = canvas.current;
    setFile(undefined);
    setStatus("");
    let current = true;
    async function render() {
      const rendered = document.createElement("canvas");
      await drawShare(rendered, { template: id, format, light, title, showPrayerNumbers: counts, prayerCount, activity });
      if (!current || !surface) return;
      surface.width = rendered.width;
      surface.height = rendered.height;
      surface.getContext("2d").drawImage(rendered, 0, 0);
      const blob = await imageFile(rendered, id);
      if (current) setFile(blob);
    }
    void render().catch(() => { if (current) setStatus("The card could not be drawn. Try changing the format."); });
    return () => { current = false; };
  }, [activity, counts, format, id, light, prayerCount, settings.mode, title]);

  async function copy(linkOnly = false) {
    try {
      await navigator.clipboard.writeText(linkOnly ? shareUrl(id) : `${text} ${shareUrl(id)}`);
      toast(linkOnly ? "Link copied." : "Share text copied.");
    } catch {
      setStatus(shareUrl(id));
    }
  }
  async function share() {
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text, url: shareUrl(id) }); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    downloadFile(file, file.name);
    await copy();
  }
  return <div className="stack">
    <SectionNav title={milestone ? "A moment worth keeping" : "Share progress"} back="/you" />
    <div className="share-layout">
      <div className="stack">
        <div className="chips" aria-label="Card templates">{shareTemplates.map(item => <button type="button" aria-pressed={item.id === id} key={item.id}
          className={`action ${item.id === id ? "soft" : "light"}`} onClick={() => { select(item.id); setLight(item.theme === "light"); }}>{item.label}</button>)}</div>
        <div className="equal-row" aria-label="Format">{(Object.keys(shareFormats) as ShareFormat[]).map(value => <button key={value} className={`action ${format === value ? "" : "light"}`} aria-pressed={format === value} onClick={() => setFormat(value)}>{shareFormats[value].label}</button>)}</div>
        <div className="equal-row" aria-label="Background"><button className={`action ${light ? "" : "light"}`} aria-pressed={light} onClick={() => setLight(true)}>Light</button><button className={`action ${light ? "light" : ""}`} aria-pressed={!light} onClick={() => setLight(false)}>Dark</button></div>
        {id === "return" && <label className="with-icon"><input type="checkbox" checked={counts} onChange={event => showCounts(event.target.checked)} /> Show prayer numbers</label>}
        <p className="muted small">Share to encourage. The image is prepared on this device.</p>
        <div className="equal-row"><button className="action" disabled={!file} onClick={() => void share()}><Share2 size={18} /> Share…</button>
          <button className="action soft" disabled={!file} onClick={() => file && downloadFile(file, file.name)}><Download size={18} /> Save image</button></div>
        <button className="action light" onClick={() => void copy(true)}><Copy size={17} /> Copy link</button>
        {status && <p role="status">{status}</p>}
      </div>
      <canvas className="share-preview" ref={canvas} role="img" aria-label={`Awwab share card: ${title}`} />
    </div>
  </div>;
}
