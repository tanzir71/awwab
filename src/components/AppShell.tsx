import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { DesignIcon, Wordmark } from "./DesignIcon";
import { ShareLink } from "./ShareLink";
import { WordPanel } from "./WordPanel";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "./ui/dialog";
import { useDesktop, useRecord, usePrayerLogs } from "@/hooks/use-awwab";
import { dateKey, duration, formatDay } from "@/lib/dates";
import { calendarDefaults, hijriLabel, hijriOn } from "@/lib/hijri";
import { currentPrayerSchedule } from "@/lib/prayerServices";
import { guideReference } from "@/lib/prayerGuide";
import { prayerStatistics, type Settings, updateSettings } from "@/lib/storageService";
import { useUi } from "@/lib/uiState";
import { isDue, type Reviews } from "@/lib/reviews";
import { mosqueDefaults } from "@/lib/mosques";
import { message, navigationLabel } from "@/lib/copy";
import { countKnownQuranWords } from "@/lib/quran";
import { reviewDestination, studyPlanMinutes, type DeskActivity } from "@/lib/studyDesk";
import { studyNames } from "@/lib/study-copy";
import { qaidaRows, resolveQaidaRow } from "@/lib/qaidaPractice";
import { planMonth } from "@/lib/plan-copy";
import { gregorianMonthBounds, readCalendarMonth } from "@/lib/plan-calendar";
import { zakatHawl, type ZakatProfile } from "@/lib/zakat";
import { initialTrip, tripDates } from "@/lib/umrah";
import { formatLocale, languages } from "@/lib/languagePreferences";
import { latinDigits } from "@/lib/localeNumbers";
import { focusListItem } from "@/lib/focusListItem";
import { prayerCityLabel } from "@/lib/settings-copy";
import { speakCourseTitle, speakSetupPath, speakUnit, speakUnitNumber, speakVarietyLabels } from "@/lib/speakCurriculum";
import qaida from "../../docs/content/qaida-lessons.json";
import surahs from "../../docs/content/surahs-for-salah.json";

type NavItem = { title: string; to: string; icon: string; end?: boolean; simple?: string; tab?: string };
const mobile: NavItem[] = [
  { title: "Today", to: "/today", icon: "home", tab: "home", simple: "clock" },
  { title: "Learn", to: "/learn", icon: "book", tab: "book", simple: "book" },
  { title: "Return", to: "/return", icon: "ret", tab: "ret", simple: "ret" },
  { title: "Plan", to: "/plan", icon: "cal", tab: "cal", simple: "cal" },
  { title: "You", to: "/you", icon: "user", tab: "user", simple: "user" },
];
const groups: { label: string; items: NavItem[] }[] = [
  { label: "Learn", items: [
    { title: "Study plan", to: "/learn", icon: "home", end: true },
    { title: "Paths", to: "/learn/paths", icon: "sliders" },
    { title: "Qaida", to: "/learn/qaida", icon: "book" },
    { title: "Surahs", to: "/learn/surahs", icon: "headphones" },
    { title: "Word bank", to: "/learn/words", icon: "list" },
    { title: "Takhti", to: "/learn/takhti", icon: "pen" },
    { title: "Speak", to: "/learn/speak", icon: "speech" },
    { title: "Fluency", to: "/learn/fluency", icon: "bulb" },
    { title: "Hadith", to: "/learn/hadith", icon: "scroll" },
  ] },
  { label: "Daily", items: [
    { title: "Prayers", to: "/today", icon: "clock" },
    { title: "Return", to: "/return", icon: "ret" },
    { title: "Plan", to: "/plan", icon: "cal", end: true },
    { title: "You", to: "/you", icon: "user" },
  ] },
  { label: "Tools", items: [
    { title: "My mosques", to: "/plan/mosques", icon: "pin" },
    { title: "Zakat", to: "/plan/zakat", icon: "coins" },
    { title: "Umrah mode", to: "/umrah", icon: "cube" },
    { title: "Print & export", to: "/print", icon: "download" },
  ] },
];
const simple = [mobile[1], mobile[0], ...mobile.slice(2)];
const destinations = groups.flatMap(group => group.items);

function normalizeSearch(text: string, locale: string) {
  return latinDigits(text, locale).trim().toLowerCase().normalize("NFD")
    .replace(/(\p{Script=Latin})\p{Mark}+/gu, "$1")
    .replace(/[\u064b-\u0652\u0670]/g, "")
    .normalize("NFC");
}

function searchApp(settings: Settings, query: string) {
  const locale = formatLocale({ language: settings.language });
  const terms = normalizeSearch(query, locale).split(/\s+/).filter(Boolean);
  function matches(text: string) {
    const searchable = normalizeSearch(text, locale);
    const words = searchable.split(/[^\p{Letter}\p{Mark}\p{Number}]+/u);
    return terms.every(term => /^\d+$/.test(term) ? words.includes(term) : searchable.includes(term));
  }
  const screens = destinations.map(({ title, to }) => ({
    title: navigationLabel(settings, title), to, aliases: title,
  })).filter(({ title, aliases }) => matches(`${title} ${aliases}`));
  if (!terms.length) return screens;

  const lessons = qaida.lessons.map(item => ({
    title: message(settings, "searchQaidaLesson", {
      number: item.n, title: studyNames.lesson(settings.language, item.n, item.title),
    }),
    to: `/learn/qaida/${item.n}`,
    aliases: `Qaida ${item.n} ${item.title} ${item.traditional}`,
  }));
  const chapters = surahs.surahs.slice(0, 12).map(item => ({
    title: studyNames.surah(settings.language, item.number, item.transliteration),
    to: `/learn/surahs/${item.number}`,
    aliases: `Surah ${item.number} ${item.transliteration} ${item.nameArabic} ${item.english}`,
  }));
  const matchedLibrary = [...lessons, ...chapters].filter(({ title, aliases }) => matches(`${title} ${aliases}`));
  return [...screens, ...matchedLibrary.slice(0, 12)];
}

function Tabs({ settings, umrahGuide }: { settings: Settings; umrahGuide: boolean }) {
  const { mode } = settings;
  return <nav className="tabbar" aria-label={message(settings, "mainNavigation")}>
    {mobile.map(item => <NavLink to={item.to} key={item.to}>{({ isActive }) => <>
      <span className="tab-icon"><DesignIcon size={22} name={mode === "adult" && umrahGuide ? `umrah-practice-${item.tab}` : mode === "adult"
        ? `tab-${item.tab}${isActive === (item.tab === "home") ? "" : "1"}`
        : isActive || item.tab !== "home" ? `maktab-today-${item.tab === "book" || item.tab === "ret" ? `${item.tab}${item.tab === "book" ? "1" : "2"}` : item.tab}` : "tab-home1"} /></span>
      {navigationLabel(settings, item.title)}
    </>}</NavLink>)}
  </nav>;
}

export function AppShell({ children, settings, now, desktop }: { children: ReactNode; settings: Settings; now: Date; desktop: boolean }) {
  const inlineAnatomy = useDesktop(1280);
  const t = message.bind(null, settings);
  const location = useLocation();
  const word = useUi(state => state.word);
  const selectWord = useUi(state => state.selectWord);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const searchReturnFocus = useRef<HTMLElement | null>(null);
  const main = useRef<HTMLElement>(null);
  const searchResults = useMemo(() => searchOpen ? searchApp(settings, query) : [], [searchOpen, settings, query]);
  const calendar = useRecord("calendar", calendarDefaults);
  const logs = usePrayerLogs();
  const reviews = useRecord<Reviews>("reviews", {});
  const lessonProgress = useRecord<number[]>("qaida-complete", []);
  const mosques = useRecord("mosques", mosqueDefaults);
  const studyDays = useRecord<string[]>("study-days", []);
  const hidden = useRecord<DeskActivity[]>("study-plan-hidden", []);
  const familiar = useRecord<string[]>("words-known", []);
  const vocabulary = useRecord<string[]>("word-bank-known", []);
  const writing = useRecord<string[]>("takhti-practised", []);
  const due = Object.entries(reviews).filter(([, review]) => isDue(review, now));
  const nextReview = due.find(([id]) => /^\d+$/.test(id))?.[0];
  const dueSurahs = due.filter(([id]) => /^\d+$/.test(id)).length;
  const { day, next } = currentPrayerSchedule(settings.city, settings.method, settings.school, now, logs);
  const zakat = useRecord<ZakatProfile | null>("zakat", null);
  const zakatPage = location.pathname === "/plan/zakat";
  const planDesktop = desktop && location.pathname === "/plan";
  const mosquesDesktop = desktop && location.pathname === "/plan/mosques";
  const returnDesktop = desktop && location.pathname.startsWith("/return");
  const hawl = zakatHawl(day, zakat, settings.hijriAdjust, calendar.anchors);
  const locale = formatLocale(settings);
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  const ratio = (count: number, total: number) => `${number.format(count)}/${number.format(total)}`;
  const zakatSubtitle = [
    hawl && t("zakatHawlHeader", { hijri: [number.format(hawl.day), planMonth(hawl.month, settings.language), number.format(hawl.year)].join(" "), days: hawl.daysUntil }),
    t("zakatAmountsIn", { currency: zakat?.currency ?? "BDT" }),
  ].filter(Boolean).join(" · ");
  const stats = prayerStatistics(logs, day);
  const counts: Record<string, string> = {
    "/learn": due.length ? t("deskDueBadge", { count: dueSurahs || due.length }) : undefined,
    "/learn/qaida": ratio(lessonProgress.length, 17),
    "/learn/surahs": ratio(Object.keys(reviews).filter(id => /^\d+$/.test(id)).length, 12),
    "/learn/words": number.format(countKnownQuranWords(familiar, vocabulary)),
    "/learn/takhti": ratio(writing.length, 9),
    "/today": ratio(logs.filter(log => log.date === day).length, 5),
    "/return": number.format(stats.returns),
    "/plan/mosques": number.format(mosques.mosques.length),
    "/plan/zakat": hawl && t("zakatDayBadge", { days: hawl.daysUntil }),
  };
  const hifzRoute = location.pathname.startsWith("/learn/hifz/");
  const umrahGuide = location.pathname === "/plan/umrah-guide";
  const sectionPath = hifzRoute ? "/learn/paths" : umrahGuide ? "/plan" : location.pathname;
  const heading = [...destinations].sort((a, b) => b.to.length - a.to.length).find(item => sectionPath.startsWith(item.to));
  const spokenUnit = desktop && location.pathname.startsWith("/learn/speak/") && speakUnit(location.pathname.split("/").at(-1));
  const title = spokenUnit ? `${t("pathsSpeak")} · ${speakCourseTitle(spokenUnit.level, t)} · ${spokenUnit.title[settings.language === "bn" ? 1 : 0]}` : returnDesktop && location.pathname === "/return/qada" ? t("qadaTitle")
    : returnDesktop && location.pathname === "/return/sayyid" ? t("sayyidTitle")
      : heading ? navigationLabel(settings, heading.title) : "awwab";
  const date = formatDay(day, { weekday: "short", day: "numeric", month: "short", year: "numeric" }, locale);
  const planSubtitle = (() => {
    if (!planDesktop) return;
    const month = readCalendarMonth(new URLSearchParams(location.search).get("month"), day);
    const { first, last } = gregorianMonthBounds(month);
    const start = hijriOn(first, settings.hijriAdjust, calendar.anchors);
    const end = hijriOn(last, settings.hijriAdjust, calendar.anchors);
    const endLabel = planMonth(end.month, settings.language) + " " + number.format(end.year);
    const startLabel = planMonth(start.month, settings.language) + (start.year !== end.year ? " " + number.format(start.year) : "");
    const months = start.year === end.year && start.month === end.month ? endLabel : startLabel + " – " + endLabel;
    return [formatDay(first, { month: "long", year: "numeric" }, locale), months, t("planDeskContext")].join(" · ");
  })();
  const nextPrayer = Number.isFinite(next.starts.valueOf())
    ? t("nextPrayerIn", { name: t(next.id), time: duration(next.starts.valueOf() - now.valueOf(), locale) }) : t("prayerTimes");
  const shareSheet = location.pathname === "/share";
  const shareMoment = location.pathname.startsWith("/share/milestone/");
  const umrahRoute = /^\/umrah(?:\/|$)/.test(location.pathname);
  const umrahDesktop = desktop && umrahRoute;
  const umrahAsk = !desktop && /^\/umrah\/ask(?:\/|$)/.test(location.pathname);
  const trip = useRecord("umrah", initialTrip);
  const umrahDates = umrahDesktop && tripDates(trip, locale);
  const umrahSubtitle = [umrahDates && t("umrahTripDates", { dates: umrahDates }), t("umrahPrepareHint")].filter(Boolean).join(" · ");
  const fullscreen = shareSheet || shareMoment || (umrahRoute && !desktop) || location.pathname.startsWith("/print/");
  const today = location.pathname === "/today";
  const studyHome = desktop && location.pathname === "/learn";
  const pathsHome = desktop && location.pathname === "/learn/paths";
  const chapter = location.pathname.startsWith("/learn/surahs/") ? surahs.surahs.slice(0, 12).find(item => String(item.number) === location.pathname.split("/").at(-1)) : undefined;
  const surahStudy = desktop && Boolean(chapter);
  const lesson = location.pathname.startsWith("/learn/qaida/") ? qaida.lessons.find(item => String(item.n) === location.pathname.split("/").at(-1)) : undefined;
  const qaidaStudy = desktop && Boolean(lesson);
  const savedQaidaRow = useRecord(`qaida-row-${lesson?.n}`, 0);
  const rowCount = lesson ? qaidaRows(lesson.n).length : 0;
  const qaidaSubtitle = lesson ? t("qaidaDesktopSubtitle", {
    lesson: settings.language === "en" && lesson.n === 4 ? "Harakat: zabar, zer, pesh" : studyNames.lesson(settings.language, lesson.n, lesson.title),
    row: resolveQaidaRow(new URLSearchParams(location.search).get("row"), savedQaidaRow, rowCount) + 1, total: rowCount,
  }) : "";
  const wordBank = location.pathname === "/learn/words";
  const fluency = location.pathname === "/learn/fluency";
  const wordBankStudy = desktop && wordBank;
  const learnWorkspace = studyHome || pathsHome || surahStudy || qaidaStudy || wordBankStudy || Boolean(spokenUnit);
  const review = chapter && reviews[chapter.number];
  const reviewDay = review && dateKey(new Date(review.card.due), settings.city.timeZone);
  const studySubtitle = chapter ? [
    studyNames.surah(settings.language, chapter.number, chapter.number === 103 ? "Al-ʿAsr" : chapter.transliteration),
    new Intl.NumberFormat(locale).format(chapter.number),
    t(review?.bucket ?? "sabaq"),
    reviewDay && t("surahNextReview", { day: reviewDay <= day ? t("today").toLocaleLowerCase(settings.language) : formatDay(reviewDay, { month: "short", day: "numeric" }, locale) }),
    due.length > 0 && t("itemsDue", { count: due.length }),
  ].filter(Boolean).join(" · ") : "";
  const prayerGuide = location.pathname.startsWith("/today/guide/");
  const guideDesktop = desktop && prayerGuide;
  const hadithDesktop = desktop && location.pathname === "/learn/hadith";
  const settingsDesktop = desktop && (/^\/you(?:\/|$)/.test(location.pathname) || location.pathname === "/sources");
  const languageFlow = !desktop && ["/you/language/picker", "/you/words"].includes(location.pathname);
  const languageItem = languages.find(item => item.code === settings.language);
  const languageLink = desktop && <Link className="sidebar-language-link" to="/you/language/picker">
    <span lang={languageItem.code} data-locale-name={languageItem.script}>{languageItem.native}</span><small>{t("settingsChangeLanguage")}</small>
  </Link>;
  const guideSettingsQuery = guideDesktop ? new URLSearchParams({
    fromPrayer: location.pathname.split("/").at(-1), fromRakah: new URLSearchParams(location.search).get("rakah") ?? "",
  }) : undefined;
  const salahStudy = location.pathname === "/learn/salah";
  useLayoutEffect(() => {
    selectWord();
    setSearchOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname, selectWord]);

  const openSearch = useCallback(() => {
    if (searchOpen) {
      searchInput.current?.focus();
    } else {
      const focused = document.activeElement;
      searchReturnFocus.current = focused instanceof HTMLElement && focused !== document.body ? focused : null;
      setSearchOpen(true);
    }
  }, [searchOpen]);
  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && !event.isComposing && !event.altKey && !event.shiftKey
        && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", search);
    return () => window.removeEventListener("keydown", search);
  }, [openSearch]);

  return <div className="app-shell">
    <a className="skip-link action" href="#app-main" onClick={event => {
      event.preventDefault();
      document.getElementById("app-main")?.focus();
    }}>{t("skipToContent")}</a>
    {!fullscreen && <nav className={`sidebar ${learnWorkspace ? "desktop-learn-nav" : ""}`} aria-label={t("mainNavigation")}>
      <Link to="/learn" aria-label={t("studyHomeLink")}><Wordmark /></Link>
      {settings.mode === "adult" ? <>
        <button type="button" className="search-button" aria-keyshortcuts="Control+K Meta+K" onClick={openSearch}>
          <DesignIcon name="desk-eye" size={15} /> {t("search")} <kbd className="chip" dir="ltr" aria-hidden="true">{t("searchShortcut")}</kbd>
        </button>
        {groups.map(group => <div key={group.label}>
          <p className="caption nav-group">{navigationLabel(settings, group.label)}</p>
          {group.items.filter(item => !learnWorkspace || item.to !== "/you").map(item => {
            const currentPath = (hifzRoute || umrahGuide) && item.to === sectionPath;
            const ItemLink = currentPath ? Link : NavLink;
            return <ItemLink key={item.to} to={item.to} end={item.end} aria-current={currentPath ? "location" : "page"}>
              {wordBankStudy && item.to === "/learn/words" ? <DesignIcon name="word-bank-desk-list" size={16} /> :
                (surahStudy || wordBankStudy) && (item.icon === "home" || surahStudy && item.icon === "headphones") ?
                <DesignIcon name={"surah-adult-" + item.icon} size={16} /> :
                qaidaStudy && (item.icon === "home" || item.to === "/learn/qaida") ?
                  <DesignIcon name={item.icon === "home" ? "surah-adult-home" : "qaida-desk-book"} size={16} /> :
                <DesignIcon name={item.icon === "user" ? "tab-user1" : `desk-${item.icon}`} size={17} />}
              {navigationLabel(settings, item.title)}
              {counts[item.to] && <span className="chip ml-auto">{counts[item.to]}</span>}
            </ItemLink>;
          })}
        </div>)}
        <div className="sidebar-bottom">{languageLink}<Link to="/you" className="card compact-stack">
          <strong>{t(learnWorkspace ? "deskStreakSummary" : "activity", { count: studyDays.length })}</strong>
          <small className="muted">{t(learnWorkspace ? "deskOfflineMode" : "adultOffline", { script: settings.script === "indopak" ? "IndoPak" : "Uthmani" })}</small>
        </Link></div>
      </> : <>
        {simple.map(item => <NavLink key={item.to} to={item.to}><DesignIcon name={`maktab-desk-${item.simple}`} />{navigationLabel(settings, item.title === "Today" ? "Prayers" : item.title)}</NavLink>)}
        <div className="sidebar-bottom">
          <NavLink to="/learn/map"><DesignIcon name="desk-sliders" size={16} />{t("pathsMap")}</NavLink>
          <NavLink to="/print"><DesignIcon name="maktab-desk-download" /> {t("print")}</NavLink>
          {languageLink}
          <button className="sidebar-mode" type="button" role="switch" aria-checked="true" aria-label={t("maktabModeLabel")} onClick={() => void updateSettings({ mode: "adult", spellStyle: "en" })}>
            <span>{t("maktabModeLabel")}<small className="muted">{t("maktabModeNote")}</small></span><span className="mode-switch-track" aria-hidden="true" />
          </button>
        </div>
      </>}
    </nav>}
    <main ref={main} className="app-main" id="app-main" tabIndex={-1} data-page={shareSheet ? "share-sheet" : shareMoment ? "share-moment" : umrahDesktop ? "umrah-prep" : prayerGuide ? "prayer-guide" : salahStudy ? "salah-study" : today ? "today" : planDesktop ? "plan-desktop" : mosquesDesktop ? "mosques-desktop" : returnDesktop ? "return-desktop" : hadithDesktop ? "hadith-desktop" : settingsDesktop ? "settings-desktop" : languageFlow ? "settings-language-flow" : pathsHome ? "paths" : studyHome ? "learn" : chapter ? "surah-reader" : lesson ? "qaida-lesson" : wordBank ? "word-bank" : fluency ? "fluency" : location.pathname.startsWith("/learn/takhti") ? "takhti" : undefined}>
      {!fullscreen && (!umrahGuide || desktop) && !((today || studyHome || surahStudy) && settings.mode === "maktab") && <header className="topbar">
        <div>{today || learnWorkspace || zakatPage || planDesktop || mosquesDesktop || returnDesktop || guideDesktop || hadithDesktop || settingsDesktop || umrahDesktop ? <h1>{umrahDesktop ? t("umrahPrepare") : settingsDesktop ? t("settingsDeskTitle") : guideDesktop ? t("howToPray") : qaidaStudy ? t("qaidaDesktopTitle", { number: lesson.n }) : surahStudy ? t("surahsForSalah") : wordBankStudy ? t("wordBankName") : title}</h1> : <h2>{title}</h2>}
          <p className="small muted">{guideDesktop ? <>
            <Link to={`/you/prayer?${guideSettingsQuery}`}>{t(guideReference(settings) === "hanafi" ? "prayerGuideHanafi" : "prayerGuideFard")} · {t("prayerGuideSettings")}</Link> · {t("guideDesktopAnatomy")}
          </> : spokenUnit ? <><Link to={speakSetupPath(spokenUnit.level, spokenUnit.variety)}>{t(speakVarietyLabels[spokenUnit.variety])}</Link> · {t("speakUnitNumber", { number: speakUnitNumber(spokenUnit) })}</> : <>{planSubtitle ?? (pathsHome ? t("pathsSubtitle") : umrahDesktop ? umrahSubtitle : settingsDesktop ? t("settingsDeskCaption") : hadithDesktop ? t("hadithDesktopIntro") : returnDesktop ? t("returnDeskSubtitle") : mosquesDesktop ? t("mosqueDeskCaption", { count: mosques.mosques.length }) : zakatPage ? zakatSubtitle : qaidaStudy ? qaidaSubtitle : surahStudy ? studySubtitle : wordBankStudy ? t("wordBankSubtitle") : date + " · " + hijriLabel(day, settings.hijriAdjust, calendar.anchors, locale))}{today && ` · ${prayerCityLabel(settings.city, t)}`}{studyHome && " · " + t("deskMinutesToday", { count: studyPlanMinutes(hidden) })}</>}</p></div>
        <Link className="chip night" to="/today">{nextPrayer}</Link>
        {settings.mode === "adult" && <>
          <Link className="action" to={reviewDestination(nextReview ?? due[0]?.[0])}><DesignIcon name="desk-play" size={14} />{t("startReview")}{due.length ? ` · ${number.format(studyHome ? dueSurahs || due.length : due.length)}` : ""}</Link>
          <Link className="action soft" to="/today?log=1"><DesignIcon name="desk-plus" size={14} />{t("logPrayer")}</Link>
          <ShareLink className="action light" to={today ? "/share?from=today" : umrahDesktop ? "/share?template=umrah&from=umrah" : returnDesktop ? "/share?template=return&from=return" : "/share?from=learn"}><DesignIcon name="desk-share" size={14} />{t("share")}</ShareLink>
        </>}
        <Link className="icon-button" to="/you/reminders" aria-label={t("reminders")}><DesignIcon name="desk-bell" size={18} /></Link>
      </header>}
      <div className="workspace">
        <div className={`app-content${umrahAsk ? " umrah-ask-content" : ""}${word && inlineAnatomy ? " anatomy-open" : ""}`}>{children}</div>
        <WordPanel presentation={inlineAnatomy ? "inline" : desktop ? "drawer" : "sheet"} settings={settings} reader={surahStudy} />
      </div>
    </main>
    {!fullscreen && !prayerGuide && !languageFlow && <Tabs settings={settings} umrahGuide={umrahGuide} />}
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="awwab-dialog" aria-describedby={undefined} showCloseButton={false}
        onOpenAutoFocus={event => {
          event.preventDefault();
          searchInput.current?.focus();
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          const target = searchReturnFocus.current;
          (target?.isConnected && target.getClientRects().length ? target : main.current)?.focus();
        }}>
        <div className="row-between">
          <DialogTitle>{t("searchApp")}</DialogTitle>
          <DialogClose className="icon-button" aria-label={t("shareClose")}><X size={18} aria-hidden="true" /></DialogClose>
        </div>
        <input ref={searchInput} type="search" className="input" placeholder={t("findScreen")} aria-label={t("findScreen")}
          value={query} onChange={event => setQuery(event.target.value)} />
        {searchResults.length > 0 ? <div className="compact-stack" onKeyDown={focusListItem}>
          {searchResults.map(({ title, to }) => <Link to={to} key={to} className="list-row" onClick={() => {
            searchReturnFocus.current = main.current;
            setSearchOpen(false);
          }}>{title}</Link>)}
        </div> : searchOpen && <p className="small muted" role="status">{t("searchNoResults")}</p>}
      </DialogContent>
    </Dialog>
  </div>;
}
