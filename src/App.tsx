import { useEffect, useState } from "react";
import { HashRouter, Link, Navigate, Outlet, Route, Routes, parsePath, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "@/components/AppShell";
import { WordPanel } from "@/components/WordPanel";
import { SettingsWorkspace } from "@/components/SettingsWorkspace";
import type { ShareRouteState } from "@/components/ShareLink";
import { WordingSuggestionLayer } from "@/components/WordingSuggestions";
import { useClock, useDesktop, useSettings } from "@/hooks/use-awwab";
import { migrateLegacy } from "@/lib/storageService";
import { CopyContext } from "@/lib/copy";
import Today, { PrayerWeek } from "@/pages/Index";
import { PrayerGuide } from "@/pages/PrayerGuide";
import { Learn } from "@/pages/Learn";
import { Plan } from "@/pages/Plan";
import { ReturnPage, Sayyid } from "@/pages/Return";
import { Qada } from "@/pages/Qada";
import { SettingsPage, You } from "@/pages/You";
import { LanguagePicker, LanguageSettings, YourWordsSettings } from "@/pages/LanguageSettings";
import { Onboarding } from "@/pages/Onboarding";
import { Hadith } from "@/pages/Hadith";
import { Fluency } from "@/pages/Fluency";
import { Qaida } from "@/pages/Qaida";
import { SurahReader } from "@/pages/Surahs";
import { SalahWords } from "@/pages/SalahWords";
import { Mosques } from "@/pages/Mosques";
import { Zakat } from "@/pages/Zakat";
import { PrintHub, PrintSheet, WordPrintSheet } from "@/pages/Print";
import { Takhti } from "@/pages/Takhti";
import { Share } from "@/pages/Share";
import { shareReturnPath } from "@/lib/shareNavigation";
import { Milestone } from "@/pages/Milestone";
import { HaramFocus, UmrahDuas, UmrahMapPage, UmrahNow, UmrahPlan, UmrahRituals, UmrahShell, WalkWithMe } from "@/pages/Umrah";
import { Sources } from "@/pages/Sources";
import { WordBank } from "@/pages/WordBank";
import { AudioPacks } from "@/pages/AudioPacks";
import AppInstallPrompt from "@/components/AppInstallPrompt";

function Main() {
  const settings = useSettings();
  const desktop = useDesktop();
  const now = useClock();
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname, search } = location;
  const [storage, setStorage] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => migrateLegacy(window.localStorage)).then(() => {
      if (active) setStorage("ready");
    }, () => {
      if (active) setStorage("error");
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.mode = settings.mode;
    document.documentElement.dataset.textSize = settings.textSize ?? "default";
    document.documentElement.lang = settings.language;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", settings.mode === "adult" ? "#15302b" : "#25306b");
  }, [settings]);

  if (storage === "error") return <main className="app-content stack"><h1>Device storage is unavailable</h1><p>Allow this site to use browser storage, then reload to open Awwab.</p></main>;
  if (!settings || storage === "loading") return <main className="app-content"><p role="status">Opening awwab…</p></main>;
  if (!settings.onboarded && pathname !== "/install" && pathname !== "/sources") return <CopyContext.Provider value={settings}><Onboarding settings={settings} /><WordPanel desktop={false} settings={settings} /></CopyContext.Provider>;
  const shareDialog = desktop && pathname === "/share";
  const shareBackground = (location.state as ShareRouteState | null)?.shareBackground;
  const shareBack = shareDialog ? shareReturnPath(new URLSearchParams(search)) : "";
  const background = shareDialog ? shareBackground ?? { key: location.key, ...parsePath(shareBack) } : location;

  return <CopyContext.Provider value={settings}>
    <Routes location={background}>
      <Route element={<AppShell settings={settings} now={now} desktop={desktop}><Outlet /></AppShell>}>
        <Route path="/" element={<Navigate replace to={desktop ? "/learn" : "/today"} />} />
        <Route path="/today" element={<Today settings={settings} now={now} desktop={desktop} />} />
        <Route path="/today/guide/:id" element={<PrayerGuide settings={settings} desktop={desktop} />} />
        <Route path="/today/week" element={<PrayerWeek settings={settings} now={now} />} />
        <Route path="/learn" element={<Learn settings={settings} desktop={desktop} now={now} />} />
        <Route path="/learn/qaida/:id?" element={<Qaida settings={settings} desktop={desktop} />} />
        <Route path="/learn/surahs/:id?" element={<SurahReader settings={settings} now={now} />} />
        <Route path="/learn/salah" element={<SalahWords settings={settings} />} />
        <Route path="/learn/fluency" element={<Fluency settings={settings} now={now} />} />
        <Route path="/learn/words" element={<WordBank settings={settings} desktop={desktop} now={now} />} />
        <Route path="/learn/takhti/:family?" element={<Takhti />} />
        <Route path="/learn/hadith" element={<Hadith desktop={desktop} />} />
        <Route path="/return" element={<ReturnPage settings={settings} now={now} desktop={desktop} />} />
        <Route path="/return/sayyid" element={<Sayyid settings={settings} desktop={desktop} />} />
        <Route path="/return/qada" element={<Qada settings={settings} now={now} desktop={desktop} />} />
        <Route path="/plan" element={<Plan settings={settings} now={now} desktop={desktop} />} />
        <Route path="/plan/mosques" element={<Mosques settings={settings} now={now} desktop={desktop} />} />
        <Route path="/plan/zakat" element={<Zakat settings={settings} now={now} desktop={desktop} />} />
        <Route path="/share" element={<Share key={search} settings={settings} now={now} />} />
        <Route path="/share/milestone/:kind/:number" element={<Milestone settings={settings} now={now} />} />
        <Route path="/install" element={<div className="stack"><AppInstallPrompt /><Link className="action soft" to="/">Continue to awwab</Link></div>} />
        <Route path="/umrah" element={<UmrahShell now={now} />}>
          <Route index element={<UmrahNow />} />
          <Route path="rituals" element={<UmrahRituals />} />
          <Route path="focus" element={<HaramFocus />} />
          <Route path="map" element={<UmrahMapPage />} />
          <Route path="duas" element={<UmrahDuas />} />
          <Route path="plan" element={<UmrahPlan />} />
          <Route path="location" element={<WalkWithMe />} />
        </Route>
        <Route path="/print" element={<PrintHub />} />
        <Route path="/print/word-card" element={<WordPrintSheet />} />
        <Route path="/print/:sheet/:family?" element={<PrintSheet settings={settings} now={now} />} />
        <Route element={<SettingsWorkspace desktop={desktop} />}>
          <Route path="/sources" element={<Sources />} />
          <Route path="/you" element={<You settings={settings} now={now} desktop={desktop} />} />
          <Route path="/you/audio" element={<AudioPacks />} />
          <Route path="/you/language" element={<LanguageSettings settings={settings} desktop={desktop} />} />
          <Route path="/you/language/picker" element={<LanguagePicker settings={settings} />} />
          <Route path="/you/words" element={<YourWordsSettings settings={settings} />} />
          {["learning", "prayer", "hijri", "reminders", "data", "display", "privacy", "about"].map(page => <Route key={page} path={`/you/${page}`}
            element={<SettingsPage key={page} settings={settings} now={now} panel={page} desktop={desktop} />} />)}
        </Route>
        <Route path="*" element={<section className="card stack"><h1>Find your way back</h1><p>Choose a page to continue.</p><Link className="action" to="/">Go to your home screen</Link></section>} />
      </Route>
    </Routes>
    {shareDialog && <Share key={search} settings={settings} now={now} closeDialog={() => {
      if (shareBackground && window.history.state?.idx > 0) navigate(-1);
      else navigate(shareBack, { replace: true });
    }} />}
    <WordingSuggestionLayer />
  </CopyContext.Provider>;
}

export default function App() {
  return <HashRouter><Toaster position="top-center" /><Main /></HashRouter>;
}
