import { prayerStatusNames, type Prayer } from "@/types/Prayer";
import { formatTime } from "@/lib/dates";
import { DesignIcon } from "./DesignIcon";

export default function PrayerTimeline({ prayers, zone, mode, onAction }: {
  prayers: Prayer[]; zone: string; mode: "adult" | "maktab"; onAction: (prayer: Prayer) => void;
}) {
  const group = mode === "maktab" ? "maktab-today" : "today";
  const icons = { upcoming: "clock1", now: "clock", done: "check", late: "check", missed: "ret", qada: "check" };
  return <div className="compact-stack">
    {prayers.map(prayer => <button type="button" key={prayer.id} className="list-row prayer-row"
      data-now={prayer.status === "now"} data-status={prayer.status} onClick={() => onAction(prayer)}>
      <span className="icon-box"><DesignIcon name={`${group}-${icons[prayer.status]}`} size={18} /></span>
      <span><strong>{prayer.name}</strong>
        <small>{prayerStatusNames[prayer.status]}{prayer.status === "missed" && " · You can still come back to it."}</small>
      </span>
      <time dateTime={Number.isFinite(prayer.starts.valueOf()) ? prayer.starts.toISOString() : undefined}>{Number.isFinite(prayer.starts.valueOf()) ? formatTime(prayer.starts, zone) : "Unavailable"}</time>
    </button>)}
  </div>;
}
