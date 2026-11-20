import { useRef, type KeyboardEvent } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { X } from "lucide-react";
import { ArabicText } from "@/components/ArabicText";
import { PrayerGuideAudio, PrayerGuideLostCount, PrayerGuideTopicCard } from "@/components/PrayerGuideSupport";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDesktop } from "@/hooks/use-awwab";
import { rakatLabel, useCopy } from "@/lib/copy";
import { guideTopics } from "@/lib/guide-copy";
import { hadithCitation } from "@/lib/hadith";
import { guidedPrayers, guideRakahIndex, guideReference, guideSource, prayerGuide, prayerGuideGroups, prayerGuideTopics,
  type GuidedPrayer, type PrayerGuideTopic } from "@/lib/prayerGuide";
import { quranText } from "@/lib/quran";
import type { Reviews } from "@/lib/reviews";
import type { Settings } from "@/lib/storageService";
import { studyNames } from "@/lib/study-copy";
import { useUi } from "@/lib/uiState";
import notes from "../../docs/content/prayer-guide.json";
import words from "../../docs/content/salah-words.json";

type PrayerOutline = ReturnType<typeof prayerGuide>;
type GuidePhrase = { arabic: string; transliteration: string; source: string; url: string; verse?: string };
const fatiha = quranText[1][1];
const fatihaLine: GuidePhrase = {
  arabic: fatiha.uthmani, transliteration: words.fatiha["1:2"].transliteration,
  source: fatiha.ref, verse: fatiha.ref, url: "https://quran.com/1/2",
};
const phrases = {
  takbir: "Allāhu akbar",
  bow: "Subḥāna rabbiyal-ʿaẓīm",
  rise: "Samiʿa llāhu liman ḥamidah",
  prostrate: "Subḥāna rabbiyal-aʿlā",
  tashahhud: "At-taḥiyyātu lillāhi waṣ-ṣalawātu waṭ-ṭayyibāt",
};
const section = (id: string) => words.sections.find(item => item.preview?.id === id || item.title === id);
const takbir = section("salahTakbir");
const bow = section("salahBowing");
const rise = section("salahRising");
const prostrate = section("salahProstration");
const tashahhud = section("Tashahhud");

function recitationCopy(recitation: string) {
  return recitation === "silent" ? "guideQuietRecitation" : recitation === "aloud" ? "guideAloudRecitation" : "guideMixedRecitation";
}

function textFor(entry: typeof bow, transliteration: string): GuidePhrase {
  return { arabic: String(entry.lines[0][0]), transliteration, source: entry.source, url: entry.url };
}

function PrayerChoices({ settings }: { settings: Settings }) {
  const { t } = useCopy();
  function move(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "j" && event.key !== "k") return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (index < 0) return;
    event.preventDefault();
    links[(index + (event.key === "j" ? 1 : links.length - 1)) % links.length].focus();
  }
  return <nav className="card guide-desk-choices" aria-label={t("prayers")} onKeyDown={move}>
    <h2>{t("prayers")}</h2>
    <ul>
      {guidedPrayers.map(prayer => <li key={prayer}><NavLink to={`/today/guide/${prayer}`}>
        <strong>{t(prayer === "jumuah" ? "guideJumuah" : prayer)}</strong>
        <span>{prayerGuideGroups(prayer, settings).map(({ type, count }) => t("guideGroupAbbreviation", { type, count })).join(" · ")}</span>
      </NavLink></li>)}
      {prayerGuideTopics.map(topic => <li key={topic}><NavLink to={`/today/guide/${topic}`}>
        <strong>{t(guideTopics[topic].name)}</strong>
        <span>{t(guideTopics[topic].menu, { count: guideTopics[topic].count })}</span>
      </NavLink></li>)}
    </ul>
  </nav>;
}

function StepPhrase({ phrase }: { phrase: GuidePhrase }) {
  const copy = useCopy();
  const [surah, ayah] = phrase.verse?.split(":").map(Number) ?? [];
  const label = phrase.verse ? copy.t("guideAyahReference", { surah, ayah }) : hadithCitation(phrase, copy).full;
  return <div className="guide-desk-phrase">
    <ArabicText text={phrase.arabic} citation={phrase.source} verse={phrase.verse} />
    <div className="guide-desk-phrase-meta">
      <span lang="ar-Latn" dir="ltr">{phrase.transliteration}</span>
      <a href={phrase.url} title={label} aria-label={label}>{label.replace(/ \(.+\)$/, "")}</a>
    </div>
  </div>;
}

function GuideRakahSteps({ step, context, friday }: { step: PrayerOutline["steps"][number]; context: string; friday: boolean }) {
  const { language, locale, t } = useCopy();
  const number = new Intl.NumberFormat(locale);
  const addSurah = step.suggestion && studyNames.surah(language, step.suggestion.number, step.suggestion.transliteration);
  const steps = [
    { id: "start", title: "guideStand", detail: step.number === 1 ? "guideStartStanding" : "guideStandAgain", phrase: textFor(takbir, phrases.takbir) },
    ...(step.number === 1 ? [{ id: "opening", title: "guideStand", detail: "guideOpeningPraise", phrase: notes.opening }] : []),
    { id: "recite", title: "guideStand", detail: friday ? "guideJumuahRecitation" : addSurah ? "guideFatihaShortSurah" : "guideFatihaOnly", phrase: fatihaLine },
    { id: "bow", title: "guideBow", detail: "guideBowDetail", phrase: textFor(bow, phrases.bow) },
    { id: "rise", title: "guideRise", detail: "guideRiseDetail", phrase: textFor(rise, phrases.rise) },
    { id: "prostrate", title: "guideProstrate", detail: "guideProstrateDetail", phrase: textFor(prostrate, phrases.prostrate) },
    ...(step.sitting ? [{ id: "sitting", title: "guideSit", detail: step.sitting === "final" ? "guideFinalSitting" : "guideFirstSitting",
      phrase: textFor(tashahhud, phrases.tashahhud) }] : []),
  ];
  return <ol role="list" className="guide-desk-steps">
    {steps.map(({ id, title, detail, phrase }, index) => <li className={id === "recite" ? "card tint" : "card"} key={id}>
      <span className="guide-desk-step-number" aria-hidden="true">{number.format(index + 1)}</span>
      <div className="guide-desk-instruction"><strong>{t(title)}</strong><p className="muted">{t(detail)}</p>
        {id === "recite" && !friday && addSurah && <Link to={`/learn/surahs/${step.suggestion.number}?${context}`}>{addSurah}</Link>}
      </div>
      <StepPhrase phrase={phrase} />
    </li>)}
  </ol>;
}

function GuideRakahPanel({ prayer, outline, context, active, select }: {
  prayer: GuidedPrayer; outline: PrayerOutline; context: string; active: number; select: (next: string) => void;
}) {
  const copy = useCopy();
  const { direction, locale, t } = copy;
  const step = outline.steps[active];
  const tabRefs = useRef<HTMLButtonElement[]>([]);
  const format = new Intl.NumberFormat(locale);
  const name = t(prayer === "jumuah" ? "guideJumuah" : prayer);
  const recitation = t(recitationCopy(step.recitation));
  const laterRange = outline.fardCount > guideSource.withAdditionalSurahThrough && (outline.fardCount === 3 ? format.format(3) : `${format.format(3)}–${format.format(outline.fardCount)}`);
  const audioSurahs = [{ number: 1, transliteration: "Al-Fātiḥa" }, ...(step.suggestion ? [step.suggestion] : [])];

  return <Tabs.Root className="guide-desk-main" dir={direction} value={String(step.number)} onValueChange={select}>
    <header className="card guide-desk-heading">
      <div><h2>{t("guideFardTitle", { name, count: outline.fardCount })}</h2>
        <p className="small muted">{recitation}{laterRange && ` · ${t("guideLaterFatiha", { range: laterRange })}`}</p>
      </div>
      <Tabs.List className="guide-desk-tabs" aria-label={t("guideStepHeading", { count: outline.fardCount })}>
        {outline.steps.map(({ number }, index) => <Tabs.Trigger value={String(number)} key={number}
          ref={button => { tabRefs.current[index] = button; }} aria-label={t("guideRakahTab", { count: number })}>
          {index === active ? t("guideRakahTab", { count: number }) : format.format(number)}
        </Tabs.Trigger>)}
      </Tabs.List>
    </header>
    {outline.steps.map(({ number }) => <Tabs.Content value={String(number)} className="guide-desk-panel" key={number}>
      {number === step.number && <>
      {prayer === "jumuah" && <p className="card small">{t("guideJumuahIntro")} <a href={notes.jumuah.url}>{hadithCitation(notes.jumuah, copy).full}</a></p>}
      <GuideRakahSteps step={step} context={context} friday={prayer === "jumuah"} />
      <div className="night guide-desk-audio-bar">
        <PrayerGuideAudio surahs={audioSurahs} context={context} title={t("guideRakahAudio", { count: step.number })} desktop />
        {step.number < outline.fardCount && <button className="guide-desk-next" type="button" onClick={() => {
          select(String(step.number + 1));
          tabRefs.current[active + 1]?.focus();
        }}>{t("guideNextRakah", { count: step.number + 1 })} <span className="icon-dir" aria-hidden="true">→</span></button>}
      </div>
      </>}
    </Tabs.Content>)}
  </Tabs.Root>;
}

function GuideDetails({ outline, settings, hanafi, context, lostCount }: {
  outline?: PrayerOutline; settings: Settings; hanafi: boolean; context: string; lostCount: boolean;
}) {
  const copy = useCopy();
  const { locale, t } = copy;
  const number = new Intl.NumberFormat(locale);
  const at = outline?.groups.findIndex(group => group.type === "fard");
  const groupName = ({ count, type, emphasis }: PrayerOutline["groups"][number]) => emphasis === "ghayr-muakkadah"
    ? t("guideOptionalAsr", { count }) : `${number.format(count)} ${rakatLabel(settings, type)}`;
  const before = outline?.groups.slice(0, at).map(groupName);
  const after = outline?.groups.slice(at + 1).map(groupName);
  return <div className="guide-desk-details">
    {outline && <section className="card guide-desk-glance">
      <h2>{t("guideAtAGlance")}</h2>
      <dl>
        {before.length > 0 && <div><dt>{t("guideBefore")}</dt><dd>{before.join(" · ")}</dd></div>}
        <div><dt>{t("guideFard")}</dt><dd>{number.format(outline.fardCount)} · {t(recitationCopy(outline.steps[0].recitation))}</dd></div>
        <div><dt>{t("guideSittings")}</dt><dd>{t(outline.fardCount > guideSource.firstSittingAfter ? "guideSittingsAfter" : "guideSittingAfter", { first: guideSource.firstSittingAfter, final: outline.fardCount })}</dd></div>
        <div><dt>{t("guideAfter")}</dt><dd>{after.length > 0 && `${after.join(" · ")} · `}<a href={notes.dhikr.url} title={hadithCitation(notes.dhikr, copy).full}>{t("guideDhikr")}</a></dd></div>
      </dl>
    </section>}
    {lostCount && <PrayerGuideLostCount desktop hanafi={hanafi} />}
    <section className="card guide-desk-word-info">
      <h2>{t("guideWordByWord")}</h2>
      <p className="small muted">{t("guideWordByWordIntro")}</p>
      <Link className="action soft" to={`/learn/salah?${context}`}>{t("guideWordByWordOpen")}</Link>
    </section>
  </div>;
}

export function DesktopPrayerGuide({ prayer, topic, settings, reviews }: {
  prayer?: GuidedPrayer; topic?: PrayerGuideTopic; settings: Settings; reviews: Reviews;
}) {
  const { t } = useCopy();
  const wide = useDesktop(1280);
  const word = useUi(state => state.word);
  const [params, setParams] = useSearchParams();
  const hanafi = guideReference(settings) === "hanafi";
  const outline = prayer ? prayerGuide(prayer, settings, reviews) : undefined;
  const active = guideRakahIndex(params.get("rakah"), outline?.fardCount ?? 1);
  const context = `fromPrayer=${prayer ?? topic}${active ? `&fromRakah=${active + 1}` : ""}`;
  const inline = wide && !word;
  const details = <GuideDetails outline={outline} settings={settings} hanafi={hanafi} context={context} lostCount={topic !== "sahw"} />;

  function selectRakah(next: string) {
    useUi.getState().selectWord();
    setParams({ rakah: next }, { replace: true, preventScrollReset: true });
  }

  return <div className="guide-desktop" data-details={inline}>
    <PrayerChoices settings={settings} />
    {outline ? <GuideRakahPanel prayer={prayer} outline={outline} active={active} select={selectRakah} context={context} /> : <PrayerGuideTopicCard topic={topic} hanafi={hanafi} desktop />}
    {inline ? details : <Dialog>
      <DialogTrigger className="action soft guide-desk-notes-trigger">{t("guidePrayerDetails")}</DialogTrigger>
      <DialogContent className="awwab-dialog desktop-detail-drawer guide-desk-drawer" overlayClassName="desktop-detail-overlay"
        aria-describedby={undefined} showCloseButton={false}>
        <div className="row-between"><DialogTitle>{t("guidePrayerDetails")}</DialogTitle>
          <DialogClose asChild><button type="button" className="icon-button" aria-label={t("qadaClose")}><X size={18} /></button></DialogClose>
        </div>
        {details}
      </DialogContent>
    </Dialog>}
  </div>;
}
