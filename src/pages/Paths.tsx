import { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { ArabicText } from "@/components/ArabicText";
import { DesignIcon } from "@/components/DesignIcon";
import { useQaidaPlace, useRecord } from "@/hooks/use-awwab";
import { useCopy } from "@/lib/copy";
import { asset } from "@/lib/config";
import { focusListItem } from "@/lib/focusListItem";
import { chapters, essentialPassages, getHifzPassage, juzs, kursiOpening, passageLabel, studyChapters, type HifzReviews } from "@/lib/hifz";
import { grammarReviewPrefix, juzAmma, learnedSurahs, levels, maktabIslandStars, pathUrl, patternReviewPrefix, qaidaIslandProgress, rootsReviewPrefix, salahChapters, sentenceReviewPrefix,
  tracks, type PathPlacement, type Track } from "@/lib/learningPaths";
import { essentialPassageTitle } from "@/lib/paths-copy";
import { countKnownQuranWords, quranText } from "@/lib/quran";
import { studyNames } from "@/lib/study-copy";
import type { Reviews } from "@/lib/reviews";
import { tajweedDepthLessons, tajweedIndex, tajweedLessons, tajweedProgress } from "@/lib/tajweed";
import { completedReadingChapters, emptyReadingPractice, practiceChapters, teacherChecklistComplete } from "@/lib/readingPractice";
import { defaultSpeakVariety, speakCourses, speakCourseVariety, speakPathCourses,
  speakProgressKey, speakVarietyKey, speakVarietyLabels, type SpeakVariety } from "@/lib/speakCurriculum";
import grammar from "../../docs/content/grammar-foundations.json";
import roots from "../../docs/content/roots-curriculum.json";
import introPatterns from "../../docs/content/roots-and-patterns.json";
import sentence from "../../docs/content/sentence-structure.json";

const trackKeys = { read: "pathsRead", memorise: "pathsMemorise", understand: "pathsUnderstand", speak: "pathsSpeak" };
const root = "/learn/paths";
const blankReviews: Reviews = {};
const blankHifz: HifzReviews = {};
const blankPlacement: PathPlacement = {};
const emptyStrings: string[] = [];
const emptyNumbers: number[] = [];
const memoriseSummaries = ["pathsEssentialSummary", "pathsFridayEidSummary", "pathsHifzSummary"];
const outlines = {
  read: { links: [["/learn/qaida", "nooraniQaida"], ["/learn/takhti", "takhti"]], units: ["pathsQaidaOutline"] },
  understand: { links: [["/learn/words", "wordBankName"], ["/learn/salah", "understandSalah"]], units: ["pathsCoreWordsOutline", "pathsSalahOutline"] },
};
const rootsLessonTotal = roots.lessons.length + 1;
const practiceLink = (id: string) => `/learn/hifz/${id}`;
const levelLink = (track: Track, level: number) => track === "read" && level === 3 ? tajweedIndex : pathUrl(track, level);

function usePathState() {
  const completedQaida = useRecord<number[]>("qaida-complete", emptyNumbers);
  const earlier = useRecord<Reviews>("reviews", blankReviews);
  const hifz = useRecord<HifzReviews>("hifz-portions", blankHifz);
  const placement = useRecord<PathPlacement>("path-placement", blankPlacement);
  const current = useRecord("hifz-current", "");
  const quranWords = useRecord<string[]>("words-known", emptyStrings);
  const vocabulary = useRecord<string[]>("word-bank-known", emptyStrings);
  const spokenLessons = useRecord(speakProgressKey, emptyStrings);
  const speakVariety = useRecord<SpeakVariety>(speakVarietyKey, defaultSpeakVariety);
  const reading = useRecord("reading-practice", emptyReadingPractice);
  const known = useMemo(() => countKnownQuranWords(quranWords, vocabulary), [quranWords, vocabulary]);
  const learned = useMemo(() => learnedSurahs(hifz, earlier), [hifz, earlier]);
  const short = salahChapters.filter(number => learned.has(number)).length;
  const amma = juzAmma.filter(chapter => learned.has(chapter.number)).length;
  const spokenCourses = speakPathCourses.map(level => {
    const variety = speakCourseVariety(speakVariety, level);
    const units = speakCourses[variety][level];
    const count = units.filter(unit => spokenLessons.includes(unit.id)).length;
    return { variety, count, total: units.length };
  });
  const spokenDone = spokenCourses.map(({ count, total }) => count === total);
  const grammarCount = grammar.lessons.filter(lesson => earlier[grammarReviewPrefix + lesson.id]?.correct > 0).length;
  const introDone = introPatterns.patterns.every(pattern => earlier[patternReviewPrefix + pattern.id]?.correct > 0);
  const rootsCount = Number(introDone) + roots.lessons.filter(lesson => earlier[rootsReviewPrefix + lesson.id]?.correct > 0).length;
  const sentenceCount = sentence.lessons.filter(lesson => earlier[sentenceReviewPrefix + lesson.id]?.correct > 0).length;
  const tajweed = tajweedProgress(earlier);
  const tajweedDepth = tajweedProgress(earlier, tajweedDepthLessons);
  const fluent = completedReadingChapters("flow", reading);
  const understood = completedReadingChapters("meaning", reading);
  const prepared = Object.values(reading.teacher).filter(teacherChecklistComplete).length;
  const readLevels = [
    completedQaida.length === 17,
    fluent === juzAmma.length,
    tajweed.completed === tajweedLessons.length,
    tajweedDepth.completed === tajweedDepthLessons.length,
    prepared === practiceChapters.teacher.length,
  ];
  const understandLevels = [
    known >= 125,
    grammarCount === grammar.lessons.length,
    rootsCount === rootsLessonTotal,
    understood === juzAmma.length,
    sentenceCount === sentence.lessons.length,
  ];
  const nextRead = readLevels.indexOf(false);
  const nextUnderstand = understandLevels.indexOf(false);
  const nextSpeak = spokenDone.indexOf(false);
  const complete = {
    read: nextRead < 0 ? readLevels.length : nextRead,
    memorise: short >= salahChapters.length ? (amma >= juzAmma.length ? 2 : 1) : 0,
    understand: nextUnderstand < 0 ? understandLevels.length : nextUnderstand,
    speak: nextSpeak < 0 ? speakPathCourses.length : nextSpeak,
  };
  const active = Object.fromEntries(tracks.map(track => [track, Math.min(5, Math.max(complete[track] + 1, placement[track]?.level ?? 1))])) as Record<Track, number>;
  return { active, complete, completedQaida, learned, short, amma, known, current, placement, speakVariety, spokenCourses, spokenDone, grammarCount, rootsCount, sentenceCount, tajweed, tajweedDepth, fluent, understood, prepared };
}

function levelDone(track: Track, level: number, state: ReturnType<typeof usePathState>) {
  return level <= state.complete[track] ||
    (track === "read" && level === 2 && state.fluent === juzAmma.length) ||
    (track === "read" && level === 3 && state.tajweed.completed === tajweedLessons.length) ||
    (track === "read" && level === 4 && state.tajweedDepth.completed === tajweedDepthLessons.length) ||
    (track === "read" && level === 5 && state.prepared === practiceChapters.teacher.length) ||
    (track === "understand" && level === 3 && state.rootsCount === rootsLessonTotal) ||
    (track === "understand" && level === 4 && state.understood === juzAmma.length) ||
    (track === "understand" && level === 5 && state.sentenceCount === sentence.lessons.length) ||
    (track === "speak" && state.spokenDone[level - 1]);
}

function PathsBack({ to }: { to: string }) {
  const { t } = useCopy();
  return <Link className="hifz-back" to={to} aria-label={t("back")}><DesignIcon name="ask-icon-chev-l" size={24} /></Link>;
}

function PathIcon({ track, desktop }: { track: Track; desktop: boolean }) {
  return <span className="paths-icon"><DesignIcon name={`paths-${desktop ? "desk" : "phone"}-${track}`} size={desktop ? 16 : 20} /></span>;
}

function contextLabel(track: Track, level: number, state: ReturnType<typeof usePathState>, t: ReturnType<typeof useCopy>["t"]) {
  if (track === "read" && level === 1) return t("pathsQaidaCount", { count: state.completedQaida.length });
  if (track === "read" && level === 2) return t("readingSurahsProgress", { count: state.fluent, total: juzAmma.length });
  if (track === "read" && level === 3) return t("pathsLessonProgress", { count: state.tajweed.completed, total: tajweedLessons.length });
  if (track === "read" && level === 4) return t("pathsLessonProgress", { count: state.tajweedDepth.completed, total: tajweedDepthLessons.length });
  if (track === "read" && level === 5) return t("readingPreparedCount", { count: state.prepared });
  if (track === "memorise") {
    if (level === 1) return t("pathsSalahProgress", { count: state.short, total: salahChapters.length });
    if (level === 2) return t("pathsAmmaProgress", { count: state.amma });
    return t(memoriseSummaries[level - 3]);
  }
  if (track === "understand" && level === 1) return t("pathsCoreCount", { count: state.known });
  if (track === "understand" && level === 2) return t("pathsLessonProgress", { count: state.grammarCount, total: grammar.lessons.length });
  if (track === "understand" && level === 3) return t("pathsLessonProgress", { count: state.rootsCount, total: rootsLessonTotal });
  if (track === "understand" && level === 4) return t("readingSurahsProgress", { count: state.understood, total: juzAmma.length });
  if (track === "understand" && level === 5) return t("pathsLessonProgress", { count: state.sentenceCount, total: sentence.lessons.length });
  const course = state.spokenCourses[level - 1];
  const progress = t("pathsLessonProgress", { count: course.count, total: course.total });
  return state.speakVariety === defaultSpeakVariety && course.variety === defaultSpeakVariety ? progress : `${t(speakVarietyLabels[course.variety])} · ${progress}`;
}

function LevelNumber({ level, done, active, desktop, tag }: { level: number; done: boolean; active: boolean; desktop: boolean; tag?: string }) {
  const { locale } = useCopy();
  return <span className="paths-level-number" data-state={done ? "done" : active ? "current" : "open"} aria-hidden="true">
    {done ? <DesignIcon name={desktop ? "paths-desk-check" : "paths-phone-check"} size={desktop ? 12 : 16} /> : tag ?? new Intl.NumberFormat(locale).format(level)}
  </span>;
}

function MobileTrackCard({ track, state }: { track: Track; state: ReturnType<typeof usePathState> }) {
  const { t } = useCopy();
  const level = state.active[track];
  return <Link className="card paths-mobile-track" to={pathUrl(track)}>
    <div className="with-icon"><PathIcon track={track} desktop={false} /><div><h2>{t(trackKeys[track])}</h2><p className="small muted">{t(`${trackKeys[track]}Overview`)}</p></div></div>
    <div className="equal-row paths-steps" aria-hidden="true">{levels[track].map((item, index) =>
      <span key={item.titleKey} data-state={levelDone(track, index + 1, state) ? "done" : index + 1 === level ? "current" : "open"} />)}</div>
    <p className="small">{t("pathsLevelStatus", { number: level, title: t(levels[track][level - 1].titleKey) })}
      {track === "memorise" && level === 2 && ` · ${t("pathsAmmaCount", { count: state.amma })}`}
      {track === "understand" && level === 1 && ` · ${t("pathsCoreCount", { count: state.known })}`}</p>
  </Link>;
}

function DesktopTrackCard({ track, state }: { track: Track; state: ReturnType<typeof usePathState> }) {
  const { t } = useCopy();
  return <section className="card paths-desk-track" onKeyDown={event => focusListItem(event, ".paths-level-link")}>
    <header className="with-icon"><PathIcon track={track} desktop /><Link to={pathUrl(track)}><h2>{t(trackKeys[track])}</h2></Link></header>
    {levels[track].map((item, index) => {
      const isCurrent = index + 1 === state.active[track];
      const isDone = levelDone(track, index + 1, state);
      return <Link className="paths-level-link" data-state={isDone ? "done" : isCurrent ? "current" : "open"} key={item.titleKey} to={levelLink(track, index + 1)}>
        <LevelNumber level={index + 1} done={isDone} active={isCurrent} tag={item.tag && t(item.tag)} desktop />
        <div><strong>{t(item.titleKey)}</strong><small>{contextLabel(track, index + 1, state, t)}</small></div>
      </Link>;
    })}
    <Link className="action" to={levelLink(track, state.active[track])}>{t("pathsContinue", { track })}</Link>
  </section>;
}

function PathsHome({ desktop = false }: { desktop?: boolean }) {
  const { t, language } = useCopy();
  const place = useQaidaPlace();
  const state = usePathState();
  const passage = getHifzPassage(state.current || (state.complete.memorise ? "ayat-al-kursi" : undefined));
  const recommendation = passage ? { title: essentialPassageTitle(passage, t), detail: `${passageLabel(passage)} · ${t("hifzAyahs", { count: passage.ayahs })}`, href: practiceLink(passage.id),
    sample: passage.id === "ayat-al-kursi" ? kursiOpening : undefined, citation: "2:255" }
    : !state.complete.read ? { title: studyNames.lesson(language, place.lesson, "Qaida"), detail: t("pathsQaidaCount", { count: state.completedQaida.length }), href: `/learn/qaida/${place.lesson}` }
      : { title: studyNames.surah(language, 103, "Al-ʿAsr"), detail: t("listenReadRecall"), href: "/learn/surahs/103", sample: quranText[103][0].uthmani, citation: "103:1" };
  return <div className={`paths-page${desktop ? " paths-desktop" : " paths-phone"}`}>
    {!desktop && <header><h1>{t("learn")}</h1><p className="small muted">{t("pathsMobileSubtitle")}</p></header>}
    <div className="paths-top">
      <section className="card night paths-recommendation">
        <div className="compact-stack"><p className="caption">{t("pathsRecommended")}</p><h2>{recommendation.title}</h2><p className="small muted">{recommendation.detail}</p></div>
        {desktop && recommendation.sample && <ArabicText text={recommendation.sample} citation={recommendation.citation} />}
        <div className={desktop ? "paths-start-desk" : "equal-row"}>
          <Link to={recommendation.href} className="action light">{t("pathsStart")}</Link>
          {!desktop && <a className="action paths-night-secondary" href="#paths-track-list" onClick={event => {
            event.preventDefault(); document.getElementById("paths-track-list")?.focus();
          }}>{t("pathsSeeAll")}</a>}
        </div>
      </section>
      {desktop && <section className="card compact-stack paths-placement-card">
        <h2>{t("pathsNotSure")}</h2><p className="small muted">{t("pathsCheckHint")}</p>
        <Link className="action soft" to={`${root}/check`}>{t("pathsCheck")}</Link>
      </section>}
    </div>
    <div className="paths-tracks" id="paths-track-list" tabIndex={-1}>{tracks.map(track => desktop
      ? <DesktopTrackCard key={track} track={track} state={state} /> : <MobileTrackCard key={track} track={track} state={state} />)}</div>
    {!desktop && <div className="equal-row"><Link className="action soft" to={`${root}/check`}>{t("pathsCheck")}</Link>
      <Link className="action light" to="/learn/tools">{t("pathsStudyLibrary")}</Link></div>}
  </div>;
}

export function MaktabMap() {
  const { t } = useCopy();
  const state = usePathState();
  const islands = [
    { name: "pathsIslandLetters", arabic: "ب", ...qaidaIslandProgress(state.completedQaida, 1, 3) },
    { name: "pathsIslandHarakat", arabic: "بَ", ...qaidaIslandProgress(state.completedQaida, 4, 6) },
    { name: "pathsIslandJoining", arabic: "ـبـ", ...qaidaIslandProgress(state.completedQaida, 7, 17) },
    { name: "pathsIslandShort", stars: Math.floor(state.short * maktabIslandStars / salahChapters.length), arabic: quranText[103][0].uthmani, to: pathUrl("memorise", 1) },
    { name: "pathsIslandJuz", stars: Math.floor(state.amma * maktabIslandStars / juzAmma.length), arabic: "عَ", to: pathUrl("memorise", 2) },
    { name: "pathsIslandTajweed", stars: state.tajweed.stars, arabic: "نْ", to: tajweedIndex },
  ];
  const current = islands.findIndex(island => island.stars < maktabIslandStars);
  return <div className="paths-page maktab-map">
    <header><h1>{t("pathsMap")}</h1><p className="small muted">{t("pathsMapSubtitle")}</p></header>
    <div className="paths-map-area"><div className="paths-map-track">
      {islands.slice(0, -1).map((island, i) => <img key={island.name} className="paths-map-trail" data-visited={island.stars === maktabIslandStars}
        src={asset(`design/paths-map-trail-${i + 1}.svg`)} width="390" height="640" alt="" />)}
      {islands.map((island, i) => {
        const done = island.stars === maktabIslandStars;
        const active = i === current;
        const stars = t("pathsStars", { count: island.stars, total: maktabIslandStars });
        const name = t(island.name);
        const label = [name, stars, ...(done ? [t("pathsStarSticker")] : [])].join(" · ");
        return <div className="paths-island" data-island={i + 1} key={island.name} data-state={done ? "done" : active ? "current" : "open"}>
          <span className="paths-island-circle" aria-hidden="true">
            <DesignIcon name={done ? "paths-map-star" : "paths-map-star-dim"} size={done ? 32 : 28} />
          </span>
          {active && <span className="paths-island-glyph"><ArabicText text={island.arabic} /></span>}
          <Link to={island.to} className="paths-island-label" aria-label={label} aria-current={active ? "step" : undefined}>
            <strong>{name}</strong>
          </Link>
          {!done && (active || island.stars > 0) && <span className="chip soft caption">{stars}</span>}
        </div>;
      })}
    </div></div>
    <div className="equal-row"><Link className="action soft" to={root}>{t("paths")}</Link><Link className="action light" to="/learn/tools">{t("pathsStudyLibrary")}</Link></div>
  </div>;
}

function TrackLevels({ track }: { track: Track }) {
  const { t } = useCopy();
  const state = usePathState();
  return <div className="paths-page paths-levels">
    <header className="hifz-heading"><PathsBack to={root} /><div><h1>{t(trackKeys[track])}</h1>
      <p className="small muted">{t(track === "memorise" ? "pathsHifzSubtitle" : `${trackKeys[track]}Overview`)}</p></div></header>
    <ol className="paths-level-list" onKeyDown={focusListItem}>{levels[track].map((item, index) => {
      const number = index + 1;
      const active = state.active[track] === number;
      const done = levelDone(track, number, state);
      return <li key={item.titleKey}>
        <LevelNumber level={number} active={active} done={done} desktop={false} />
        <Link className="card paths-level-mobile" data-state={done ? "done" : active ? "current" : "open"} to={levelLink(track, number)}>
          <div className="row-between"><strong>{t(item.titleKey)}</strong><span className="chip caption">{done ? t("pathsDone") : active ? t("pathsInProgress") : item.tag ? t(item.tag) : t("pathsLevel", { number })}</span></div>
          <p className="small muted">{contextLabel(track, number, state, t)}</p>
          {active && track === "memorise" && number === 2 && <progress max={37} value={state.amma} aria-label={t("pathsAmmaCount", { count: state.amma })} />}
        </Link>
      </li>;
    })}</ol>
    <p className="small muted">{t("pathsAnyLevel")}</p>
    <Link className="action soft" to={`${root}/check/${track}`}>{t("pathsCheck")}</Link>
  </div>;
}

function PassageRow({ id, title, done = false }: { id: string; title?: string; done?: boolean }) {
  const { t } = useCopy();
  const passage = getHifzPassage(id);
  return <Link className="list-row paths-passage" to={practiceLink(id)}><div><strong>{title ?? essentialPassageTitle(passage, t)}</strong>
    <small><bdi>{passageLabel(passage)}</bdi> · {t("hifzAyahs", { count: passage.ayahs })}</small></div>{done && <span className="chip soft">{t("pathsDone")}</span>}</Link>;
}

function HifzDirectory() {
  const { t, language } = useCopy();
  const [selected, choose] = useState<"juz" | "surah">("juz");
  const state = usePathState();
  return <div className="compact-stack" onKeyDown={event => focusListItem(event, ".paths-passage")}>
    <div className="equal-row" role="group" aria-label={t("pathsMemorise")}>
      <button type="button" aria-pressed={selected === "juz"} className={`action ${selected === "juz" ? "" : "light"}`} onClick={() => choose("juz")}>{t("hifzChooseJuz")}</button>
      <button type="button" aria-pressed={selected === "surah"} className={`action ${selected === "surah" ? "" : "light"}`} onClick={() => choose("surah")}>{t("hifzChooseSurah")}</button>
    </div>
    {selected === "juz" ? [...juzs].reverse().map(juz => <PassageRow key={juz.number} id={`juz-${juz.number}`} title={t("hifzJuz", { number: juz.number })} />)
      : chapters.map(chapter => <PassageRow key={chapter.number} id={`surah-${chapter.number}`}
        title={studyNames.surah(language, chapter.number, chapter.title)} done={state.learned.has(chapter.number)} />)}
  </div>;
}

function MemoriseLevel({ number }: { number: number }) {
  const { t, language } = useCopy();
  const state = usePathState();
  if (number === 5) return <HifzDirectory />;
  if (number === 3 || number === 4) return <div className="compact-stack" onKeyDown={focusListItem}>{essentialPassages.filter(passage => passage.level === number)
    .map(passage => <PassageRow key={passage.id} id={passage.id} />)}</div>;
  const group = number === 1 ? salahChapters.map(chapter => studyChapters.get(chapter)) : juzAmma;
  return <div className="compact-stack" onKeyDown={event => focusListItem(event, ".paths-passage")}>
    {group.map(chapter => <PassageRow key={chapter.number} id={`surah-${chapter.number}`} title={studyNames.surah(language, chapter.number, chapter.title)} done={state.learned.has(chapter.number)} />)}
    {number === 1 && <Link className="action soft" to="/learn/salah">{t("understandSalah")}</Link>}
  </div>;
}

function Outline({ track }: { track: keyof typeof outlines }) {
  const { t } = useCopy();
  const { links, units } = outlines[track];
  return <>
    <div className="compact-stack">{links.map(([to, label]) => <Link key={to} className="action" to={to}>{t(label)}</Link>)}</div>
    <section className="card compact-stack"><h2>{t("pathsOutline")}</h2>
      <ul className="paths-outline-list">{units.map(key => <li key={key}>{t(key)}</li>)}</ul>
    </section>
  </>;
}

export function Paths({ desktop }: { desktop: boolean }) {
  const { t } = useCopy();
  const { track: id, level } = useParams();
  const { search } = useLocation();
  const track = tracks.find(candidate => candidate === id);
  const number = Number(level);
  const item = track && levels[track][number - 1];
  if (!track) return <PathsHome desktop={desktop} />;
  if (!item) return <TrackLevels track={track} />;
  if (level !== String(number)) return <Navigate replace to={pathUrl(track, number) + search} />;
  return <div className="paths-page paths-levels">
    <header className="hifz-heading"><PathsBack to={pathUrl(track)} /><div><h1>{t(item.titleKey)}</h1>
      <p className="small muted">{t(trackKeys[track])} · {t("pathsLevel", { number })}</p></div></header>
    {track === "memorise" && <MemoriseLevel number={number} />}
    {number === 1 && (track === "read" || track === "understand") && <Outline track={track} />}
  </div>;
}
