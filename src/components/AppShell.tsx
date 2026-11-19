import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { DesignIcon, Wordmark } from "./DesignIcon";
import { WordPanel } from "./WordPanel";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { useRecord, usePrayerLogs } from "@/hooks/use-awwab";
import { duration, formatDay } from "@/lib/dates";
import { calendarDefaults, hijriLabel } from "@/lib/hijri";
import { currentPrayerSchedule } from "@/lib/prayerServices";
import { prayerStatistics, type Settings, updateSettings } from "@/lib/storageService";
import { useUi } from "@/lib/uiState";
import { isDue, type Reviews } from "@/lib/reviews";
import { mosqueDefaults } from "@/lib/mosques";
import { message, navigationLabel } from "@/lib/copy";
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
    { title: "Qaida", to: "/learn/qaida", icon: "book" },
    { title: "Surahs", to: "/learn/surahs", icon: "headphones" },
    { title: "Word bank", to: "/learn/words", icon: "list" },
    { title: "Takhti", to: "/learn/takhti", icon: "pen" },
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
const librarySearch = [
  ...qaida.lessons.map(item => ({ title: `Qaida ${item.n} · ${item.title}`, to: `/learn/qaida/${item.n}`, terms: item.traditional })),
  ...surahs.surahs.slice(0, 12).map(item => ({ title: item.transliteration, to: `/learn/surahs/${item.number}`, terms: `${item.nameArabic} ${item.english}` })),
];

function Tabs({ settings }: { settings: Settings }) {
  const { mode } = settings;
  return <nav className="tabbar" aria-label={message(settings, "mainNavigation")}>
    {mobile.map(item => <NavLink to={item.to} key={item.to}>{({ isActive }) => <>
      <span className="tab-icon"><DesignIcon size={22} name={mode === "adult"
        ? `tab-${item.tab}${isActive ? "" : "1"}`
        : isActive || item.tab !== "home" ? `maktab-today-${item.tab === "book" || item.tab === "ret" ? `${item.tab}${item.tab === "book" ? "1" : "2"}` : item.tab}` : "tab-home1"} /></span>
      {navigationLabel(settings, item.title)}
    </>}</NavLink>)}
  </nav>;
}

export function AppShell({ children, settings, now, desktop }: { children: ReactNode; settings: Settings; now: Date; desktop: boolean }) {
  const t = message.bind(null, settings);
  const location = useLocation();
  const word = useUi(state => state.word);
  const selectWord = useUi(state => state.selectWord);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const calendar = useRecord("calendar", calendarDefaults);
  const logs = usePrayerLogs();
  const reviews = useRecord<Reviews>("reviews", {});
  const lessonProgress = useRecord<number[]>("qaida-complete", []);
  const mosques = useRecord("mosques", mosqueDefaults);
  const studyDays = useRecord<string[]>("study-days", []);
  const due = Object.entries(reviews).filter(([, review]) => isDue(review, now));
  const nextReview = due.find(([id]) => /^\d+$/.test(id))?.[0];
  const { day, next } = currentPrayerSchedule(settings.city, settings.method, settings.school, now, logs);
  const stats = prayerStatistics(logs, day);
  const counts: Record<string, string> = {
    "/learn": `${due.length} due`,
    "/learn/qaida": `${lessonProgress.length}/17`,
    "/learn/surahs": `${Object.keys(reviews).filter(id => /^\d+$/.test(id)).length}/12`,
    "/today": `${logs.filter(log => log.date === day).length}/5`,
    "/return": String(stats.returns),
    "/plan/mosques": String(mosques.mosques.length),
  };
  const destinations = groups.flatMap(group => group.items);
  const heading = [...destinations].sort((a, b) => b.to.length - a.to.length).find(item => location.pathname.startsWith(item.to));
  const title = heading ? navigationLabel(settings, heading.title) : "awwab";
  const date = formatDay(day, { weekday: "short", day: "numeric", month: "short", year: "numeric" }, settings.language);
  const nextPrayer = Number.isFinite(next.starts.valueOf())
    ? t("nextPrayerIn", { name: t(next.id), time: duration(next.starts.valueOf() - now.valueOf(), settings.language) }) : t("prayerTimes");
  const fullscreen = location.pathname.startsWith("/umrah") || location.pathname.startsWith("/print/");
  const today = location.pathname === "/today";
  useLayoutEffect(() => {
    selectWord();
    setSearchOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname, selectWord]);

  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", search);
    return () => window.removeEventListener("keydown", search);
  }, []);

  return <div className="app-shell">
    <a className="skip-link action" href="#app-main" onClick={event => {
      event.preventDefault();
      document.getElementById("app-main")?.focus();
    }}>{t("skipToContent")}</a>
    {!fullscreen && <nav className="sidebar" aria-label={t("mainNavigation")}>
      <Link to="/learn" aria-label="Awwab study plan"><Wordmark /></Link>
      {settings.mode === "adult" ? <>
        <button type="button" className="search-button" onClick={() => setSearchOpen(true)}><DesignIcon name="desk-eye" size={15} /> {t("search")} <kbd className="chip">Ctrl K</kbd></button>
        {groups.map(group => <div key={group.label}>
          <p className="caption nav-group">{navigationLabel(settings, group.label)}</p>
          {group.items.map(item => <NavLink key={item.to} to={item.to} end={item.end}>
            <DesignIcon name={item.icon === "user" ? "tab-user1" : `desk-${item.icon}`} size={17} />
            {navigationLabel(settings, item.title)}
            {counts[item.to] && <span className="chip ml-auto">{counts[item.to]}</span>}
          </NavLink>)}
        </div>)}
        <div className="sidebar-bottom"><p className="card compact-stack"><strong>{t("activity", { count: studyDays.length })}</strong><small className="muted">{t("adultOffline")}</small></p></div>
      </> : <>
        {simple.map(item => <NavLink key={item.to} to={item.to}><DesignIcon name={`maktab-desk-${item.simple}`} />{navigationLabel(settings, item.title === "Today" ? "Prayers" : item.title)}</NavLink>)}
        <div className="sidebar-bottom">
          <NavLink to="/print"><DesignIcon name="maktab-desk-download" /> {t("print")}</NavLink>
          <button className="sidebar-mode" type="button" role="switch" aria-checked="true" aria-label={t("maktabModeLabel")} onClick={() => void updateSettings({ mode: "adult", spellStyle: "en" })}>
            <span>{t("maktabModeLabel")}<small className="muted">{t("maktabModeNote")}</small></span><span className="mode-switch-track" aria-hidden="true" />
          </button>
        </div>
      </>}
    </nav>}
    <main className="app-main" id="app-main" tabIndex={-1} data-page={today ? "today" : undefined}>
      {!fullscreen && !(today && settings.mode === "maktab") && <header className="topbar">
        <div>{today ? <h1>{title}</h1> : <h2>{title}</h2>}<p className="small muted">{date} · {hijriLabel(day, settings.hijriAdjust, calendar.anchors)}{today && ` · ${settings.city.name}`}</p></div>
        <Link className="chip night" to="/today">{nextPrayer}</Link>
        {settings.mode === "adult" && <>
          <Link className="action" to={nextReview ? `/learn/surahs/${nextReview}` : "/learn/surahs"}><DesignIcon name="desk-play" size={14} />{t("startReview")}{due.length ? ` · ${due.length}` : ""}</Link>
          <Link className="action soft" to="/today?log=1"><DesignIcon name="desk-plus" size={14} />{t("logPrayer")}</Link>
          <Link className="action light" to="/share"><DesignIcon name="desk-share" size={14} />{t("share")}</Link>
        </>}
        <Link className="icon-button" to="/you/reminders" aria-label={t("reminders")}><DesignIcon name="desk-bell" size={18} /></Link>
      </header>}
      <div className="workspace">
        <div className={`app-content ${word && desktop ? "anatomy-open" : ""}`}>{children}</div>
        <WordPanel desktop={desktop} settings={settings} />
      </div>
    </main>
    {!fullscreen && <Tabs settings={settings} />}
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="awwab-dialog" aria-describedby={undefined}>
        <DialogTitle>{t("searchApp")}</DialogTitle>
        <input className="input" placeholder={t("findScreen")} aria-label={t("findScreen")} value={query} onChange={event => setQuery(event.target.value)} />
        <div className="compact-stack">
          {destinations.filter(item => `${item.title} ${navigationLabel(settings, item.title)}`.toLowerCase().includes(query.trim().toLowerCase())).map(item =>
            <Link to={item.to} onClick={() => setSearchOpen(false)} key={item.to} className="list-row">{navigationLabel(settings, item.title)}</Link>)}
          {query.trim() && librarySearch.filter(item => `${item.title} ${item.terms}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12).map(item =>
            <Link to={item.to} onClick={() => setSearchOpen(false)} key={item.to} className="list-row">{item.title}</Link>)}
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
