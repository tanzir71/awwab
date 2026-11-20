import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArabicText } from "./ArabicText";
import { AskAudioButton, AskAudioPack, AskVoicePicker } from "./AskAudio";
import { DesignIcon } from "./DesignIcon";
import { UmrahTripForm, UmrahTripImport } from "./UmrahTripForm";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { downloadFile } from "@/lib/download";
import { speakSetupPath } from "@/lib/speakCurriculum";
import { exportUmrahTrip, updateRecord } from "@/lib/storageService";
import { emptyPreparation, initialTrip, maskedPhone, tripChecklist, tripDates, type TripCheck, type UmrahTrip } from "@/lib/umrah";
import { cachedMapPack, mapPacks, mapRegions, saveMapPack, type MapRegion } from "@/lib/umrahMapPack";
import { askDefaults, askHomePath, askPhrasePath, renderAsk } from "@/lib/umrahAsk";
import { askClipIds } from "@/lib/umrahAskAudio";
import { banglaPhrases } from "@/lib/umrah-ask-copy";
import phraseData from "../../handovers/H2-languages-paths-arabic-help/data/umrah-phrases.json";

const { phrases } = phraseData;
const samples = ["toilet", "gate-number", "take-me-hotel"].map(id => phrases.find(item => item.id === id));
const checklistColumns = [tripChecklist.slice(0, 6), tripChecklist.slice(6)];
const mapMegabytes = Object.values(mapPacks).reduce((sum, size) => sum + size, 0) / 1_000_000;
type Variety = "saudi" | "msa";
type Phrase = typeof phrases[number];

function PhraseText({ phrase, variety = "saudi", gate = 79, link = false }: { phrase: Phrase; variety?: Variety; gate?: number; link?: boolean }) {
  const words = renderAsk(phrase, variety, { gate });
  const meaning = link && phrase.id === "gate-number" ? `Where is gate ${gate}?` : words.en;
  const start = link ? <Link to={askPhrasePath(phrase.id, true)} className="umrah-phrase-link" lang="en">{meaning}</Link> : <strong lang="en">{meaning}</strong>;
  return <div className="umrah-phrase-row" id={link ? undefined : phrase.id}>
    {link && <DesignIcon name="umrah-prep-volume" size={16} />}
    <div>{start}<small lang="en">{words.tr}</small></div>
    <ArabicText text={words.ar} showGlosses={false} preserveSeparators />
  </div>;
}

function PhraseLibrary() {
  const { t } = useCopy();
  const { hash } = useLocation();
  const [query, search] = useState("");
  const [variety, setVariety] = useState<Variety>("saudi");
  const [gate, setGate] = useState("79");
  const [active, setActive] = useState(hash.slice(1));
  const [voiceError, setVoiceError] = useState(false);
  const audioSettings = useRecord("umrah-ask-settings", askDefaults);
  const requestedGate = Math.max(1, Math.min(300, Math.floor(Number(gate)) || 79));
  const needle = query.trim().toLowerCase();
  const results = phrases.filter(phrase => [phrase.en, phrase[variety].ar, phrase[variety].tr, banglaPhrases[phrase.id]].some(value => value?.toLowerCase().includes(needle)));
  useEffect(() => {
    const phrase = hash.slice(1);
    setActive(phrase);
    if (phrase) document.getElementById(phrase)?.scrollIntoView({ block: "center" });
  }, [hash]);

  return <section className="card compact-stack umrah-phrase-library">
    <header className="row-between"><h2>{t("umrahPrepPhrases")}</h2><Link className="text-button" to="/umrah">{t("back")}</Link></header>
    <p className="small muted">{t("umrahPrepPhraseReview")}</p>
    <Link className="text-button speak-ask-link" to={speakSetupPath("umrah-hajj")}>{t("speakPractiseForUmrah")}</Link>
    <div className="form-grid">
      <label className="field">{t("search")}<input type="search" value={query} onChange={event => search(event.currentTarget.value)} /></label>
      <label className="field">{t("umrahPrepVariety")}<select aria-label={t("umrahPrepVariety")} value={variety} onChange={event => setVariety(event.currentTarget.value as Variety)}>
        <option value="saudi">{t("umrahPrepSaudi")}</option><option value="msa">{t("umrahPrepFormal")}</option>
      </select></label>
      <label className="field">{t("umrahPrepGateNumber")}<input type="number" min="1" max="300" value={gate}
        onChange={event => setGate(event.currentTarget.value)} onBlur={() => setGate(String(requestedGate))} /></label>
      <AskVoicePicker preferred={audioSettings.voice} change={voice => {
        setVoiceError(false);
        void updateRecord("umrah-ask-settings", askDefaults, previous => ({ ...previous, voice })).catch(() => setVoiceError(true));
      }} />
    </div>
    {voiceError && <p className="small" role="alert">{t("askSaveIssue")}</p>}
    {!results.length && <p role="status" className="muted">{t("umrahPrepNoPhrases")}</p>}
    <AskAudioPack desktop />
    <ul className="umrah-phrase-results">{results.map(phrase => <li key={phrase.id} className="compact-stack">
      <PhraseText phrase={phrase} variety={variety} gate={requestedGate} />
      {active === phrase.id ? <AskAudioButton key={`${phrase.id}:${variety}:${requestedGate}:${audioSettings.voice}`} ids={askClipIds(phrase, { variety, gate: requestedGate })}
        settings={{ ...askDefaults, variety, voice: audioSettings.voice }} label="askPlay" light /> : <button type="button" className="text-button" onClick={() => setActive(phrase.id)}>{t("practise")}</button>}
    </li>)}</ul>
  </section>;
}

function OfflinePacks() {
  const { t } = useCopy();
  const [saved, setSaved] = useState<MapRegion[]>();
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const ready = saved?.length === mapRegions.length;
  const size = t("fileSizeMB", { size: mapMegabytes });

  useEffect(() => {
    let active = true;
    void Promise.allSettled(mapRegions.map(cachedMapPack)).then(results => {
      if (active) setSaved(mapRegions.filter((_, index) => results[index].status === "fulfilled" && Boolean(results[index].value)));
    });
    return () => { active = false; };
  }, []);

  async function download() {
    if (!saved || working || ready) return;
    setWorking(true);
    setFailed(false);
    const missing = mapRegions.filter(region => !saved.includes(region));
    const results = await Promise.allSettled(missing.map(region => saveMapPack(region)));
    setSaved(existing => [...new Set([...(existing ?? []), ...missing.filter((_, index) => results[index].status === "fulfilled")])]);
    setFailed(results.some(result => result.status === "rejected"));
    setWorking(false);
  }

  return <section className="card compact-stack">
    <header className="row-between"><h2>{t("umrahPrepPacks")}</h2>
      {!ready && <button type="button" className="text-button" disabled={working || !saved} onClick={() => void download()}>{t("umrahPrepDownloadMaps", { size })}</button>}
    </header>
    <div className="umrah-prep-pack-row">
      <div><strong>{t("umrahPrepMap")}</strong><small>{t("umrahPrepMapHint")}</small></div>
      <small>{size}</small>
      {ready ? <span className="chip soft">{t("umrahPrepDownloaded")}</span> : <button type="button" className="chip umrah-prep-download"
        disabled={working || !saved} onClick={() => void download()}>{t(working ? "umrahPrepDownloading" : "umrahPrepDownload")}</button>}
    </div>
    <div className="umrah-prep-pack-row"><div><strong>{t("umrahPrepRitualPack")}</strong><small>{t("umrahPrepRitualHint")}</small></div>
      <span className="chip">{t("umrahPrepAudioPending")}</span></div>
    <div className="umrah-prep-pack-row"><div><strong>{t("umrahPrepAskPack")}</strong><small>{t("umrahPrepAskPackHint", { count: phrases.length })}</small></div>
      <AskAudioPack desktop /></div>
    {failed && <p role="status" className="small">{t("umrahPrepDownloadError")}</p>}
  </section>;
}

export function UmrahPreparation({ trip, gates }: { trip: UmrahTrip; gates: string[] }) {
  const { t, locale } = useCopy();
  const [params] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const prep = trip.preparation ?? emptyPreparation;
  const dates = tripDates(trip, locale);
  const nights = prep.makkahNights !== undefined && prep.madinahNights !== undefined
    ? t("umrahPrepBothNights", { makkah: prep.makkahNights, madinah: prep.madinahNights }) : [
    prep.makkahNights !== undefined && t("umrahPrepNights", { city: t("umrahPrepMakkah"), count: prep.makkahNights }),
    prep.madinahNights !== undefined && t("umrahPrepNights", { city: t("umrahPrepMadinah"), count: prep.madinahNights }),
    ].filter(Boolean).join(" · ");

  async function check(item: TripCheck, checked: boolean) {
    setError("");
    try {
      await updateRecord("umrah", initialTrip, old => {
        const previous = old.preparation ?? emptyPreparation;
        const completed = checked ? [...new Set([...previous.completed, item])] : previous.completed.filter(key => key !== item);
        return { ...old, preparation: { ...previous, completed } };
      });
    } catch {
      setError(t("umrahTripSaveError"));
    }
  }

  if (params.get("view") === "phrases") return <PhraseLibrary />;
  return <div className="umrah-prep-region"><div className="umrah-prep">
    <div className="compact-stack umrah-prep-column">
      <section className="card compact-stack">
        <header className="row-between"><h2>{t("umrahPrepTrip")}</h2>
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogTrigger asChild><button type="button" className="text-button">{t("umrahPrepEdit")}</button></DialogTrigger>
            <DialogContent className="awwab-dialog umrah-prep-edit" showCloseButton={false} aria-describedby={undefined}>
              <header className="row-between"><DialogTitle>{t("umrahPrepTrip")}</DialogTitle>
                <DialogClose asChild><button type="button" className="icon-button" aria-label={t("shareClose")}><DesignIcon name="share-close" size={22} /></button></DialogClose>
              </header>
              <UmrahTripForm trip={trip} gates={gates} onSaved={() => setEditing(false)} />
              <UmrahTripImport onImported={() => setEditing(false)} />
            </DialogContent>
          </Dialog>
        </header>
        <div className="equal-row umrah-prep-details">
          <div><p className="caption">{t("umrahPrepDates")}</p><strong>{dates ?? t("umrahPrepNoDates")}</strong>{nights && <small>{nights}</small>}</div>
          <div><p className="caption">{t("umrahPrepHotel")}</p><strong>{trip.hotel.name || t("umrahPrepNoHotel")}</strong>
            <small>{t(prep.hotelArabic ? "umrahPrepHotelSaved" : "umrahPrepHotelMissing")}</small></div>
          <div><p className="caption">{t("umrahPrepLeader")}</p><strong>{prep.leader || trip.group || t("umrahPrepNoLeader")}
            {prep.phone && <bdi className="umrah-prep-phone"> · {maskedPhone(prep.phone)}</bdi>}</strong><small>{t("umrahPrepLeaderHint")}</small></div>
        </div>
      </section>
      <OfflinePacks />
      <section className="card compact-stack"><header className="row-between"><h2>{t("umrahPrepChecklist")}</h2>
        <small>{t("umrahPrepChecklistCount", { count: prep.completed.length, total: tripChecklist.length })}</small></header>
        <div className="equal-row umrah-prep-checks">{checklistColumns.map(items => <div key={items[0]}>
          {items.map(item => <label key={item}><input type="checkbox" checked={prep.completed.includes(item)}
            onChange={event => void check(item, event.currentTarget.checked)} />{t("umrahCheck" + item[0].toUpperCase() + item.slice(1))}</label>)}
        </div>)}</div>
        {error && <p role="status" className="small">{error}</p>}
      </section>
    </div>
    <div className="compact-stack umrah-prep-column">
      <section className="card compact-stack"><header className="row-between"><h2>{t("umrahPrepPractise")}</h2>
        <Link className="text-button" to={askHomePath(true)}>{t("umrahPrepPhrases")}</Link></header>
        {samples.map(phrase => <PhraseText key={phrase.id} phrase={phrase} link />)}
      </section>
      <section className="card night compact-stack"><h2>{t("umrahPrepTake")}</h2><p className="small muted">{t("umrahPrepTakeHint")}</p>
        <div className="equal-row">
          <button type="button" className="action light" onClick={() => downloadFile(new Blob([exportUmrahTrip(trip)], { type: "application/json" }), "awwab-umrah-trip.json")}>{t("umrahPrepExport")}</button>
          <Link className="action umrah-prep-print" to="/print/umrah-guide">{t("umrahPrepPrint")}</Link>
        </div>
      </section>
    </div>
  </div></div>;
}
