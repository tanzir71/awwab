import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { DesignIcon } from "@/components/DesignIcon";
import { ShareArtwork, type ShareArtifact } from "@/components/ShareArtwork";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useShareCards } from "@/hooks/use-share-cards";
import { message, useCopy } from "@/lib/copy";
import { downloadFile } from "@/lib/download";
import { languages } from "@/lib/languagePreferences";
import { loadLocalePack } from "@/lib/localePacks";
import { shareFooterLink, shareFormats, shareTemplates, shareUrl, type ShareFormat, type ShareModel, type TemplateId } from "@/lib/share";
import { shareReturnPath } from "@/lib/shareNavigation";
import type { Settings } from "@/lib/storageService";

const carousel: TemplateId[] = ["surah", "return", "qaida", "umrah", "maktab", "words"];
const desktopCarousel = shareTemplates.map(template => template.id);
const sizes = ["story", "post", "wide"] as const;
const sizeLabels = { story: "shareStoryShort", post: "sharePostShort", wide: "shareWide" };

function ShareSwitch({ label, hint, on, change }: { label: string; hint?: string; on: boolean; change: (value: boolean) => void }) {
  return <button className="share-switch" type="button" role="switch" aria-label={label} aria-checked={on} onClick={() => change(!on)}>
    <span className="compact-stack"><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
    <span className="share-switch-track" aria-hidden="true" />
  </button>;
}

export function Share({ settings, now, closeDialog }: { settings: Settings; now: Date; closeDialog?: () => void }) {
  const { t, locale } = useCopy();
  const [params] = useSearchParams();
  const original = shareTemplates.find(item => item.id === params.get("template")) ?? shareTemplates[0];
  const [id, select] = useState<TemplateId>(original.id);
  const [format, setFormat] = useState<ShareFormat>("story");
  const [light, setLight] = useState(original.theme === "light");
  const [counts, showCounts] = useState(false);
  const [sameLanguage, setSameLanguage] = useState(true);
  const [artifact, setArtifact] = useState<ShareArtifact>();
  const [status, setStatus] = useState("");
  const touch = useRef<number>();
  const templates = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement>();
  const dialogTitle = useRef<HTMLHeadingElement>(null);
  const value = Number(params.get("value")) || undefined;
  const alternateLanguage = settings.language === "en" ? "bn" : "en";
  const imageLanguage = sameLanguage ? settings.language : alternateLanguage;
  const cards = useShareCards(settings, now, original.id, value, imageLanguage);
  const model = useMemo<ShareModel>(() => ({ template: id, language: imageLanguage, format, light, showPrayerNumbers: counts, card: cards[id] }),
    [id, imageLanguage, format, light, counts, cards]);
  const ready = artifact?.model === model ? artifact.file : undefined;
  const failed = artifact?.model === model && artifact.failed;
  const order = closeDialog ? desktopCarousel : carousel;
  const index = order.indexOf(id);
  const prev = order[(index + order.length - 1) % order.length];
  const next = order[(index + 1) % order.length];
  const neighbors = useMemo(() => [prev, next].map(template => ({
    template, language: imageLanguage, format, showPrayerNumbers: counts, light: shareTemplates.find(item => item.id === template).theme === "light", card: cards[template],
  })), [prev, next, imageLanguage, format, counts, cards]);
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
  async function chooseImageLanguage(same: boolean) {
    if (!same) await loadLocalePack(alternateLanguage).catch(() => false);
    setSameLanguage(same);
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

  const preview = <ShareArtwork model={model}
    label={message({ mode: settings.mode, language: imageLanguage }, "shareCardLabel", { title: description })} onArtifact={setArtifact} />;
  const switches = <>
    <ShareSwitch label={t("shareNumbers")} hint={t("shareNumbersHint")} on={counts} change={showCounts} />
    <ShareSwitch label={t("shareLight")} on={light} change={setLight} />
  </>;
  const save = <button type="button" className="action light" disabled={!ready} onClick={() => ready && downloadFile(ready, ready.name)}>{t("shareSave")}</button>;
  const shareNow = <button type="button" className="action" disabled={!ready} onClick={() => void share()}>{t("shareNow")}</button>;
  const feedback = <>
    {failed && <p role="status">{t("shareDrawError")}</p>}
    {status && <p className="small muted share-copy-status" role="status">{status}</p>}
  </>;

  if (closeDialog) {
    const number = new Intl.NumberFormat(locale, { useGrouping: false });
    const nativeLanguage = languages.find(item => item.code === imageLanguage).native;
    const desktopTemplates = settings.mode === "maktab" || id === "maktab"
      ? shareTemplates : shareTemplates.filter(item => item.id !== "maktab");

    return <Dialog open onOpenChange={open => { if (!open) closeDialog(); }}>
      <DialogContent className="awwab-dialog share-desktop-dialog" overlayClassName="share-desktop-overlay" showCloseButton={false}
        onOpenAutoFocus={event => {
          event.preventDefault();
          if (document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
          dialogTitle.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          const target = opener.current?.isConnected && opener.current !== document.body ? opener.current : document.getElementById("app-main");
          target?.focus({ preventScroll: true });
        }}>
        <section className="share-desktop-gallery" aria-label={t("sharePreview")} onKeyDown={event => {
          const rtl = document.documentElement.dir === "rtl";
          const target = event.key === "ArrowLeft" ? rtl ? next : prev : event.key === "ArrowRight" ? rtl ? prev : next
            : event.key === "Home" ? order[0] : event.key === "End" ? order.at(-1) : undefined;
          if (!target) return;
          event.preventDefault();
          choose(target);
        }}>
          <div className="share-desktop-preview">{preview}</div>
          <div className="share-dots" role="group" aria-label={t("shareTemplates")}>
            {shareTemplates.map(item => <button type="button" key={item.id} aria-label={t(item.id === "words" ? "shareQuranWords" : item.label)}
              aria-pressed={id === item.id} onClick={() => choose(item.id)} />)}
          </div>
        </section>
        <div className="share-desktop-controls">
          <header className="row-between share-desktop-header">
            <DialogTitle ref={dialogTitle} tabIndex={-1}>{t("shareYourProgress")}</DialogTitle>
            <DialogClose asChild><button className="icon-button share-close" type="button" aria-label={t("shareClose")}><DesignIcon name="share-close" size={22} /></button></DialogClose>
          </header>
          <div className="share-desktop-controls-group">
            <p className="caption" id="share-desktop-template">{t("shareTemplateHeading")}</p>
            <div className="chips share-desktop-templates" role="group" aria-labelledby="share-desktop-template">
              {desktopTemplates.map(item => <button type="button" className="chip" key={item.id}
                aria-pressed={id === item.id} onClick={() => choose(item.id)}>{t(item.id === "words" ? "shareQuranWords" : item.label)}</button>)}
            </div>
          </div>
          <div className="share-desktop-controls-group">
            <p className="caption" id="share-desktop-size">{t("shareSizeHeading")}</p>
            <div className="equal-row share-format-row" role="group" aria-labelledby="share-desktop-size">
              {sizes.map(size => <button key={size} type="button" className="action plain" aria-pressed={format === size} onClick={() => setFormat(size)}>
                {t(sizeLabels[size])}<small>{number.format(shareFormats[size].width)}×{number.format(shareFormats[size].height)}</small>
              </button>)}
            </div>
          </div>
          <div className="card share-options">
            {switches}
            <ShareSwitch label={t("shareImageLanguage")} hint={sameLanguage ? t("shareImageSameLanguage", { language: nativeLanguage }) : nativeLanguage}
              on={sameLanguage} change={next => void chooseImageLanguage(next)} />
          </div>
          <div className="equal-row share-actions">
            {save}
            <button type="button" className="action light" onClick={() => void copy(url, "shareCopiedLink")}>{t("shareCopyLink")}</button>
            {shareNow}
          </div>
          <DialogDescription className="share-desktop-privacy small muted">{t("shareDesktopPrivacy", { link: shareFooterLink })}</DialogDescription>
          {feedback}
        </div>
      </DialogContent>
    </Dialog>;
  }

  return <section className="share-sheet" aria-labelledby="share-sheet-title">
    <header className="row-between">
      <h1 id="share-sheet-title">{t("shareYourProgress")}</h1>
      <Link className="icon-button share-close" aria-label={t("shareClose")} to={shareReturnPath(params)}><DesignIcon name="share-close" size={22} /></Link>
    </header>
    <div className="share-stage" data-format={format}
      onTouchStart={event => { touch.current = event.touches[0].clientX; }}
      onTouchEnd={event => {
        if (touch.current === undefined) return;
        const change = event.changedTouches[0].clientX - touch.current;
        touch.current = undefined;
        if (Math.abs(change) > 36) choose((change < 0) !== (document.documentElement.dir === "rtl") ? next : prev);
      }}>
      <button type="button" className="share-neighbor" aria-label={t("sharePrevious")} onClick={() => choose(prev)}>
        <ShareArtwork model={neighbors[0]} />
      </button>
      <div className="share-current">{preview}</div>
      <button type="button" className="share-neighbor" aria-label={t("shareNext")} onClick={() => choose(next)}>
        <ShareArtwork model={neighbors[1]} />
      </button>
    </div>
    <div className="share-dots" aria-hidden="true">{carousel.map(item => <span key={item} data-selected={id === item} />)}</div>
    <div ref={templates} className="share-template-row" role="group" aria-label={t("shareTemplates")}>{shareTemplates.map(item => <button type="button"
      className="chip" aria-pressed={id === item.id} key={item.id} onClick={() => choose(item.id)}>{t(item.label)}</button>)}</div>
    <div className="equal-row share-format-row" role="group" aria-label={t("shareFormat")}>{sizes.map(value =>
      <button key={value} type="button" className="action plain" aria-pressed={format === value} onClick={() => setFormat(value)}>{t(shareFormats[value].label)}</button>)}</div>
    <div className="card share-options">{switches}</div>
    <div className="equal-row share-actions">{shareNow}{save}</div>
    <p className="share-privacy small muted">{t("sharePrivacy")}</p>
    <button className="text-button share-copy-button" type="button" onClick={() => void copy(url, "shareCopiedLink")}>{t("shareCopyLink")}</button>
    {feedback}
  </section>;
}
