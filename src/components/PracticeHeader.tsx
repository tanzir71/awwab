import { Link } from "react-router-dom";
import { DesignIcon } from "@/components/DesignIcon";
import { useCopy } from "@/lib/copy";

export function PracticeHeader({ title, back, maktab, settingsTo = "/you/learning" }: { title: string; back: string; maktab: boolean; settingsTo?: string }) {
  const { t } = useCopy();
  const icons = maktab ? "qaida-maktab" : "surah-mobile";
  return <header className="practice-header">
    <Link className="icon-button" to={back} aria-label={t("back")}><DesignIcon name={icons + "-chevl"} size={24} /></Link>
    <h1>{title}</h1>
    <Link className="icon-button" to={settingsTo} aria-label={t("settings")}><DesignIcon name={icons + "-sliders"} size={24} /></Link>
  </header>;
}
