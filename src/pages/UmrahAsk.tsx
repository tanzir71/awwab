import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { AskAudioButton, AskAudioPack, AskVoicePicker } from "@/components/AskAudio";
import { DesignIcon } from "@/components/DesignIcon";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { dateKey, formatTime } from "@/lib/dates";
import { dayDifference } from "@/lib/hijri";
import { speakSetupPath } from "@/lib/speakCurriculum";
import { updateRecord } from "@/lib/storageService";
import { emptyPreparation, initialTrip, makkah, maskedPhone, type TripState, type UmrahTrip } from "@/lib/umrah";
import { answerWords, arabicNumber, askCategories, askDefaults, askMeaning, askPhrase, askPhraseMatches, askPhrasePath as phraseLink, askPlaces, askRelations, askVarieties, askVoices, helperDirections,
  quickAsks, readGate, renderAsk, umrahPhrases, type AskPhrase, type AskVariety, type AskVoice, type CustomPhrase } from "@/lib/umrahAsk";
import { askSignKey } from "@/lib/umrah-phrase-messages.mjs";
import { askClipIds } from "@/lib/umrahAskAudio";

const home = "/umrah/ask";
const cards = `${home}/cards`;
const showLink = (id: string) => `${home}/show/${id}`;
const categoryKey = (category: string) => "askCategory" + category[0].toUpperCase() + category.slice(1);
const icons = ["icon-compass", "icon-list", "icon-footprints", "icon-droplet", "icon-heart", "icon-home", "icon-coins", "icon-hand1"];
const quickLabels: Record<string, string> = { toilet: "askToilet", wudu: "askWudu", zamzam: "askZamzam", "women-prayer": "askWomen", "gate-number": "umrahPrepGateNumber", lost: "askLost" };
const contextLabel: Partial<Record<TripState, string>> = { "At the hotel": "askHotelQuick", "In the Haram": "askHaram", "Doing Umrah": "askHaram", Walking: "askWalking", "Eating out": "askFoodQuick" };
const replyKey: Record<string, string> = { right: "askRight", left: "askLeft", "straight on": "askStraight", upstairs: "askUp", downstairs: "askDown", near: "askNear", far: "askFar", behind: "askBehind" };
const noCustom: CustomPhrase[] = [];
const toiletGloss = { saudi: [{ gloss: "askGlossWhere", transliteration: "fēn" }, { gloss: "askGlossToilet", transliteration: "al-ḥammām" }],
  msa: [{ gloss: "askGlossWhere", transliteration: "ayna" }, { gloss: "askGlossRoom", transliteration: "dawratu" }, { gloss: "askGlossWater", transliteration: "al-miyāh" }] };

function useAsk() {
  const settings = useRecord("umrah-ask-settings", askDefaults);
  const { t } = useCopy();
  const [error, setError] = useState("");
  function change(patch: Partial<typeof askDefaults>) {
    setError("");
    void updateRecord("umrah-ask-settings", askDefaults, previous => ({ ...previous, ...patch })).catch(() => setError(t("askSaveIssue")));
  }
  return { settings, change, error };
}

function usePhrase(id: string) {
  const list = useRecord("umrah-custom-phrases", noCustom);
  const [params, setParams] = useSearchParams();
  const { t } = useCopy();
  const { settings, change, error } = useAsk();
  const phrase = askPhrase(id);
  const custom = list.find(item => item.id === id);
  const gate = readGate(params.get("gate")) ?? 79;
  const place = params.get("place");
  const placeKey = Object.prototype.hasOwnProperty.call(askPlaces, place) ? place as keyof typeof askPlaces : "madinah";
  const relation = params.get("relation");
  const relationKey = Object.prototype.hasOwnProperty.call(askRelations, relation) ? relation as keyof typeof askRelations : "mother";
  const toFemale = params.get("to") === "woman";
  const variants = { gate, place: placeKey, relation: relationKey, speaker: settings.speaker, toFemale, variety: settings.variety };
  const text = phrase ? renderAsk(phrase, settings.variety, variants) : undefined;
  const clips = phrase ? askClipIds(phrase, variants) : [];
  const meaning = phrase && askMeaning(phrase, t, variants);
  function updateSlot(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : "";
  return { settings, change, error, phrase, custom, text, clips, meaning, gate, placeKey, relationKey, toFemale, updateSlot, suffix };
}

function PhraseArabic({ text, words }: { text: string; words?: typeof toiletGloss.saudi }) {
  return <ArabicText text={text} words={words} showGlosses={Boolean(words)} preserveSeparators={!words} />;
}

function Back({ to, children, caps = false }: { to: string; children: ReactNode; caps?: boolean }) {
  return <Link className={`ask-back${caps ? " ask-back-title" : ""}`} to={to}>
    <DesignIcon name="ask-icon-chev-l" size={24} />{children}
  </Link>;
}

function VarietyPicker({ variety, change, homePicker = false }: { variety: AskVariety; change: (value: AskVariety) => void; homePicker?: boolean }) {
  const { t } = useCopy();
  const name = (item: AskVariety) => t(item === "saudi" ? "askSaudi" : "askFormal");
  if (homePicker) return <label className="ask-variety-menu"><span className="sr-only">{t("umrahPrepVariety")}</span>
    <select aria-label={t("umrahPrepVariety")} value={variety} onChange={event => change(event.currentTarget.value as AskVariety)}>
      {askVarieties.map(item => <option key={item} value={item}>{name(item)}</option>)}
    </select><span aria-hidden="true">▾</span>
  </label>;
  return <div className="equal-row ask-variety" role="group" aria-label={t("umrahPrepVariety")}>
    {askVarieties.map(item => <button type="button" key={item} aria-pressed={variety === item} onClick={() => change(item)}>{name(item)}</button>)}
  </div>;
}

function CustomPhraseForm() {
  const { t } = useCopy();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return <Dialog open={open} onOpenChange={value => { if (!saving) { setOpen(value); setError(""); } }}>
    <DialogTrigger asChild><button type="button" className="text-button">{t("askAdd")}</button></DialogTrigger>
    <DialogContent className="awwab-dialog" aria-describedby={undefined}>
      <DialogTitle>{t("askAdd")}</DialogTitle>
      <form className="stack" onSubmit={event => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const ar = String(values.get("ar")).trim();
        const meaning = String(values.get("meaning")).trim();
        if (!ar || !meaning || !/\p{Script=Arabic}/u.test(ar)) { setError(t("askSaveIssue")); return; }
        const id = crypto.randomUUID();
        setSaving(true);
        void updateRecord("umrah-custom-phrases", noCustom, previous => [...previous, { id, ar, meaning }])
          .then(() => setOpen(false), () => setError(t("askSaveIssue"))).finally(() => setSaving(false));
      }}>
        <label className="field">{t("askArabic")}<textarea name="ar" dir="rtl" lang="ar" required maxLength={280} /></label>
        <label className="field">{t("askMeaning")}<textarea name="meaning" required maxLength={280} /></label>
        {error && <p role="alert">{error}</p>}
        <button className="action" disabled={saving}>{t("askSave")}</button>
      </form>
    </DialogContent>
  </Dialog>;
}

export function UmrahAskHome() {
  const { t, locale } = useCopy();
  const { trip, now } = useOutletContext<{ trip: UmrahTrip; now: Date }>();
  const { settings, change, error } = useAsk();
  const custom = useRecord("umrah-custom-phrases", noCustom);
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");
  const category = askCategories.find(item => item === params.get("category"));
  const needle = query.trim().normalize().toLowerCase();
  const meaning = (phrase: AskPhrase) => askMeaning(phrase, t);
  const results = umrahPhrases.filter(phrase => (!category || phrase.category === category) &&
    (!needle || askPhraseMatches(phrase, needle, meaning(phrase))));
  const customResults = category ? [] : custom.filter(item => [item.ar, item.meaning].some(value => value.normalize().toLowerCase().includes(needle)));
  const searching = Boolean(category || needle);
  const prepare = trip.preparation ?? emptyPreparation;
  const today = dateKey(now, makkah.timeZone);
  const tripDay = trip.start && trip.end && trip.start <= today && today <= trip.end
    ? t("askTripDay", { day: dayDifference(today, trip.start) + 1, total: dayDifference(trip.end, trip.start) + 1 }) : formatTime(now, makkah.timeZone, locale);

  return <section className="ask-home" aria-labelledby="ask-home-title">
    <header className="ask-home-header night row-between"><div>
      <p className="caption">{t("umrah")} · {tripDay}</p><h1 id="ask-home-title">{t("askHome")}</h1><p className="small muted">{t("askOffline")}</p>
    </div><VarietyPicker variety={settings.variety} change={variety => change({ variety })} homePicker /></header>
    <div className="ask-content compact-stack">
      {!searching && <section className="card ask-quick compact-stack"><h2 className="with-icon"><DesignIcon name="ask-icon-pin1" size={16} />{t(contextLabel[trip.state] ?? "askQuick")}</h2>
        <div className="chips">{quickAsks(trip.state).map(phrase => <Link key={phrase.id} className={`chip ${phrase.id === "lost" ? "ask-urgent" : "soft"}`}
          to={phraseLink(phrase.id)}>{quickLabels[phrase.id] ? t(quickLabels[phrase.id]) : meaning(phrase)}</Link>)}</div>
      </section>}
      {category && <Back to={home}><strong>{t(categoryKey(category))}</strong></Back>}
      <label className="ask-search"><DesignIcon name="ask-icon-eye" size={16} /><span className="sr-only">{t("search")}</span>
        <input type="search" value={query} placeholder={t("askSearch", { count: umrahPhrases.length + custom.length })} onChange={event => setQuery(event.currentTarget.value)} />
      </label>
      {searching ? <div className="compact-stack">
        {results.map(phrase => <Link className={`list-row${phrase.urgent ? " ask-urgent" : ""}`} to={phraseLink(phrase.id)} key={phrase.id}>
          {meaning(phrase)}
        </Link>)}
        {customResults.map(item => <Link className="list-row" to={phraseLink(item.id)} key={item.id}>{item.meaning}</Link>)}
        {!results.length && !customResults.length && <p className="muted" role="status">{t("umrahPrepNoPhrases")}</p>}
      </div> : <>
        <div className="ask-categories">{askCategories.map((key, index) => <Link className="card ask-category" key={key} to={`${home}?category=${key}`}>
          <DesignIcon name={`ask-${icons[index]}`} size={18} /><span><strong>{t(categoryKey(key))}</strong><small>{t("askCount", { count: umrahPhrases.filter(phrase => phrase.category === key).length })}</small></span>
        </Link>)}</div>
        <div className="equal-row ask-card-links">
          <section className="card"><Link to={cards}>{t("askHotelCard")}</Link>
            {prepare.hotelArabic ? <PhraseArabic text={prepare.hotelArabic} /> : <small className="muted">{t("umrahPrepNoHotel")}</small>}</section>
          <section className="card ask-urgent"><Link to={`${cards}#if-lost`}>{t("askLostCard")}</Link>
            <PhraseArabic text={renderAsk(askPhrase("lost"), settings.variety, { speaker: settings.speaker }).ar} /></section>
        </div>
        <details className="ask-extras"><summary className="text-button">{t("askLanguageTip")}</summary>
          <div className="compact-stack">{["urdu", "bengali", "indonesian"].map(code => <Link key={code} className="list-row" to={phraseLink(`speak-${code}`)}>{meaning(askPhrase(`speak-${code}`))}</Link>)}</div>
        </details>
        <section className="ask-extras"><header className="row-between"><h2>{t("askCustom")}</h2><CustomPhraseForm /></header>
          <div className="compact-stack">{custom.map(item => <Link className="list-row" key={item.id} to={phraseLink(item.id)}>{item.meaning}</Link>)}</div>
        </section>
        <AskAudioPack />
        <Link className="action soft" to={speakSetupPath("umrah-hajj")}>{t("speakPractiseForUmrah")}</Link>
      </>}
      {error && <p role="alert">{error}</p>}
    </div>
  </section>;
}

function GateNumber({ gate, change }: { gate: number; change: (value: string) => void }) {
  const { t, locale } = useCopy();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  return <div className="ask-gate"><span>{t("umrahPrepGateNumber")}</span><strong>{new Intl.NumberFormat(locale).format(gate)}</strong>
    <bdi lang="ar">{arabicNumber.format(gate)}</bdi>
    <Dialog open={open} onOpenChange={value => { setOpen(value); setError(false); }}>
      <DialogTrigger asChild><button type="button" className="chip soft">{t("askChange")}</button></DialogTrigger>
      <DialogContent className="awwab-dialog" aria-describedby={undefined}>
        <DialogTitle>{t("umrahPrepGateNumber")}</DialogTitle>
        <form className="compact-stack" onSubmit={event => {
          event.preventDefault();
          const value = readGate(String(new FormData(event.currentTarget).get("gate")));
          if (!value) { setError(true); return; }
          change(String(value)); setOpen(false);
        }}>
          <input className="input" name="gate" aria-label={t("umrahPrepGateNumber")} inputMode="numeric" defaultValue={gate} autoComplete="off" maxLength={5} />
          {error && <p role="alert">{t("askGateInvalid")}</p>}
          <button className="action">{t("askChange")}</button>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}

function Slots({ item }: { item: ReturnType<typeof usePhrase> }) {
  const { t } = useCopy();
  if (item.phrase?.id === "gate-number") return <GateNumber gate={item.gate} change={gate => item.updateSlot("gate", gate)} />;
  if (item.phrase?.id === "bus-to") return <label className="field ask-slot">{t("askDestination")}
    <select value={item.placeKey} onChange={event => item.updateSlot("place", event.currentTarget.value)}>
      {Object.entries(askPlaces).map(([key, value]) => <option key={key} value={key}>{t(value.label)}</option>)}
    </select></label>;
  if (item.phrase?.id === "lost-family") return <label className="field ask-slot">{t("askRelative")}
    <select value={item.relationKey} onChange={event => item.updateSlot("relation", event.currentTarget.value)}>
      {Object.entries(askRelations).map(([key, value]) => <option key={key} value={key}>{t(value.label)}</option>)}
    </select></label>;
  return null;
}

function DeviceVoice({ text, slow, layout = "" }: { text: string; slow: boolean; layout?: string }) {
  const { t } = useCopy();
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState(false);
  const voice = () => window.speechSynthesis?.getVoices().find(item => item.localService && /^ar(?:-|$)/i.test(item.lang));
  useEffect(() => {
    const update = () => setAvailable(Boolean(voice()));
    update();
    window.speechSynthesis?.addEventListener("voiceschanged", update);
    return () => { window.speechSynthesis?.removeEventListener("voiceschanged", update); window.speechSynthesis?.cancel(); };
  }, []);
  return <div className={`compact-stack ${layout}`}><button type="button" className="action" disabled={!available} onClick={() => {
    const local = voice();
    setError(!local);
    if (!local) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = local;
    utterance.lang = local.lang;
    utterance.rate = slow ? .75 : 1;
    utterance.onerror = event => { if (event.error !== "canceled" && event.error !== "interrupted") setError(true); };
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }}>{t("askDeviceVoice")}</button>{(!available || error) && <small className="muted" role={error ? "status" : undefined}>{t("askNoDeviceVoice")}</small>}</div>;
}

function PhraseControls({ item }: { item: ReturnType<typeof usePhrase> }) {
  const { t } = useCopy();
  return <div className="ask-player">
    <AskAudioButton ids={item.clips} settings={item.settings} label="askPlay" />
    <button type="button" className={`action ${item.settings.slow ? "soft" : "light"}`} aria-pressed={item.settings.slow} onClick={() => item.change({ slow: !item.settings.slow })}>{t("askSlow")}</button>
    <Dialog><DialogTrigger asChild><button type="button" className="action light">{t("askVoice")}</button></DialogTrigger>
      <DialogContent className="awwab-dialog" aria-describedby={undefined}><DialogTitle>{t("askVoice")}</DialogTitle>
        <AskVoicePicker preferred={item.settings.voice} change={voice => item.change({ voice })} />
        <label className="field">{t("askSpeaker")}<select value={item.settings.speaker} onChange={event => item.change({ speaker: event.currentTarget.value as AskVoice | "" })}>
          <option value="">{t("askUnspecified")}</option>{askVoices.map(voice => <option key={voice} value={voice}>{t(voice === "male" ? "askMale" : "askFemale")}</option>)}
        </select></label>
        <DialogClose asChild><button className="action" type="button">{t("shareClose")}</button></DialogClose>
      </DialogContent>
    </Dialog>
  </div>;
}

export function UmrahAskPhrase() {
  const { id } = useParams();
  const { t, language } = useCopy();
  const item = usePhrase(id);
  const { phrase, custom, text, meaning, settings, change, updateSlot, toFemale } = item;
  if (!phrase && !custom) return <div className="ask-inner"><Back to={home}>{t("askHome")}</Back></div>;
  const sign = phrase?.sign;
  return <section className="ask-inner compact-stack">
    <header className="row-between ask-subheader">
      <Back to={phrase ? `${home}?category=${phrase.category}` : home}><h1>{t(phrase ? categoryKey(phrase.category) : "askCustom")}</h1></Back>
      {phrase && <VarietyPicker variety={settings.variety} change={variety => change({ variety })} />}
    </header>
    <section className="card ask-phrase-card compact-stack">
      <div className="ask-hero-arabic"><PhraseArabic text={custom?.ar ?? text.ar} /></div>
      {text && <><p className="ask-translit" lang="en">{text.tr}</p><p lang="en">{text.en}</p></>}
      {meaning && meaning !== text.en && <p className="small muted" lang={language}>{meaning}</p>}
      {custom && <p>{custom.meaning}</p>}
      {phrase?.id === "toilet" && <div className="ask-glosses"><PhraseArabic text={text.ar}
        words={toiletGloss[settings.variety].map(word => ({ ...word, gloss: t(word.gloss), glossLanguage: language }))} /></div>}
      <Slots item={item} />
      {phrase?.gender?.toFemale?.[settings.variety] && <button type="button" className="chip soft ask-option" aria-pressed={toFemale}
        onClick={() => updateSlot("to", toFemale ? "default" : "woman")}>{t("askToFemale")}</button>}
    </section>
    {custom ? <DeviceVoice text={custom.ar} slow={settings.slow} /> : <PhraseControls item={item} />}
    <Link className="action ask-show-button" to={showLink(id) + item.suffix}>{t("askShow")}</Link>
    {phrase && <section className="compact-stack"><h2 className="caption">{t("askAnswers")}</h2>
      <div className="ask-answer-list">{answerWords.map(reply => <div key={reply.en} className="ask-answer">
        <span className="ask-arrow" aria-hidden="true">{reply.arrow || (reply.en === "behind" ? "↓" : "·")}</span><span><strong>{t(replyKey[reply.en])}</strong><small lang="en">{reply.tr}</small></span>
        <PhraseArabic text={reply.ar} />
      </div>)}</div>
    </section>}
    {sign && <div className="ask-sign row-between"><span>{t("askSign", { sign: t(askSignKey(phrase.id)) })}</span><PhraseArabic text={sign.ar} /></div>}
    {item.error && <p role="alert">{item.error}</p>}
  </section>;
}

function useKeepScreenOn() {
  useEffect(() => {
    if (!navigator.wakeLock) return;
    let current: WakeLockSentinel | undefined;
    let active = true;
    let requesting = false;
    async function request() {
      if (!active || requesting || document.visibilityState !== "visible" || (current && !current.released)) return;
      requesting = true;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (active) current = lock;
        else await lock.release();
      } catch { /* The device controls availability. */ }
      finally { requesting = false; }
    }
    function visible() { void request(); }
    visible();
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; document.removeEventListener("visibilitychange", visible); void current?.release().catch(() => {}); };
  }, []);
}

const phoneHref = (phone: string) => {
  const number = phone.replace(/[\s().-]/g, "");
  return /^\+?[0-9]{3,20}$/.test(number) ? `tel:${number}` : undefined;
};

export function UmrahAskShow() {
  const { id } = useParams();
  const { t } = useCopy();
  const { trip } = useOutletContext<{ trip: UmrahTrip }>();
  const item = usePhrase(id);
  const [reply, setReply] = useState("");
  useKeepScreenOn();
  const { settings } = item;
  const hotel = id === "hotel-card";
  const lost = id === "lost-card";
  const prep = trip.preparation ?? emptyPreparation;
  const source = hotel ? askPhrase("take-me-hotel") : lost ? askPhrase("lost") : item.phrase;
  const main = source ? (item.text ?? renderAsk(source, settings.variety, { speaker: settings.speaker })) : undefined;
  const opener = renderAsk(askPhrase("excuse-me"), settings.variety, { toFemale: item.toFemale });
  const callNumber = renderAsk(askPhrase("call-number"), settings.variety);
  const gateSign = source?.id === "gate-number" && item.gate === 79 ? "باب الملك فهد" : "";
  const audioOptions = { variety: settings.variety, speaker: settings.speaker };
  const clipIds = hotel ? ["take-me-hotel"] : lost ? [...askClipIds(source, audioOptions), "call-number"] : item.clips;
  const address = hotel ? prep.hotelAddress : gateSign;
  const back = hotel || lost ? cards : phraseLink(id) + item.suffix;
  const display = lost ? `${main.ar}. ${callNumber.ar}.` : hotel ? [main.ar, prep.hotelArabic].filter(Boolean).join("\n") : item.custom?.ar ?? main?.ar;
  if (!display) return <div className="ask-inner"><Back to={home}>{t("askHome")}</Back></div>;

  return <section className="ask-show" aria-label={t("askShow")}>
    <header className="row-between"><p className="small muted">{t("askHold")}</p>
      <Link className="ask-close" aria-label={t("shareClose")} to={back}><DesignIcon name="ask-icon-x" size={24} /></Link></header>
    <div className="ask-show-main compact-stack">
      {!lost && !hotel && source && !["excuse-me", "take-me-hotel", "thank-you", "call-number"].includes(source.id) &&
        <div className="ask-show-opener"><PhraseArabic text={opener.ar + "،"} /></div>}
      <div className="ask-show-arabic" data-gate={source?.id === "gate-number" ? "" : undefined}><PhraseArabic text={display} /></div>
      {address && <div className="ask-show-address"><PhraseArabic text={address} /></div>}
      {lost && <div className="ask-show-phone">{prep.leader && <p>{prep.leader}</p>}
        {phoneHref(prep.phone) ? <a href={phoneHref(prep.phone)} dir="ltr">{prep.phone}</a> : <bdi>{prep.phone}</bdi>}</div>}
      <div className="ask-show-meaning"><p className="ask-translit" lang="en">{lost ? `${main.tr}. ${callNumber.tr}.` : main?.tr}</p>
        <p>{lost ? t("askLostHelp") : hotel ? t("askHotelTake") : item.meaning ?? item.custom?.meaning ?? main.en}</p>
        {hotel && trip.hotel.name && <small>{trip.hotel.name}</small>}
      </div>
      <Slots item={item} />
    </div>
    <div className="ask-show-footer compact-stack">
      {!lost && !hotel && source && <section className="ask-helper night compact-stack"><h2><PhraseArabic text="اضغط على الاتجاه" /></h2>
        <p className="small muted">{t("askHelper")}</p>
        <div className="equal-row ask-directions">{helperDirections.map(direction => <div className="ask-direction" key={direction.en}>
          <span aria-hidden="true">{direction.arrow}</span>
          <ArabicText text={direction.ar} words={[{ transliteration: direction.tr }]} showGlosses={false}
            onWordSelected={() => { setReply(replyKey[direction.en]); return false; }} />
        </div>)}</div>{reply && <p className="ask-reply" role="status">{t("askTapped", { direction: t(reply) })}</p>}
      </section>}
      {item.custom ? <DeviceVoice text={item.custom.ar} slow={settings.slow} /> : <AskAudioButton ids={clipIds} settings={settings} label="askPlayAgain" />}
    </div>
  </section>;
}

function EditCard({ type, prep, name }: { type: "hotel" | "contact"; prep: typeof emptyPreparation; name: string }) {
  const { t } = useCopy();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const hotel = type === "hotel";
  const title = t(hotel ? "askHotelCard" : "askLostCard");
  return <Dialog open={open} onOpenChange={next => { if (!saving) { setError(false); setOpen(next); } }}>
    <DialogTrigger asChild><button type="button" className="chip soft" aria-label={`${t("umrahPrepEdit")} · ${title}`}>{t("umrahPrepEdit")}</button></DialogTrigger>
    <DialogContent className="awwab-dialog" aria-describedby={undefined}><DialogTitle>{title}</DialogTitle>
      <form className="compact-stack" onSubmit={event => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const value = (key: string) => String(values.get(key) ?? "").trim();
        setSaving(true); setError(false);
        void updateRecord("umrah", initialTrip, old => ({ ...old, hotel: hotel ? { ...old.hotel, name: value("name") } : old.hotel,
          preparation: { ...(old.preparation ?? emptyPreparation), ...(hotel ? { hotelArabic: value("arabic"), hotelAddress: value("address") }
            : { leader: value("leader"), phone: value("phone") }) },
        })).then(() => setOpen(false), () => setError(true)).finally(() => setSaving(false));
      }}>
        {hotel ? <>
          <label className="field">{t("umrahTripHotelName")}<input name="name" defaultValue={name} maxLength={120} /></label>
          <label className="field">{t("umrahTripHotelArabic")}<input name="arabic" lang="ar" dir="rtl" defaultValue={prep.hotelArabic} maxLength={120} /></label>
          <label className="field">{t("umrahTripHotelAddress")}<input name="address" lang="ar" dir="rtl" defaultValue={prep.hotelAddress} maxLength={240} /></label>
        </> : <>
          <label className="field">{t("umrahPrepLeader")}<input name="leader" defaultValue={prep.leader} maxLength={120} /></label>
          <label className="field">{t("umrahTripPhone")}<input name="phone" type="tel" defaultValue={prep.phone} maxLength={30} /></label>
        </>}
        {error && <p role="alert">{t("askSaveIssue")}</p>}
        <button className="action" disabled={saving}>{t("umrahTripSave")}</button>
      </form></DialogContent>
  </Dialog>;
}

export function UmrahAskCards() {
  const { t } = useCopy();
  const { hash } = useLocation();
  const { trip } = useOutletContext<{ trip: UmrahTrip }>();
  const { settings } = useAsk();
  const prep = trip.preparation ?? emptyPreparation;
  const lost = renderAsk(askPhrase("lost"), settings.variety, { speaker: settings.speaker });
  const callNumber = renderAsk(askPhrase("call-number"), settings.variety);
  useEffect(() => { if (hash === "#if-lost") document.getElementById("if-lost")?.scrollIntoView(); }, [hash]);
  return <section className="ask-inner ask-cards compact-stack">
    <Back to={home} caps><h1>{t("askCards")}</h1></Back>
    <section className="card compact-stack">
      <header className="row-between"><h2 className="caption">{t("askHotelTake")}</h2><EditCard type="hotel" prep={prep} name={trip.hotel.name} /></header>
      {prep.hotelArabic && <div className="ask-hotel-name"><PhraseArabic text={prep.hotelArabic} /></div>}
      {prep.hotelAddress && <div className="ask-hotel-address"><PhraseArabic text={prep.hotelAddress} /></div>}
      {trip.hotel.name && <p className="muted small">{trip.hotel.name}</p>}
      {!prep.hotelArabic && <p className="muted small">{t("askHotelEmpty")}</p>}
      <div className="ask-card-actions"><AskAudioButton ids={["take-me-hotel"]} settings={settings} label="askPlayHotel" icon={false} />
        <Link className="action plain" to={showLink("hotel-card")}>{t("askShowShort")}</Link></div>
    </section>
    <section className="card ask-urgent compact-stack" id="if-lost">
      <header className="row-between"><h2 className="caption">{t("askLostCard")}</h2><EditCard type="contact" prep={prep} name={trip.hotel.name} /></header>
      <div className="ask-lost-message"><PhraseArabic text={`${lost.ar}. ${callNumber.ar}.`} /></div>
      <p className="small">{t("askLostHelp")}</p>
      {(prep.leader || prep.phone) && <div className="ask-contact row-between"><div><p className="small muted">{t("umrahPrepLeader")}{prep.leader && ` · ${prep.leader}`}</p>
        <bdi><strong>{maskedPhone(prep.phone)}</strong></bdi></div>{phoneHref(prep.phone) && <a className="text-button" href={phoneHref(prep.phone)}>{t("askCall")}</a>}</div>}
      <div className="ask-card-actions"><Link className="action" to={showLink("lost-card")}>{t("askShow")}</Link>
        <AskAudioButton ids={[...askClipIds(askPhrase("lost"), settings), "call-number"]} settings={settings} label="askPlayShort" icon={false} light /></div>
    </section>
    <section className="card ask-emergency compact-stack"><div className="row-between"><div className="with-icon">
      <DesignIcon name="ask-icon-alert" size={18} /><div><h2>{t("askEmergency")}</h2><small>{t("askEmergencyRegions")}</small></div></div>
      <a href="tel:911" aria-label={`${t("askCall")} 911`}>911</a></div>
      <p className="small muted">{t("askOtherRegions")} · <a href="https://my.gov.sa/en/emergency-contact" rel="noreferrer">{t("askNumberSource")}</a></p>
    </section>
    <p className="small muted">{t("askCardsPrivacy")}</p>
  </section>;
}
