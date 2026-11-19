import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { DesignIcon } from "@/components/DesignIcon";
import { ShareArtwork, type ShareArtifact } from "@/components/ShareArtwork";
import { useShareCards } from "@/hooks/use-share-cards";
import { useCopy } from "@/lib/copy";
import { downloadFile } from "@/lib/download";
import { shareFormats, shareTemplates, shareUrl, type ShareFormat, type ShareModel, type TemplateId } from "@/lib/share";
import type { Settings } from "@/lib/storageService";
import { momentPath, type MomentTemplate } from "@/lib/studyMilestones";

const carousel: TemplateId[] = ["surah", "return", "qaida", "umrah", "maktab", "words"];
const shareOrigins = { return: "/return", umrah: "/umrah", today: "/today", learn: "/learn" };

function ShareSwitch({ label, hint, on, change }: { label: string; hint?: string; on: boolean; change: (value: boolean) => void }) {
  return <button className="share-switch" type="button" role="switch" aria-label={label} aria-checked={on} onClick={() => change(!on)}>
    <span className="compact-stack"><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
    {on ? <span className="share-switch-on" aria-hidden="true" /> : <DesignIcon name="share-toggle-off" size={44} height={26} className="share-switch-off" />}
  </button>;
}

export function Share({ settings, now }: { settings: Settings; now: Date }) {
  const { t } = useCopy();
  const [params] = useSearchParams();
  const original = shareTemplates.find(item => item.id === params.get("template")) ?? shareTemplates[0];
  const [id, select] = useState<TemplateId>(original.id);
  const [format, setFormat] = useState<ShareFormat>("story");
  const [light, setLight] = useState(original.theme === "light");
  const [counts, showCounts] = useState(false);
  const [artifact, setArtifact] = useState<ShareArtifact>();
  const [status, setStatus] = useState("");
  const touch = useRef<number>();
  const templates = useRef<HTMLDivElement>(null);
  const value = Number(params.get("value")) || undefined;
  const cards = useShareCards(settings, now, original.id, value);
  const model = useMemo<ShareModel>(() => ({ template: id, format, light, showPrayerNumbers: counts, card: cards[id] }),
    [id, format, light, counts, cards]);
  const ready = artifact?.model === model ? artifact.file : undefined;
  const failed = artifact?.model === model && artifact.failed;
  const index = carousel.indexOf(id);
  const prev = carousel[(index + carousel.length - 1) % carousel.length];
  const next = carousel[(index + 1) % carousel.length];
  const neighbors = useMemo(() => [prev, next].map(template => ({
    template, format, showPrayerNumbers: counts, light: shareTemplates.find(item => item.id === template).theme === "light", card: cards[template],
  })), [prev, next, format, counts, cards]);
  const moment = params.get("from") === "moment" && value && original.id !== "return" && original.id !== "umrah";
  const back = moment ? momentPath(original.id as MomentTemplate, value, params.get("study") === "salah") :
    shareOrigins[params.get("from")] ?? "/you";
  const url = shareUrl(id);
  const title = counts && id === "return" ? model.card.numbers.title : model.card.title;
  const description = [title, model.card.detail, counts && id === "return" ? model.card.numbers.label : "", model.card.citation].filter(Boolean).join(" · ");
  const text = title + " · " + model.card.detail + " · awwab";

  useLayoutEffect(() => {
    const row = templates.current;
    const selected = row?.querySelector('button[aria-pressed="true"]');
    if (!selected) return;
    const viewport = row.getBoundingClientRect();
    const pill = selected.getBoundingClientRect();
    if (pill.left < viewport.left + 4) row.scrollLeft += pill.left - viewport.left - 4;
    else if (pill.right > viewport.right - 4) row.scrollLeft += pill.right - viewport.right + 4;
  }, [id]);

  function choose(template: TemplateId) {
    select(template);
    setLight(shareTemplates.find(item => item.id === template).theme === "light");
    setStatus("");
  }
  async function copy(value: string, notice: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast(t(notice));
    } catch {
      setStatus(value);
    }
  }
  async function share() {
    if (!ready) return;
    const files = [ready];
    try {
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files, text, url });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    downloadFile(ready, ready.name);
    await copy(text + " " + url, "shareCopiedText");
  }

  return <section className="share-sheet" aria-labelledby="share-sheet-title">
    <header className="row-between">
      <h1 id="share-sheet-title">{t("shareYourProgress")}</h1>
      <Link className="icon-button share-close" aria-label={t("shareClose")} to={back}><DesignIcon name="share-close" size={22} /></Link>
    </header>
    <div className="share-stage" data-format={format}
      onTouchStart={event => { touch.current = event.touches[0].clientX; }}
      onTouchEnd={event => {
        if (touch.current === undefined) return;
        const change = event.changedTouches[0].clientX - touch.current;
        touch.current = undefined;
        if (Math.abs(change) > 36) choose(change < 0 ? next : prev);
      }}>
      <button type="button" className="share-neighbor" aria-label={t("sharePrevious")} onClick={() => choose(prev)}>
        <ShareArtwork model={neighbors[0]} />
      </button>
      <div className="share-current">
        <ShareArtwork model={model} label={t("shareCardLabel", { title: description })} onArtifact={setArtifact} />
      </div>
      <button type="button" className="share-neighbor" aria-label={t("shareNext")} onClick={() => choose(next)}>
        <ShareArtwork model={neighbors[1]} />
      </button>
    </div>
    <div className="share-dots" aria-hidden="true">{carousel.map(item => <span key={item} data-selected={id === item} />)}</div>
    <div ref={templates} className="share-template-row" role="group" aria-label={t("shareTemplates")}>{shareTemplates.map(item => <button type="button"
      className="chip" aria-pressed={id === item.id} key={item.id} onClick={() => choose(item.id)}>{t(item.label)}</button>)}</div>
    <div className="equal-row share-format-row" role="group" aria-label={t("shareFormat")}>{(Object.keys(shareFormats) as ShareFormat[]).map(value =>
      <button key={value} type="button" className="action plain" aria-pressed={format === value} onClick={() => setFormat(value)}>{t(shareFormats[value].label)}</button>)}</div>
    <div className="card share-options">
      <ShareSwitch label={t("shareNumbers")} hint={t("shareNumbersHint")} on={counts} change={showCounts} />
      <ShareSwitch label={t("shareLight")} on={light} change={setLight} />
    </div>
    <div className="equal-row share-actions"><button type="button" className="action" disabled={!ready} onClick={() => void share()}>{t("shareNow")}</button>
      <button type="button" className="action light" disabled={!ready} onClick={() => ready && downloadFile(ready, ready.name)}>{t("shareSave")}</button></div>
    <p className="share-privacy small muted">{t("sharePrivacy")}</p>
    <button className="text-button share-copy-button" type="button" onClick={() => void copy(url, "shareCopiedLink")}>{t("shareCopyLink")}</button>
    {failed && <p role="status">{t("shareDrawError")}</p>}
    {status && <p className="small muted share-copy-status" role="status">{status}</p>}
  </section>;
}
