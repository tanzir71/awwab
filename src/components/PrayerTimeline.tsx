import type { Prayer, RakatGroup } from "@/types/Prayer";
import type { Settings } from "@/lib/storageService";
import { message, rakatLabel } from "@/lib/copy";
import { duration, formatTime } from "@/lib/dates";
import { jamaatForPrayer, type MosquePlan } from "@/lib/mosques";
import { guideRakats } from "@/lib/prayerGuide";
import { DesignIcon } from "./DesignIcon";

const icons = { upcoming: "clock1", now: "clock", done: "check", late: "check", missed: "ret", qada: "check" };

export function RakatCards({ groups, settings }: { groups: RakatGroup[]; settings: Settings }) {
  const t = message.bind(null, settings);
  const number = new Intl.NumberFormat(settings.language);
  return <div className="rakat-grid" data-count={groups.length}>
    {groups.map((group, i) => <div data-fard={group.type === "fard"} key={i}>
      <strong><span className="rakat-number">{number.format(group.count)}</span> {rakatLabel(settings, group.type)}</strong>
      <small>{t(group.type === "fard" ? "rakatsObligatory" : group.type === "witr" ? "rakatsWajib" : "rakatsOptional")}</small>
    </div>)}
  </div>;
}

export default function PrayerTimeline({ prayers, settings, now, mosques, onAction }: {
  prayers: Prayer[]; settings: Settings; now: Date; mosques?: MosquePlan; onAction: (prayer: Prayer) => void;
}) {
  const group = settings.mode === "maktab" ? "maktab-today" : "today";
  const t = message.bind(null, settings);
  const number = new Intl.NumberFormat(settings.language);
  const zone = settings.city.timeZone;
  return <div className="compact-stack prayer-timeline">
    {prayers.map(prayer => {
      const available = Number.isFinite(prayer.starts.valueOf());
      const jamaat = mosques && jamaatForPrayer(prayer, zone, mosques);
      const rakats = guideRakats(prayer.rakats, settings).map(rakat => `${number.format(rakat.count)} ${rakatLabel(settings, rakat.type)}`).join(" → ");
      const status = prayer.status === "now" ? t("prayerRowNow", { time: duration(prayer.ends.valueOf() - now.valueOf(), settings.language) }) : t(prayer.status);
      const detail = prayer.status === "missed" ? t("missedEncouragement") : [
        prayer.status !== "upcoming" || !available ? status : undefined,
        jamaat ? t("jamaat", jamaat) : undefined,
        !jamaat && available && (prayer.status === "now" || prayer.status === "upcoming") ? rakats : undefined,
      ].filter(Boolean).join(" · ");
      const icon = prayer.status === "missed" && settings.mode === "adult" ? "today-missed" : `${group}-${icons[prayer.status]}`;
      return <button type="button" key={prayer.id} className="list-row prayer-row"
        data-status={prayer.status} onClick={() => onAction(prayer)}>
        <span className="icon-box"><DesignIcon name={icon} size={16} /></span>
        <span><strong>{t(prayer.id)}</strong><small>{detail}</small></span>
        {available ? <time dateTime={prayer.starts.toISOString()} aria-label={formatTime(prayer.starts, zone, settings.language)}>{formatTime(prayer.starts, zone, settings.language, true)}</time> : <small>{t("unavailable")}</small>}
      </button>;
    })}
  </div>;
}
