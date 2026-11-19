import { Link, Outlet, useLocation } from "react-router-dom";
import { useCopy } from "@/lib/copy";

const categories = [
  { to: "/you", label: "settingsProfile", matches: ["/you", "/you/learning"] },
  { to: "/you/language", label: "settingsLanguage", matches: ["/you/language", "/you/language/picker", "/you/words"] },
  { to: "/you/prayer", label: "settingsPrayer", matches: ["/you/prayer", "/you/hijri"] },
  { to: "/you/reminders", label: "settingsReminders", matches: ["/you/reminders"] },
  { to: "/you/data", label: "settingsBackup", matches: ["/you/data"] },
  { to: "/you/display", label: "settingsDisplay", matches: ["/you/display", "/you/audio"] },
  { to: "/you/privacy", label: "settingsPrivacy", matches: ["/you/privacy"] },
  { to: "/sources", label: "settingsSources", matches: ["/sources"] },
  { to: "/you/about", label: "settingsAbout", matches: ["/you/about"] },
];

export function SettingsWorkspace({ desktop }: { desktop: boolean }) {
  const { t } = useCopy();
  const { pathname } = useLocation();
  if (!desktop) return <Outlet />;
  return <div className="settings-desk">
    <nav className="card settings-desk-categories" aria-label={t("settingsCategories")}>
      {categories.map(({ to, label, matches }) => <Link key={to} to={to} aria-current={matches.includes(pathname) ? "page" : undefined}>{t(label)}</Link>)}
    </nav>
    <div className="settings-desk-panel"><Outlet /></div>
  </div>;
}
