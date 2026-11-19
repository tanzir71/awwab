import type { Prayer } from "@/types/Prayer";
import type { Settings } from "@/lib/storageService";
import { message } from "@/lib/copy";
import { formatTime } from "@/lib/dates";
import { DesignIcon } from "./DesignIcon";

export default function PrayerTimeline({ prayers, settings, onAction }: {
  prayers: Prayer[]; settings: Settings; onAction: (prayer: Prayer) => void;
}) {
  const group = settings.mode === "maktab" ? "maktab-today" : "today";
  const t = message.bind(null, settings);
  const icons = { upcoming: "clock1", now: "clock", done: "check", late: "check", missed: "ret", qada: "check" };
  return <div className="compact-stack">
    {prayers.map(prayer => <button type="button" key={prayer.id} className="list-row prayer-row"
      data-now={prayer.status === "now"} data-status={prayer.status} onClick={() => onAction(prayer)}>
      <span className="icon-box"><DesignIcon name={`${group}-${icons[prayer.status]}`} size={18} /></span>
      <span><strong>{t(prayer.id)}</strong>
        <small>{t(prayer.status)}{prayer.status === "missed" && ` · ${t("missedEncouragement")}`}</small>
      </span>
      <time dateTime={Number.isFinite(prayer.starts.valueOf()) ? prayer.starts.toISOString() : undefined}>{Number.isFinite(prayer.starts.valueOf()) ? formatTime(prayer.starts, settings.city.timeZone, settings.language) : t("unavailable")}</time>
    </button>)}
  </div>;
}
