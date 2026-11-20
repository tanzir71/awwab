import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { LocalRecorder } from "@/components/LocalRecorder";
import { QuranVerseMeaning } from "@/components/QuranStudySources";
import { ListLink, SectionNav } from "@/components/Surface";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { useDesktop, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { dateKey, formatDay } from "@/lib/dates";
import { prayerGuidePath } from "@/lib/prayerGuide";
import { parseQaidaReview } from "@/lib/qaidaPractice";
import { formatQuranReference, quranText, type QuranVerse } from "@/lib/quran";
import { showEnglishQuranMeaning } from "@/lib/languagePreferences";
import { grades, isDue, reviewCard, type ReviewGrade, type Reviews } from "@/lib/reviews";
import { updateRecord, type Settings } from "@/lib/storageService";
import { reviewDestination } from "@/lib/studyDesk";
import { studyNames } from "@/lib/study-copy";
import { momentPath, saveSurahReview } from "@/lib/studyMilestones";
import { useUi } from "@/lib/uiState";
import { splitArabicWords, splitGraphemes, wordAnatomy } from "@/lib/wordAnatomy";
import chaptersSource from "../../docs/content/surahs-for-salah.json";
import printTransliteration from "../../docs/content/print-surah-transliteration.json";
import studyWords from "../../docs/content/surah-study-words.json";

const chapters = chaptersSource.surahs.slice(0, 12);
type Chapter = typeof chapters[number];
const modes = ["listen", "read", "recall"] as const;
type StudyMode = typeof modes[number];
const ordinaryNames: Record<number, string> = { 1: "Al-Fātiḥa", 103: "Al-ʿAsr", 112: "Al-Ikhlāṣ", 110: "An-Naṣr" };

function chapterName(chapter: Chapter, language: string) {
  return studyNames.surah(language, chapter.number, ordinaryNames[chapter.number] ?? chapter.transliteration);
}

function verseWords(verse: QuranVerse) {
  const glosses: string[] = studyWords.glosses[verse.ref] ?? [];
  return splitArabicWords(verse.uthmani).map((anatomyWord, index) => ({ anatomyWord, gloss: glosses[index] }));
}

function verseTransliteration(verse: QuranVerse, index: number) {
  return (printTransliteration[verse.ref.split(":")[0]] as string | undefined)?.split(" · ")[index] ??
    verseWords(verse).map(({ anatomyWord }, position) => wordAnatomy(anatomyWord, position > 0).syllables.map(syllable => syllable.tr).join("")).join(" ");
}

function lineBreaks(text: string, wide: boolean) {
  const lines: string[] = [];
  let line: string[] = [];
  const limit = wide ? 30 : 19;
  let length = 0;
  for (const word of splitArabicWords(text)) {
    const letters = splitGraphemes(word).length;
    if (line.length && (line.length >= (wide ? 5 : 4) || length + letters > limit)) {
      lines.push(line.join(" "));
      line = [];
      length = 0;
    }
    line.push(word);
    length += letters;
  }
  return [...lines, line.join(" ")].join("\n");
}

function ReaderModes({ selected, change }: { selected: StudyMode; change: (mode: StudyMode) => void }) {
  const { t } = useCopy();
  return <div className="equal-row study-tabs" role="group" aria-label={t("studyMode")}>
    {modes.map(mode => <button type="button" key={mode} className="action plain" aria-pressed={selected === mode}
      onClick={() => change(mode)}>{t(mode)}</button>)}
  </div>;
}

function ReviewQueue({ selected, reviews, now }: { selected: number; reviews: Reviews; now: Date }) {
  const { t, language, locale } = useCopy();
  const number = new Intl.NumberFormat(locale);
  const due = Object.entries(reviews).filter(([, review]) => isDue(review, now));
  return <aside className="surah-queue" aria-label={t("surahList")}>
    <section className="card surah-due">
      <div className="row-between"><h2>{t("surahDueToday")}</h2><strong>{number.format(due.length)}</strong></div>
      {due.length === 0 && <p className="muted">{t("deskNoReviews")}</p>}
      {due.map(([id]) => {
        const chapter = chapters.find(item => String(item.number) === id);
        const row = parseQaidaReview(id);
        const label = chapter ? chapterName(chapter, language) : row ? t("deskQaidaRow", { number: row.lesson, row: row.row + 1 }) :
          t(id.startsWith("letter:") ? "surahQueueLetter" : "surahQueueWord");
        return <div className="surah-due-item" data-selected={Number(id) === selected} key={id}>
          {chapter ? <>
            <Link to={reviewDestination(id)}>{label}</Link><small className="muted">{t("surahQueueItem", { count: chapter.words })}</small>
          </> : row ? <Link to={reviewDestination(id)}>{label}</Link> : <>
            <ArabicText text={id.slice(id.indexOf(":") + 1)} compact />
            <Link className="muted" to={reviewDestination(id)}>{label}</Link>
          </>}
        </div>;
      })}
    </section>
    <section className="card surah-shortest">
      <div className="row-between"><h2>{t("surahShortestFirst")}</h2><Link to="/learn/surahs">{t("surahAllChapters", { count: chapters.length })}</Link></div>
      {chapters.slice(0, 8).map(chapter => {
        const review = reviews[chapter.number];
        const status = !review ? "deskNew" : isDue(review, now) ? "due" : review.bucket;
        return <Link className="surah-shortest-row" to={"/learn/surahs/" + chapter.number} key={chapter.number}
          aria-current={chapter.number === selected ? "page" : undefined}>
          <span className="muted">{number.format(chapter.number)}</span><strong>{chapterName(chapter, language)}</strong>
          <small className="muted">{t("surahShortWordCount", { count: chapter.words })}</small>
          <span className="chip" data-bucket={status}>{t(status).split(" · ")[0]}</span>
        </Link>;
      })}
    </section>
    <section className="card surah-buckets"><h2>{t("surahReviewBuckets")}</h2>
      {(["sabaq", "sabqi", "manzil"] as const).map(bucket => <div className="row-between" data-bucket={bucket} key={bucket}>
        <span>{t(bucket === "manzil" ? "surahRetained" : bucket)}</span><strong>{number.format(Object.values(reviews).filter(review => review.bucket === bucket).length)}</strong>
      </div>)}
    </section>
  </aside>;
}

function elapsedTime(seconds: number, locale: string) {
  const time = Math.floor(seconds);
  const minutes = new Intl.NumberFormat(locale, { useGrouping: false });
  const remainder = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false });
  return minutes.format(Math.floor(time / 60)) + ":" + remainder.format(time % 60);
}

export function SurahReader({ settings, now }: { settings: Settings; now: Date }) {
  const { t, language } = useCopy();
  const { id } = useParams();
  const reviews = useRecord<Reviews>("reviews", {});
  const chapter = chapters.find(item => item.number === Number(id));
  if (chapter) return <SurahStudy key={id} chapter={chapter} settings={settings} reviews={reviews} now={now} />;
  return <div className="stack">
    <SectionNav title={t("surahsForSalah")} back="/learn" />
    {chapters.map(chapter => <ListLink to={"/learn/surahs/" + chapter.number} key={chapter.number} icon={<DesignIcon name="desk-headphones" size={16} />}
      title={chapterName(chapter, language)} detail={t("wordCount", { count: chapter.words }) + " · " + t(reviews[chapter.number] && isDue(reviews[chapter.number], now) ? "due" : reviews[chapter.number]?.bucket ?? "sabaq")} />)}
  </div>;
}

function SurahStudy({ chapter, settings, reviews, now }: { chapter: Chapter; settings: Settings; reviews: Reviews; now: Date }) {
  const [params, setParams] = useSearchParams();
  const { t, language, locale } = useCopy();
  const navigate = useNavigate();
  const desktop = useDesktop();
  const adultDesk = desktop && settings.mode === "adult";
  const maktabDesk = desktop && settings.mode === "maktab";
  const mode = modes.find(value => value === params.get("mode")) ?? "read";
  const [display, setDisplay] = useState({ translit: true, translation: undefined as boolean | undefined, word: adultDesk });
  const enabled = { ...display, translation: display.translation ?? showEnglishQuranMeaning(settings) };
  const options = [["translit", "surahTranslit"], ["translation", language === "en" ? "surahTranslation" : "surahEnglishTranslation"],
    ["word", "surahWordByWord"]] as const;
  const [hints, setHints] = useState<Record<string, boolean>>({});
  const [loops, setLoops] = useState<Record<string, boolean>>({});
  const [speed, setSpeed] = useState(.75);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const reading = useRef<HTMLElement>(null);
  const [wideVerse, setWideVerse] = useState(false);
  const remembered = useRecord<string[]>("surah-lines-known", []);
  const word = useUi(state => state.word);
  const selectWord = useUi(state => state.selectWord);
  const verses = quranText[chapter.number];
  const audio = useAudioPlayback(verses.map(verse => verse.ref).concat("surah:" + chapter.number));
  const pack = "/you/audio?surah=" + chapter.number;
  const name = chapterName(chapter, language);
  const stored = reviews[chapter.number];
  const bucket = stored?.bucket ?? "sabaq";
  const number = new Intl.NumberFormat(locale);
  const arabicNumber = new Intl.NumberFormat("ar-u-nu-arab");
  const currentRef = audio.track ?? (audio.has(verses[0].ref) ? verses[0].ref : "surah:" + chapter.number);
  const activeIndex = verses.findIndex(verse => verse.ref === currentRef);
  const playerLabel = activeIndex < 0 ? name : t("surahPlayerVerse", { number: activeIndex + 1, total: verses.length });
  const back = prayerGuidePath(params.get("fromPrayer"), params.get("fromRakah")) ?? "/learn/surahs";
  const anatomyRef = params.get("anatomy");

  useEffect(() => {
    if (!reading.current) return;
    const observer = new ResizeObserver(([entry]) => setWideVerse(entry.contentRect.width >= 460));
    observer.observe(reading.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const selected = useUi.getState().word;
    if (anatomyRef) {
      const [surah, ayah, position] = anatomyRef.split(":").map(Number);
      const verse = verses.find(item => item.ref === `${surah}:${ayah}`);
      const detail = verse && verseWords(verse)[position - 1];
      if (detail) {
        selectWord({ word: detail.anatomyWord, gloss: detail.gloss, citation: verse.ref, verse: verse.ref, position, connected: position > 1 });
        return;
      }
    }
    if (!desktop) {
      if (selected?.automatic) selectWord();
      return;
    }
    if (selected) return;
    const first = verses[0];
    const [detail] = verseWords(first);
    selectWord({ word: detail.anatomyWord, gloss: detail.gloss, citation: first.ref, verse: first.ref, position: 1, connected: false, automatic: true });
  }, [anatomyRef, desktop, selectWord, verses]);

  function changeMode(next: StudyMode) {
    if (next === mode) return;
    setSaved(false);
    setParams(previous => {
      const nextParams = new URLSearchParams(previous);
      nextParams.set("mode", next);
      return nextParams;
    }, { replace: true });
  }

  function chooseSpeed(value: number) {
    setSpeed(value);
    if (audio.element.current) audio.element.current.playbackRate = value;
  }

  function toggleLoop(ref: string) {
    const loop = !loops[ref];
    setLoops(previous => ({ ...previous, [ref]: loop }));
    if (audio.track === ref && audio.element.current) audio.element.current.loop = loop;
  }

  async function grade(value: ReviewGrade) {
    if (saving || saved) return;
    setSaving(true);
    try {
      const moved = await saveSurahReview(chapter.number, value, new Date(), settings.city.timeZone);
      setSaved(true);
      if (moved) navigate(momentPath("surah", chapter.number));
    } catch { toast.error(t("reviewSaveError")); }
    finally { setSaving(false); }
  }

  function previewGrade(value: ReviewGrade) {
    const next = reviewCard(stored, value, now);
    const minutes = Math.max(1, Math.round((next.card.due.valueOf() - now.valueOf()) / 60_000));
    if (minutes < 60) return t("surahGradeMinutes", { count: minutes });
    if (minutes < 1440) return t("surahGradeHours", { count: Math.round(minutes / 60) });
    return t("surahGradeDays", { count: Math.round(minutes / 1440) });
  }

  const segments = <ReaderModes selected={mode} change={changeMode} />;
  const help = <p className="surah-spell-note"><DesignIcon size={16} name={maktabDesk ? "surah-maktab-info" : "surah-mobile-info"} />
    {t(maktabDesk ? "surahTapDesktop" : "spellOutHint")}{maktabDesk && <span className="icon-dir" aria-hidden="true">→</span>}</p>;
  const preferences = <div className="surah-preferences">
    <div className="surah-reader-options" role="group" aria-label={t("surahReaderOptions")}>
      {options.map(([key, label]) => <button type="button" className="chip" key={key} aria-pressed={enabled[key]}
        onClick={() => setDisplay(value => ({ ...value, [key]: !enabled[key] }))}>{t(label)}</button>)}
    </div>
    <label className="surah-speed"><span className={adultDesk ? "sr-only" : ""}>{t("surahSetRecitation")}</span>
      <select value={speed} onChange={event => chooseSpeed(Number(event.target.value))}>
        {[.5, .75, 1, 1.25].map(value => <option key={value} value={value}>{number.format(value)}×</option>)}
      </select>
    </label>
  </div>;
  const playLabel = audio.playing ? "surahPause" : "surahPlay";
  return <div className="surah-workspace" data-layout={adultDesk ? "adult" : maktabDesk ? "maktab" : "phone"}>
    {adultDesk && <ReviewQueue selected={chapter.number} reviews={reviews} now={now} />}
    <article className="surah-reading" ref={reading}>
      <audio hidden ref={audio.element} {...audio.events} />
      {!desktop && <SectionNav title={t("chapterHeading", { name, number: chapter.number })} back={back}
        backIcon={<DesignIcon size={24} name="surah-mobile-chevl" />}
        action={<Dialog><DialogTrigger asChild><button type="button" className="icon-button" aria-label={t("learningSettings")}><DesignIcon size={24} name="surah-mobile-sliders" /></button></DialogTrigger>
          <DialogContent className="awwab-dialog" aria-describedby={undefined}><DialogTitle>{t("surahReaderOptions")}</DialogTitle>{preferences}</DialogContent></Dialog>} />}
      {adultDesk ? <div className="card surah-toolbar">{segments}{preferences}</div> : maktabDesk ?
        <header className="surah-maktab-header"><div><p className="caption">{t("surahPosition", { number: chapters.indexOf(chapter) + 1, total: chapters.length })}</p>
          <h1>{name} · <bdi lang="en">{chapter.english}</bdi></h1></div>{segments}</header> : segments}
      {!desktop && <div className="surah-phone-status"><span className="chip caption" data-bucket={bucket}>{t(bucket)}</span>
        <span className="muted small">{t("chapterCounts", { verses: chapter.ayahs, words: chapter.words })}</span></div>}
      {!adultDesk && help}
      {verses.map((verse, index) => {
        const recalling = mode === "recall" && index > 0;
        const visible = !recalling || (hints[verse.ref] ?? index === 1);
        const optionsForVerse = (position: number) => !recalling || (index === 1 && position === 1) ? "read" as const : "hint" as const;
        const verseLabel = t("verseLabel", { number: index + 1 });
        const playingThis = audio.track === verse.ref && audio.playing;
        const actions = adultDesk || mode === "listen";
        return <section className="card surah-verse" data-hidden={!visible} key={verse.ref}>
          <div className="surah-verse-line">
            {visible ? <ArabicText text={lineBreaks(verse[settings.script], wideVerse)} citation={verse.ref} verse={verse.ref} recall={optionsForVerse}
              mushaf={settings.script} words={verseWords(verse)} showGlosses={display.word}
              selectedPosition={word?.verse === verse.ref ? word.position : !word && index === 0 ? 1 : undefined} /> :
              <h2>{t("surahReciteMemory", { number: index + 1 })}</h2>}
            <a className="surah-verse-number" href={"https://quran.com/" + verse.ref.replace(":", "/")}
              aria-label={t("surahVerseSource", { reference: formatQuranReference(verse.ref, locale) })}>
              <span lang="ar" aria-hidden="true">{arabicNumber.format(index + 1)}</span></a>
          </div>
          <div className="surah-verse-foot">
            <div>{!recalling && display.translit && <p className="surah-transliteration" lang="ar-Latn" dir="ltr">{verseTransliteration(verse, index)}</p>}
              {enabled.translation && <QuranVerseMeaning text={verse.english} cue={recalling} />}
              {recalling && index > 1 && <button className="text-button surah-hint-control" type="button" aria-expanded={visible}
                onClick={() => setHints(previous => ({ ...previous, [verse.ref]: !visible }))}>
                <DesignIcon name="surah-mobile-eye" size={16} />{t(visible ? "hideInitials" : "showInitials")}</button>}
            </div>
            {actions && <div className="surah-audio-tools">
              {audio.has(verse.ref) ? <button type="button" className="chip" aria-label={t(playingThis ? "surahPauseVerse" : "surahPlayVerse", { name: verseLabel })}
                onClick={() => audio.play(verse.ref, speed, loops[verse.ref])}>{!playingThis && <DesignIcon name="surah-adult-play1" size={12} />}
                {t(playingThis ? "surahPause" : "surahPlay")}</button> :
                <Link className="chip" to={pack} aria-label={t("surahPlayVerse", { name: verseLabel }) + " · " + t("downloadRecitation")}><DesignIcon name="surah-adult-play1" size={12} />{t("surahPlay")}</Link>}
              <button type="button" className="chip" aria-label={t("surahLoopVerse", { name: verseLabel })} aria-pressed={Boolean(loops[verse.ref])}
                onClick={() => toggleLoop(verse.ref)}>{t("surahLoop")}</button>
              <LocalRecorder label={verseLabel} compact />
            </div>}
          </div>
          {settings.mode === "maktab" && mode !== "read" && <button className={"action " + (remembered.includes(verse.ref) ? "" : "soft")} type="button"
            aria-pressed={remembered.includes(verse.ref)} onClick={() => void updateRecord<string[]>("surah-lines-known", [], known =>
              known.includes(verse.ref) ? known.filter(ref => ref !== verse.ref) : [...known, verse.ref]).catch(() => toast.error(t("saveError")))}>
            {t("deskCanSayLine", { number: index + 1 })}
          </button>}
        </section>;
      })}
      {(adultDesk || mode === "listen") && <div className="surah-recitation">
        {audio.has(currentRef) ? <button type="button" className="surah-player-control" aria-label={t(playLabel) + " · " + playerLabel}
          onClick={() => audio.play(currentRef, speed, loops[currentRef])}>{!audio.playing ? <DesignIcon name="surah-adult-play2" size={16} /> : "Ⅱ"}</button> :
          <Link className="surah-player-control" to={pack} aria-label={t("downloadRecitation")}><DesignIcon name="surah-adult-play2" size={16} /></Link>}
        <span>{playerLabel}</span>
        <progress max={audio.duration || 1} value={audio.elapsed} aria-label={t("surahProgress")} />
        <small><bdi>{elapsedTime(audio.elapsed, locale)} / {elapsedTime(audio.duration, locale)}</bdi></small>
      </div>}
      {audio.error && <p className="small muted" role="status">{t("surahAudioError")}</p>}
      <section className="surah-grading">
        {!desktop && <h2>{t("howDidItGo")}</h2>}
        <div className="equal-row">{(Object.keys(grades) as ReviewGrade[]).map(value => <button type="button"
          key={value} className={"action " + (value === "got-it" ? "" : "light")} disabled={saving || saved}
          onClick={() => void grade(value)}><span>{t(value)}</span>{adultDesk && <small>{previewGrade(value)}</small>}</button>)}</div>
        {saved && <p className="muted small" role="status">{t("reviewSaved")}</p>}
      </section>
      {chapter.number !== 1 && <p className="surah-suggestion small muted">{t("tryInMaghrib", { name })}</p>}
      <p className="surah-credit small muted"><a href={settings.script === "indopak" ? "https://digitalkhatt.org" : "https://tanzil.net/docs/text_license"}>
        {t(settings.script === "indopak" ? "indopakCredit" : "tanzilCredit")}</a></p>
    </article>
  </div>;
}
